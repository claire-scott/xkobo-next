// Draws one frame of the playfield into a small WSIZE x WSIZE canvas (the original 226px window).
// main.js then scales that canvas up to the display with nearest-neighbour filtering.
import { WSIZE, BEAM_MAX, CHIP, SCREEN_SIZEX, SCREEN_SIZEY } from './config.js';
import { gfx } from './gfx.js';
import { myship } from './myship.js';
import { enemies, MOVING } from './enemy.js';

export const view = document.createElement('canvas');
view.width = WSIZE;
view.height = WSIZE;
const vctx = view.getContext('2d');
vctx.imageSmoothingEnabled = false;

const HALF = WSIZE >> 1;

/** copy the wrapped (torus) region of the backing store that the ship currently sees */
function drawBackground() {
  const vx = myship.virtx, vy = myship.virty;
  const w1 = Math.min(WSIZE, SCREEN_SIZEX - vx);
  const h1 = Math.min(WSIZE, SCREEN_SIZEY - vy);
  const w2 = WSIZE - w1, h2 = WSIZE - h1;
  const s = gfx.store;
  vctx.drawImage(s, vx, vy, w1, h1, 0, 0, w1, h1);
  if (w2 > 0) vctx.drawImage(s, 0, vy, w2, h1, w1, 0, w2, h1);
  if (h2 > 0) vctx.drawImage(s, vx, 0, w1, h2, 0, h1, w1, h2);
  if (w2 > 0 && h2 > 0) vctx.drawImage(s, 0, 0, w2, h2, w1, h1, w2, h2);
}

export function renderFrame() {
  if (!gfx.store) return view;
  drawBackground();
  const spr = gfx.sprites;

  if (myship.alive) {
    vctx.drawImage(spr, (myship.di - 1) * CHIP, 3 * CHIP, CHIP, CHIP,
                   HALF - CHIP / 2, HALF - CHIP / 2, CHIP, CHIP);
    for (let i = 0; i < BEAM_MAX; i++) {
      if (!myship.beamst[i]) continue;
      vctx.drawImage(spr, (myship.beamdi[i] - 1) * CHIP, 2 * CHIP, CHIP, CHIP,
                     myship.beamx[i] - myship.virtx - CHIP / 2,
                     myship.beamy[i] - myship.virty - CHIP / 2, CHIP, CHIP);
    }
  }

  const pool = enemies.pool;
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (e.state !== MOVING) continue;
    const k = e.ek;
    const size = k.chipsize;
    if (!size || e.norm >= HALF + 8) continue;
    vctx.drawImage(spr, (k.chipposx + e.di - 1) * CHIP, k.chipposy * CHIP, size, size,
                   e.diffx + HALF - (size >> 1), e.diffy + HALF - (size >> 1), size, size);
  }
  return view;
}
