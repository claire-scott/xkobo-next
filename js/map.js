import { MAP_SIZEX, MAP_SIZEY, MAP_SIZEX_LOG2, SPACE, WALL, CORE,
         U_MASK, R_MASK, D_MASK, L_MASK, HARD } from './config.js';
import { rand } from './random.js';

const SITE_MAX = 1024;

/** 64x128 grid of 16px cells; builds the maze-like fortresses. */
export class GameMap {
  constructor() {
    this.data = new Uint8Array(MAP_SIZEX * MAP_SIZEY);
    this.sitex = new Int32Array(SITE_MAX);
    this.sitey = new Int32Array(SITE_MAX);
    this.siteMax = 0;
  }

  get(x, y) { return this.data[(y << MAP_SIZEX_LOG2) + x]; }
  set(x, y, v) { this.data[(y << MAP_SIZEX_LOG2) + x] = v; }

  init() { this.data.fill(SPACE); }

  makeMaze(x, y, difx, dify) {
    for (let i = x - difx; i <= x + difx; i++)
      for (let j = y - dify; j <= y + dify; j++)
        this.set(i, j, SPACE);
    this.set(x, y, CORE);

    this.siteMax = 0;
    if (rand.bits(8) < 128) {
      this.push(x - 1, y);
      this.push(x + 1, y);
    } else {
      this.push(x, y - 1);
      this.push(x, y + 1);
    }

    for (;;) {
      if (this.pop()) break;
      const vx = this.sitex[this.siteMax];
      const vy = this.sitey[this.siteMax];

      const dirs = [];
      if (this.judge(x, y, difx, dify, vx + 2, vy)) dirs.push(1);
      if (this.judge(x, y, difx, dify, vx, vy + 2)) dirs.push(2);
      if (this.judge(x, y, difx, dify, vx - 2, vy)) dirs.push(3);
      if (this.judge(x, y, difx, dify, vx, vy - 2)) dirs.push(4);
      if (dirs.length === 0) continue;
      const d = dirs[rand.get() % dirs.length];
      this.moveAndPush(vx, vy, d);
      this.push(vx, vy);
    }
  }

  pop() {
    if (this.siteMax === 0) return 1;
    const i = rand.get() % this.siteMax;
    this.siteMax--;
    if (i !== this.siteMax) {
      const tx = this.sitex[this.siteMax], ty = this.sitey[this.siteMax];
      this.sitex[this.siteMax] = this.sitex[i];
      this.sitey[this.siteMax] = this.sitey[i];
      this.sitex[i] = tx;
      this.sitey[i] = ty;
    }
    return 0;
  }

  push(x, y) {
    this.sitex[this.siteMax] = x;
    this.sitey[this.siteMax++] = y;
    this.set(x, y, WALL);
  }

  moveAndPush(x, y, d) {
    let x1 = x, y1 = y;
    switch (d) {
      case 1: x1 += 2; break;
      case 2: y1 += 2; break;
      case 3: x1 -= 2; break;
      case 4: y1 -= 2; break;
    }
    this.push(x1, y1);
    this.set((x + x1) >> 1, (y + y1) >> 1, WALL);
  }

  judge(cx, cy, dx, dy, x, y) {
    if (x < cx - dx || x > cx + dx || y < cy - dy || y > cy + dy) return 0;
    if (this.get(x, y) === WALL) return 0;
    return 1;
  }

  /** Turn raw WALL cells into connection-mask wall pieces; some dead-ends become HARD. */
  convert(ratio) {
    const sx = MAP_SIZEX, sy = MAP_SIZEY;
    for (let i = 0; i < sx; i++)
      for (let j = 0; j < sy; j++) {
        if (this.get(i, j) !== WALL) continue;
        let p = 0;
        if (j > 0 && this.get(i, j - 1) !== SPACE) p |= U_MASK;
        if (i < sx - 1 && this.get(i + 1, j) !== SPACE) p |= R_MASK;
        if (j < sy - 1 && this.get(i, j + 1) !== SPACE) p |= D_MASK;
        if (i > 0 && this.get(i - 1, j) !== SPACE) p |= L_MASK;
        if (p === U_MASK || p === R_MASK || p === D_MASK || p === L_MASK) {
          if (rand.bits(8) < ratio) p |= HARD;
        }
        this.set(i, j, p);
      }
  }
}
