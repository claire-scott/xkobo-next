// Port of xkobo myship.C
import { BEAM_MAX, WSIZE, SCREEN_SIZEX, SCREEN_SIZEY, HIT_MASK } from './config.js';
import { opts } from './opts.js';
import { key } from './key.js';
import { screen } from './screen.js';
import { manage } from './manage.js';
import { enemies, explosion } from './enemy.js';
import { rand } from './random.js';

const BEAMV1 = 12;
const BEAMV2 = (BEAMV1 * 2 / 3) | 0;
const NORMAL = 0, DEAD = 1;
const ABS = Math.abs;

class MyShip {
  constructor() {
    this.state = NORMAL;
    this.di = 1;
    this.virtx = 0; this.virty = 0;   // scroll position (top-left of the view)
    this.x = 0; this.y = 0;           // ship centre
    this.lapx = 0; this.lapy = 0;
    this.beamx = new Int32Array(BEAM_MAX);
    this.beamy = new Int32Array(BEAM_MAX);
    this.beamdi = new Int32Array(BEAM_MAX);
    this.beamst = new Int32Array(BEAM_MAX);
  }

  init() {
    this.x = SCREEN_SIZEX >> 1;
    this.y = (SCREEN_SIZEY >> 2) * 3;
    this.virtx = this.x - (WSIZE >> 1);
    this.virty = this.y - (WSIZE >> 1);
    this.lapx = 0;
    this.lapy = 0;
    this.di = 1;
    this.state = NORMAL;
    this.beamx.fill(0); this.beamy.fill(0); this.beamdi.fill(0); this.beamst.fill(0);
  }

  get alive() { return this.state === NORMAL; }

  move() {
    this.di = key.direction;

    this.virtx = this.x - (WSIZE >> 1);
    this.virty = this.y - (WSIZE >> 1);
    if (this.state === NORMAL) {
      switch (this.di) {
        case 1: this.virty -= 3; break;
        case 2: this.virty -= 2; this.virtx += 2; break;
        case 3: this.virtx += 3; break;
        case 4: this.virtx += 2; this.virty += 2; break;
        case 5: this.virty += 3; break;
        case 6: this.virty += 2; this.virtx -= 2; break;
        case 7: this.virtx -= 3; break;
        case 8: this.virtx -= 2; this.virty -= 2; break;
      }
    } else {
      enemies.make(explosion, this.x + rand.bits(6) - 32, this.y + rand.bits(6) - 32);
    }

    this.lapx = 0;
    this.lapy = 0;
    if (this.virtx < 0) { this.virtx += SCREEN_SIZEX; this.lapx = SCREEN_SIZEX; }
    if (this.virtx >= SCREEN_SIZEX) { this.virtx -= SCREEN_SIZEX; this.lapx = -SCREEN_SIZEX; }
    if (this.virty < 0) { this.virty += SCREEN_SIZEY; this.lapy = SCREEN_SIZEY; }
    if (this.virty >= SCREEN_SIZEY) { this.virty -= SCREEN_SIZEY; this.lapy = -SCREEN_SIZEY; }
    this.x = this.virtx + (WSIZE >> 1);
    this.y = this.virty + (WSIZE >> 1);

    if (this.state === NORMAL && key.shot) this.shot();

    for (let i = 0; i < BEAM_MAX; i++) {
      if (!this.beamst[i]) continue;
      this.beamx[i] += this.lapx;
      this.beamy[i] += this.lapy;
      switch (this.beamdi[i]) {
        case 1: this.beamy[i] -= BEAMV1; break;
        case 2: this.beamy[i] -= BEAMV2; this.beamx[i] += BEAMV2; break;
        case 3: this.beamx[i] += BEAMV1; break;
        case 4: this.beamx[i] += BEAMV2; this.beamy[i] += BEAMV2; break;
        case 5: this.beamy[i] += BEAMV1; break;
        case 6: this.beamy[i] += BEAMV2; this.beamx[i] -= BEAMV2; break;
        case 7: this.beamx[i] -= BEAMV1; break;
        case 8: this.beamx[i] -= BEAMV2; this.beamy[i] -= BEAMV2; break;
      }
      if (ABS(this.beamx[i] - this.x) >= (WSIZE >> 1) + 16 ||
          ABS(this.beamy[i] - this.y) >= (WSIZE >> 1) + 16)
        this.beamst[i] = 0;
    }
  }

  destroyed() {
    if (this.state !== NORMAL) return;
    manage.lostMyship();
    this.state = DEAD;
  }

  hitStructure() {
    for (let i = 0; i < BEAM_MAX; i++) {
      if (!this.beamst[i]) continue;
      const x1 = (this.beamx[i] & (SCREEN_SIZEX - 1)) >> 4;
      const y1 = (this.beamy[i] & (SCREEN_SIZEY - 1)) >> 4;
      if (screen.getChipNumber(x1, y1) & HIT_MASK) this.beamst[i] = 0;
    }
    const x1 = (this.x & (SCREEN_SIZEX - 1)) >> 4;
    const y1 = (this.y & (SCREEN_SIZEY - 1)) >> 4;
    if (screen.getChipNumber(x1, y1) & HIT_MASK) this.destroyed();
  }

  hitBeam(ex, ey, hitsize) {
    for (let i = 0; i < BEAM_MAX; i++) {
      if (this.beamst[i] === 0) continue;
      if (ABS(ex - this.beamx[i]) >= hitsize) continue;
      if (ABS(ey - this.beamy[i]) >= hitsize) continue;
      if (!opts.cheat) this.beamst[i] = 0;
      return 1;
    }
    return 0;
  }

  /** fires a pair of beams (forwards and backwards) */
  shot() {
    let i, j;
    for (i = 0; i < BEAM_MAX && this.beamst[i]; i++);
    for (j = i + 1; j < BEAM_MAX && this.beamst[j]; j++);
    if (j >= BEAM_MAX) return 1;
    this.beamdi[i] = this.di;
    this.beamx[i] = this.x;
    this.beamy[i] = this.y;
    this.beamst[i] = 1;
    this.beamdi[j] = this.di > 4 ? this.di - 4 : this.di + 4;
    this.beamx[j] = this.x;
    this.beamy[j] = this.y;
    this.beamst[j] = 1;
    return 0;
  }

  setPosition(px, py) {
    this.x = px;
    this.y = py;
    this.virtx = this.x - (WSIZE >> 1);
    this.virty = this.y - (WSIZE >> 1);
  }
}

export const myship = new MyShip();
