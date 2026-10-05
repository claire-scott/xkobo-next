// Splash-screen visuals: pixel-font logo and a drifting starfield with passing enemies.
import { gfx } from './gfx.js';

const GLYPHS = {
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
};
const LOGO = 'XKOBO';

/** draw the logo with block size `b` css px; canvas backing store is scaled by dpr */
export function drawLogo(canvas, b, dpr = 1) {
  const cols = LOGO.length * 5 + (LOGO.length - 1);
  const w = cols * b, h = 7 * b;
  canvas.style.width = w + b + 'px';
  canvas.style.height = h + b + 'px';
  canvas.width = Math.round((w + b) * dpr);
  canvas.height = Math.round((h + b) * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#d9f3ff');
  grad.addColorStop(0.45, '#5ff0ff');
  grad.addColorStop(0.55, '#2a8fa8');
  grad.addColorStop(1, '#ff4fd0');
  const pass = (ox, oy, fill) => {
    ctx.fillStyle = fill;
    let cx = 0;
    for (const ch of LOGO) {
      GLYPHS[ch].forEach((row, y) => {
        for (let x = 0; x < 5; x++)
          if (row[x] === '1') ctx.fillRect(ox + (cx + x) * b, oy + y * b, b - 1, b - 1);
      });
      cx += 6;
    }
  };
  pass(b * 0.9, b * 0.9, '#0a1330');    // drop shadow
  pass(0, 0, grad);
}

export function makeAttract(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, running = false, raf = 0, last = 0;
  const stars = Array.from({ length: 140 }, () => ({
    x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8,
  }));
  const drifters = Array.from({ length: 7 }, () => ({
    x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.04, vy: 0.02 + Math.random() * 0.03,
  }));
  // sprite-sheet chips used as decoration: [col, row] of assorted enemies
  const pick = [[8, 0], [8, 1], [8, 2], [8, 3], [0, 4], [0, 5], [0, 6]];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      s.y += dt * 0.05 * s.z; s.x += dt * 0.012 * s.z;
      if (s.y > 1) { s.y -= 1; s.x = Math.random(); }
      if (s.x > 1) s.x -= 1;
      const a = 0.25 + s.z * 0.75;
      ctx.fillStyle = `rgba(${150 + s.z * 90 | 0},${170 + s.z * 70 | 0},255,${a})`;
      const sz = s.z > 0.8 ? 3 : 2;
      ctx.fillRect(Math.round(s.x * W), Math.round(s.y * H), sz, sz);
    }
    if (gfx.sprites) {
      ctx.imageSmoothingEnabled = false;
      const size = Math.max(32, Math.min(W, H) / 7) | 0;
      drifters.forEach((d, i) => {
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.y > 1.1) { d.y = -0.1; d.x = Math.random(); }
        if (d.x < -0.1) d.x = 1.1;
        if (d.x > 1.1) d.x = -0.1;
        const [cx, cy] = pick[i];
        ctx.globalAlpha = 0.5;
        ctx.drawImage(gfx.sprites, cx * 16, cy * 16, 16, 16, d.x * W, d.y * H, size, size);
      });
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    start() { if (running) return; running = true; resize(); last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    resize,
  };
}
