// MobileKobo entry point: wires the ported engine to the page (loop, HUD, menus, touch controls).
import { WSIZE, WAIT_MSEC } from './config.js';
import { opts } from './opts.js';
import { rand } from './random.js';
import { gfx } from './gfx.js';
import { manage } from './manage.js';
import { radar } from './radar.js';
import { input } from './input.js';
import { key } from './key.js';
import { storage } from './storage.js';
import { renderFrame } from './render.js';
import { drawLogo, makeAttract } from './attract.js';
import './enemy.js';   // make sure the full module graph is loaded

const $ = (id) => document.getElementById(id);
const app = $('app');
const pad9 = (n) => String(n).padStart(9, '0');
const pad2 = (n) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ */
/* d-pad                                                                */
/* ------------------------------------------------------------------ */

const wedges = [];
let knob = null;
function buildDpad() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-100 -100 200 200');
  const pt = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [(r * Math.sin(a)).toFixed(2), (-r * Math.cos(a)).toFixed(2)];
  };
  for (let d = 1; d <= 8; d++) {
    const c = (d - 1) * 45, a1 = c - 21.5, a2 = c + 21.5;
    const [ox1, oy1] = pt(98, a1), [ox2, oy2] = pt(98, a2), [ix1, iy1] = pt(30, a1), [ix2, iy2] = pt(30, a2);
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', `M${ix1} ${iy1} L${ox1} ${oy1} A98 98 0 0 1 ${ox2} ${oy2} L${ix2} ${iy2} A30 30 0 0 0 ${ix1} ${iy1}Z`);
    p.setAttribute('class', 'wedge');
    svg.appendChild(p);
    wedges[d] = p;
    const tri = document.createElementNS(NS, 'polygon');
    tri.setAttribute('points', '0,-82 8,-66 -8,-66');
    tri.setAttribute('transform', `rotate(${c})`);
    tri.setAttribute('class', 'arrow');
    svg.appendChild(tri);
  }
  const hub = document.createElementNS(NS, 'circle');
  hub.setAttribute('r', '22'); hub.setAttribute('class', 'hub');
  svg.appendChild(hub);
  knob = document.createElementNS(NS, 'circle');
  knob.setAttribute('r', '15'); knob.setAttribute('class', 'knob');
  svg.appendChild(knob);
  $('dpad').appendChild(svg);
}
function showDir(d, held) {
  for (let i = 1; i <= 8; i++) wedges[i].setAttribute('class', 'wedge' + (i === d ? (held ? ' on' : ' last') : ''));
}

/* ------------------------------------------------------------------ */
/* game canvas / loop                                                   */
/* ------------------------------------------------------------------ */

const gcanvas = $('game');
const gctx = gcanvas.getContext('2d');
let dirty = true;

function resizeGame() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.round(gcanvas.clientWidth * dpr));
  if (gcanvas.width !== w) { gcanvas.width = w; gcanvas.height = w; }
  dirty = true;
}

function draw() {
  const v = renderFrame();
  gctx.imageSmoothingEnabled = false;
  gctx.drawImage(v, 0, 0, WSIZE, WSIZE, 0, 0, gcanvas.width, gcanvas.height);
}

const hud = { score: '', stage: '', ships: '', sv: true, hv: true };
function updateHud() {
  const s = pad9(manage.score), st = pad2(manage.sceneNum + 1), sh = String(manage.ships);
  if (s !== hud.score) { hud.score = s; $('hud-score').textContent = s; }
  if (st !== hud.stage) { hud.stage = st; $('hud-stage').textContent = st; }
  if (sh !== hud.ships) { hud.ships = sh; $('hud-ships').textContent = opts.cheat ? '∞' : sh; }
  if (manage.scoreVisible !== hud.sv) { hud.sv = manage.scoreVisible; $('hud-score').classList.toggle('off', !hud.sv); }
  if (manage.shipsVisible !== hud.hv) { hud.hv = manage.shipsVisible; $('hud-ships').classList.toggle('off', !hud.hv); }
}

let shownDir = 0, shownHeld = false;
function syncPad() {
  const held = input.stickDir > 0;
  if (key.direction !== shownDir || held !== shownHeld) {
    shownDir = key.direction; shownHeld = held;
    showDir(shownDir, held);
  }
}

let last = performance.now(), acc = 0, clearShown = false;
function frame(now) {
  requestAnimationFrame(frame);
  input.pollGamepad();
  const dt = Math.min(250, now - last);
  last = now;

  if (manage.state === 'playing') {
    acc += dt;
    let steps = 0;
    while (acc >= WAIT_MSEC && steps < 5) {
      input.apply();
      manage.mainloop();
      acc -= WAIT_MSEC;
      steps++;
      dirty = true;
      if (manage.state !== 'playing') break;
    }
    if (steps === 5) acc = 0;
    if (manage.nextStateNext && !clearShown) { clearShown = true; banner('STAGE CLEAR'); }
    else if (!manage.nextStateNext) clearShown = false;
  } else {
    acc = 0;
  }

  if (dirty && manage.state !== 'title') {
    dirty = false;
    draw();
    updateHud();
    syncPad();
  }
}

/* ------------------------------------------------------------------ */
/* overlays & menus                                                     */
/* ------------------------------------------------------------------ */

let bannerTimer = 0;
function banner(text) {
  const b = $('banner');
  b.textContent = text;
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 1700);
}

function openPanel(id) { $(id).hidden = false; }
const PANELS = ['panel-scores', 'panel-help', 'panel-options'];
function closePanels() { PANELS.forEach((id) => { $(id).hidden = true; }); }
const panelOpen = () => PANELS.some((id) => !$(id).hidden);

function applySettings() {
  const st = storage.data.settings;
  input.autofire = st.autofire;
  $('opt-autofire').textContent = 'AUTO-FIRE: ' + (st.autofire ? 'ON' : 'OFF');
  $('opt-pad').textContent = 'PAD: ' + (st.floating ? 'FLOATING' : 'FIXED');
  $('fire').classList.toggle('auto', st.autofire);
  $('fire').firstElementChild.textContent = st.autofire ? 'AUTO' : 'FIRE';
}
function toggleSetting(name) {
  storage.data.settings[name] = !storage.data.settings[name];
  storage.save();
  applySettings();
}

function renderScores() {
  const list = $('score-list');
  list.innerHTML = '';
  const t = storage.data.table;
  if (!t.length) { list.innerHTML = '<li class="empty">NO SCORES YET</li>'; return; }
  t.forEach((r, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${i + 1}.</span><span>${pad9(r.score)}</span><span>ST ${pad2(r.stage)}</span>`;
    list.appendChild(li);
  });
}

function refreshMenu() {
  $('stage-num').textContent = pad2(manage.sceneNum + 1);
  $('menu-high').textContent = 'HI ' + pad9(manage.highscore);
  const canPick = manage.lastScene > 0 || opts.cheat;
  $('stage-pick').hidden = !canPick;
}

function onState(state) {
  app.dataset.state = state;
  $('menu').hidden = state !== 'title';
  $('pause').hidden = state !== 'paused';
  if (state === 'title') { attract.start(); refreshMenu(); logoResize(); }
  else attract.stop();
  if (state === 'playing') { dirty = true; resizeGame(); }
  if (state === 'paused') { input.stickDir = 0; }
}

function startGame() {
  closePanels();
  $('gameover').hidden = true;
  manage.startKey();     // title -> playing
}

function onGameOver(r) {
  if (r.quit) { $('gameover').hidden = true; return; }
  $('gameover').hidden = false;
  const rank = r.rank ? `<br>RANK #${r.rank}` : '';
  const high = r.newHigh ? '<br><span style="color:var(--amber)">★ NEW HIGH SCORE ★</span>' : '';
  $('go-line').innerHTML = `SCORE ${pad9(r.score)}<br>REACHED STAGE ${pad2(r.stage)}${rank}${high}`;
  refreshMenu();
}

/* ------------------------------------------------------------------ */
/* boot                                                                 */
/* ------------------------------------------------------------------ */

let attract;
let logoResize = () => {};

function onCommand(c) {
  const st = manage.state;
  if (c === 'autofire') { toggleSetting('autofire'); return; }
  if (panelOpen()) {
    if (c === 'pause' || c === 'confirm' || c === 'key:Space') closePanels();
    return;
  }
  if (st === 'title') {
    if (c === 'confirm' || c === 'key:Space') startGame();
    else if (c === 'left' || c === 'key:ArrowLeft') { manage.stageMinus(); refreshMenu(); }
    else if (c === 'right' || c === 'key:ArrowRight') { manage.stagePlus(); refreshMenu(); }
  } else if (st === 'playing') {
    if (c === 'pause') manage.pause();
  } else if (st === 'paused') {
    if (c === 'pause' || c === 'confirm') manage.resume();
    else if (c === 'quit') manage.exitKey();
  }
}

function detectTouch(params) {
  const root = document.documentElement;
  const on = () => root.classList.add('touch');
  if (params.has('touch') || (matchMedia && matchMedia('(any-pointer: coarse)').matches)) on();
  addEventListener('touchstart', on, { once: true, passive: true });
}

async function boot() {
  const params = new URLSearchParams(location.search);
  opts.cheat = params.has('cheat');
  detectTouch(params);
  rand.init();

  try { await gfx.load('assets/sprites.png'); }
  catch (e) { $('loading').innerHTML = '<p>COULD NOT LOAD GRAPHICS</p>'; throw e; }

  radar.attach($('radar'));
  buildDpad();
  showDir(1, false);

  manage.hooks = {
    state: onState,
    stageStart: (n) => { dirty = true; banner('STAGE ' + n); },
    gameOver: onGameOver,
    lostShip: () => { try { navigator.vibrate && navigator.vibrate(140); } catch (e) { /* ignore */ } },
  };

  attract = makeAttract($('attract'));
  logoResize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const avail = Math.min(window.innerWidth * 0.86, 460);
    const b = Math.max(4, Math.floor(avail / 31));
    drawLogo($('logo'), b, dpr);
    attract.resize();
  };

  input.onCommand = onCommand;
  input.attachKeyboard();
  input.attachStick($('stickzone'), $('dpad'), {
    onDir: showDir,
    onKnob: (x, y) => knob.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`),
    floating: () => storage.data.settings.floating,
  });
  input.attachFire($('fire'), (on) => $('fire').classList.toggle('on', on));

  $('btn-start').addEventListener('click', startGame);
  $('stage-minus').addEventListener('click', () => { manage.stageMinus(); refreshMenu(); });
  $('stage-plus').addEventListener('click', () => { manage.stagePlus(); refreshMenu(); });
  $('btn-scores').addEventListener('click', () => { renderScores(); openPanel('panel-scores'); });
  $('btn-help').addEventListener('click', () => openPanel('panel-help'));
  $('btn-options').addEventListener('click', () => openPanel('panel-options'));
  $('btn-options2').addEventListener('click', () => openPanel('panel-options'));
  $('opt-autofire').addEventListener('click', () => toggleSetting('autofire'));
  $('opt-pad').addEventListener('click', () => toggleSetting('floating'));
  document.querySelectorAll('.close').forEach((b) => b.addEventListener('click', closePanels));
  $('btn-pause').addEventListener('click', () => manage.startKey());
  $('btn-resume').addEventListener('click', () => manage.resume());
  $('btn-quit').addEventListener('click', () => manage.exitKey());

  document.addEventListener('visibilitychange', () => { if (document.hidden) manage.pause(); });
  addEventListener('blur', () => manage.pause());
  addEventListener('resize', () => { resizeGame(); logoResize(); });
  addEventListener('orientationchange', () => setTimeout(() => { resizeGame(); logoResize(); }, 200));
  // stop iOS rubber-banding / pinch-zoom
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  manage.init();
  applySettings();
  $('loading').hidden = true;
  resizeGame();
  requestAnimationFrame(frame);

  // offline cache: only for real deployments (it just gets in the way on localhost; add ?sw to force)
  const dev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && (!dev || params.has('sw'))) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__xkobo = { manage, key, opts };   // handy for debugging in the console
}

boot();
