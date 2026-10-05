// Port of xkobo enemy.C / enemies.C / enemies.h  (GPL v2, (c) 1995,1996 Akira Higuchi)
// Behaviour (incl. fixed-point maths and RNG call order) is kept faithful to the original.
import { ENEMY_MAX, WSIZE, SHIFT, SCREEN_SIZEX, SCREEN_SIZEY, HIT_MYSHIP, HIT_BEAM,
         U_MASK, R_MASK, D_MASK, L_MASK, CORE, HARD } from './config.js';
import { rand } from './random.js';
import { myship } from './myship.js';
import { manage } from './manage.js';
import { screen } from './screen.js';
import { radar } from './radar.js';

const NOTUSE = 0, RESERVED = 1, MOVING = 2;
const ABS = Math.abs;
const MAX = Math.max;

/* ------------------------------------------------------------------ */
/* movement / shooting templates                                       */
/* ------------------------------------------------------------------ */

function pickDirection(e) {
  const h = e.h, v = e.v;
  const m = MAX(MAX(h, -h), MAX(v, -v));
  if (m === h) {
    if ((m >> 1) < v) e.di = 4;
    else if ((m >> 1) < -v) e.di = 2;
    else e.di = 3;
  } else if (m === -h) {
    if ((m >> 1) < v) e.di = 6;
    else if ((m >> 1) < -v) e.di = 8;
    else e.di = 7;
  } else if (m === v) {
    if ((m >> 1) < h) e.di = 4;
    else if ((m >> 1) < -h) e.di = 6;
    else e.di = 5;
  } else {
    if ((m >> 1) < h) e.di = 2;
    else if ((m >> 1) < -h) e.di = 8;
    else e.di = 1;
  }
}

function accelerate(e, quick, maxspeed) {
  if (e.diffx > 0) { if (e.h > -maxspeed) e.h -= quick; }
  else if (e.diffx < 0) { if (e.h < maxspeed) e.h += quick; }
  if (e.diffy > 0) { if (e.v > -maxspeed) e.v -= quick; }
  else if (e.diffy < 0) { if (e.v < maxspeed) e.v += quick; }
}

// chase the ship
function moveTemplate(e, quick, maxspeed) {
  accelerate(e, quick, maxspeed);
  pickDirection(e);
}
// circle the ship (one way)
function moveTemplate2(e, quick, maxspeed) {
  e.h = -(e.diffy << (SHIFT - quick));
  e.v = (e.diffx << (SHIFT - quick));
  accelerate(e, quick, maxspeed);
  pickDirection(e);
}
// circle the ship (other way)
function moveTemplate3(e, quick, maxspeed) {
  e.h = (e.diffy << (SHIFT - quick));
  e.v = -(e.diffx << (SHIFT - quick));
  accelerate(e, quick, maxspeed);
  pickDirection(e);
}

function shotTemplate(e, ekp, shift, rnd, maxspeed) {
  let vx = -e.diffx;
  let vy = -e.diffy;
  if (rnd) {
    // original: rand_num.get() & (rnd-1) - (rnd>>1)   (minus binds tighter than &)
    const mask = (rnd - 1) - (rnd >> 1);
    vx += rand.get() & mask;
    vy += rand.get() & mask;
  }
  vx <<= (SHIFT - shift);
  vy <<= (SHIFT - shift);
  if (maxspeed > 0) {
    if (vx > maxspeed) vx = maxspeed;
    else if (vx < -maxspeed) vx = -maxspeed;
    if (vy > maxspeed) vy = maxspeed;
    else if (vy < -maxspeed) vy = -maxspeed;
  }
  enemies.make(ekp, (e.x + vx) >> SHIFT, (e.y + vy) >> SHIFT, vx, vy);
}

const SHOT8_VX = [0, 200, 300, 200, 0, -200, -300, -200];
const SHOT8_VY = [-300, -200, 0, 200, 300, 200, 0, -200];
function shotTemplate8Dir(e, ekp) {
  for (let i = 0; i < 8; i++)
    enemies.make(ekp, e.x >> SHIFT, e.y >> SHIFT, SHOT8_VX[i], SHOT8_VY[i]);
}

const kind = (score, make, move, hitsize, chipposx, chipposy, chipsize) =>
  ({ score, make, move, hitsize, chipposx, chipposy, chipsize });

/* ------------------------------------------------------------------ */
/* enemy kinds                                                         */
/* ------------------------------------------------------------------ */

export const beam = kind(0,
  (e) => { e.di = 1; e.shield = -1; },
  (e) => {
    if (e.norm >= ((WSIZE >> 1) + 32)) e.state = NOTUSE;
    if (++e.di > 8) e.di = 1;
  },
  2, 0, 0, 6);

export const rock = kind(10,
  (e) => { e.count = 500; e.shield = 255; e.di = (rand.get() % 3) + 1; },
  () => {},
  4, 11, 4, 16);

export const ring = kind(1,
  (e) => { e.count = 500; e.shield = 1; e.di = 1; },
  () => {},
  4, 15, 4, 16);

function makeBomb(e) { e.count = 500; e.shield = 1; e.di = 1; }

export const bomb1 = kind(5, makeBomb,
  (e) => {
    const h1 = ABS(e.diffx), v1 = ABS(e.diffy);
    if ((h1 < 100 && v1 < 30) || (h1 < 30 && v1 < 100)) {
      const vx1 = Math.trunc(((-e.diffx) << (SHIFT - 3)) / 3);
      const vy1 = Math.trunc(((-e.diffy) << (SHIFT - 3)) / 3);
      let vx2 = vx1, vx3 = vx1, vy2 = vy1, vy3 = vy1;
      for (let i = 0; i < 4; i++) {
        let tmp = vx2;
        vx2 += (vy2 >> 4);
        vy2 -= (tmp >> 4);
        tmp = vx3;
        vx3 -= (vy3 >> 4);
        vy3 += (tmp >> 4);
      }
      enemies.make(beam, e.x >> SHIFT, e.y >> SHIFT, vx2, vy2);
      enemies.make(beam, e.x >> SHIFT, e.y >> SHIFT, vx3, vy3);
      e.state = NOTUSE;
    }
  },
  5, 14, 4, 16);

export const bomb2 = kind(20, makeBomb,
  (e) => {
    const h1 = ABS(e.diffx), v1 = ABS(e.diffy);
    if ((h1 < 100 && v1 < 20) || (h1 < 20 && v1 < 100)) {
      const vx1 = Math.trunc(((-e.diffx) << (SHIFT - 3)) / 3);
      const vy1 = Math.trunc(((-e.diffy) << (SHIFT - 3)) / 3);
      let vx2 = vx1, vx3 = vx1, vy2 = vy1, vy3 = vy1;
      let i, tmp;
      for (i = 0; i < 6; i++) {
        tmp = vx2; vx2 += (vy2 >> 4); vy2 -= (tmp >> 4);
        tmp = vx3; vx3 -= (vy3 >> 4); vy3 += (tmp >> 4);
      }
      const vx4 = vx2, vx5 = vx3, vy4 = vy2, vy5 = vy3;
      for (i = 0; i < 6; i++) {
        tmp = vx2; vx2 += (vy2 >> 4); vy2 -= (tmp >> 4);
        tmp = vx3; vx3 -= (vy3 >> 4); vy3 += (tmp >> 4);
      }
      const px = e.x >> SHIFT, py = e.y >> SHIFT;
      enemies.make(beam, px, py, vx1, vy1);
      enemies.make(beam, px, py, vx2, vy2);
      enemies.make(beam, px, py, vx3, vy3);
      enemies.make(beam, px, py, vx4, vy4);
      enemies.make(beam, px, py, vx5, vy5);
      e.state = NOTUSE;
    }
  },
  5, 14, 4, 16);

export const explosion = kind(0,
  (e) => { e.di = 0; e.shield = -1; },
  (e) => { if (++e.di > 8) e.state = NOTUSE; },
  -1, 0, 1, 16);

export const cannon = kind(10,
  (e) => {
    e.count = 0;
    e.shield = 1;
    e.b = enemies.eint1 - 1;
    e.a = rand.get() & e.b;
  },
  (e) => {
    e.count = (e.count + 1) & e.b;
    if (e.count === e.a && e.norm < ((WSIZE >> 1) + 8)) {
      const shift = (enemies.ek1 === beam) ? 6 : 5;
      shotTemplate(e, enemies.ek1, shift, 32, 0);
    }
  },
  4, 0, 0, 0);

export const core = kind(200,
  (e) => {
    e.count = 0;
    e.shield = 1;
    e.b = enemies.eint2 - 1;
    e.a = rand.get() & e.b;
  },
  (e) => {
    e.count = (e.count + 1) & e.b;
    if (e.count === e.a && e.norm < ((WSIZE >> 1) + 8)) {
      const shift = (enemies.ek2 === beam) ? 6 : 5;
      shotTemplate(e, enemies.ek2, shift, 0, 0);
    }
  },
  4, 0, 0, 0);

// A burning fuse that eats along the fortress walls
export const pipe1 = kind(0,
  (e) => { e.shield = -1; e.count = 4; e.a = 0; },
  (e) => {
    if (e.norm < ((WSIZE >> 1) + 32) && e.count === 1)
      enemies.make(explosion, (e.x >> SHIFT) + rand.bits(4) - 8, (e.y >> SHIFT) + rand.bits(4) - 8);
    if (++e.count < 4) return;
    e.count = 0;
    const x1 = ((e.x >> SHIFT) & (SCREEN_SIZEX - 1)) >> 4;
    const y1 = ((e.y >> SHIFT) & (SCREEN_SIZEY - 1)) >> 4;
    let aNext = 0, xNext = 0, yNext = 0;
    let p = screen.getChipNumber(x1, y1);
    if (p === 0) { e.state = NOTUSE; return; }
    if (e.norm < ((WSIZE >> 1) + 32))
      enemies.make(explosion, e.x >> SHIFT, e.y >> SHIFT);
    if ((p ^ e.a) === U_MASK) { aNext = D_MASK; yNext = -(16 << SHIFT); }
    if ((p ^ e.a) === R_MASK) { aNext = L_MASK; xNext = (16 << SHIFT); }
    if ((p ^ e.a) === D_MASK) { aNext = U_MASK; yNext = (16 << SHIFT); }
    if ((p ^ e.a) === L_MASK) { aNext = R_MASK; xNext = -(16 << SHIFT); }
    if (aNext) {
      screen.setChipNumber(x1, y1, 0);
      e.x += xNext;
      e.y += yNext;
      e.a = aNext;
      return;
    }
    if (p !== CORE) {
      p ^= e.a;
      screen.setChipNumber(x1, y1, p);
    }
    e.state = NOTUSE;
  },
  -1, 0, 0, 0);

export const pipe2 = kind(0,
  (e) => {
    const x1 = ((e.x >> SHIFT) & (SCREEN_SIZEX - 1)) >> 4;
    const y1 = ((e.y >> SHIFT) & (SCREEN_SIZEY - 1)) >> 4;
    screen.setChipNumber(x1, y1, 0);
    e.shield = -1;
    e.count = 4;
    switch (e.di) {
      case 1: e.a = D_MASK; e.y -= (16 << SHIFT); break;
      case 3: e.a = L_MASK; e.x += (16 << SHIFT); break;
      case 5: e.a = U_MASK; e.y += (16 << SHIFT); break;
      case 7: e.a = R_MASK; e.x -= (16 << SHIFT); break;
    }
  },
  (e) => {
    if (e.norm < ((WSIZE >> 1) + 32) && e.count === 1)
      enemies.make(explosion, (e.x >> SHIFT) + rand.bits(4) - 8, (e.y >> SHIFT) + rand.bits(4) - 8);
    if (++e.count < 4) return;
    e.count = 0;
    const x1 = ((e.x >> SHIFT) & (SCREEN_SIZEX - 1)) >> 4;
    const y1 = ((e.y >> SHIFT) & (SCREEN_SIZEY - 1)) >> 4;
    let aNext = 0, xNext = 0, yNext = 0;
    let p = screen.getChipNumber(x1, y1);
    if (p === 0) { e.state = NOTUSE; return; }
    if (e.norm < ((WSIZE >> 1) + 32))
      enemies.make(explosion, e.x >> SHIFT, e.y >> SHIFT);
    if ((p ^ e.a) === 0) {
      manage.addScore(30);
      e.state = NOTUSE;
      enemies.eraseCannon(x1, y1);
      screen.setChipNumber(x1, y1, 0);
      return;
    }
    if ((p ^ e.a) === HARD) {
      e.state = NOTUSE;
      screen.setChipNumber(x1, y1, 0);
      return;
    }
    if ((p ^ e.a) === U_MASK) { aNext = D_MASK; yNext = -(16 << SHIFT); }
    if ((p ^ e.a) === R_MASK) { aNext = L_MASK; xNext = (16 << SHIFT); }
    if ((p ^ e.a) === D_MASK) { aNext = U_MASK; yNext = (16 << SHIFT); }
    if ((p ^ e.a) === L_MASK) { aNext = R_MASK; xNext = -(16 << SHIFT); }
    screen.setChipNumber(x1, y1, 0);
    if (aNext) {
      e.x += xNext;
      e.y += yNext;
      e.a = aNext;
      return;
    }
    p ^= e.a;
    const px = e.x >> SHIFT, py = e.y >> SHIFT;
    if (p & U_MASK) enemies.make(pipe2, px, py, 0, 0, 1);
    if (p & R_MASK) enemies.make(pipe2, px, py, 0, 0, 3);
    if (p & D_MASK) enemies.make(pipe2, px, py, 0, 0, 5);
    if (p & L_MASK) enemies.make(pipe2, px, py, 0, 0, 7);
    manage.addScore(10);
    e.state = NOTUSE;
  },
  -1, 0, 0, 0);

export const enemy1 = kind(2,
  (e) => { e.di = 1; e.shield = 1; },
  (e) => moveTemplate(e, 2, 256),
  6, 8, 0, 16);

export const enemy2 = kind(10,
  (e) => { e.di = 1; e.shield = 1; e.count = rand.get() & 63; },
  (e) => {
    moveTemplate(e, 4, 192);
    if (--e.count <= 0) {
      if (e.norm < ((WSIZE >> 1) + 8)) shotTemplate(e, beam, 5, 0, 0);
      e.count = 32;
    }
  },
  6, 8, 1, 16);

export const enemy3 = kind(1,
  (e) => { e.di = 1; e.shield = 1; },
  (e) => moveTemplate(e, 32, 96),
  6, 8, 2, 16);

export const enemy4 = kind(1,
  (e) => { e.di = 1; e.shield = 1; },
  (e) => moveTemplate(e, 4, 96),
  6, 8, 3, 16);

function makeEnemy5(e) { e.count = rand.get() & 127; e.di = 1; e.shield = 1; e.a = 0; }

export const enemy5 = kind(5, makeEnemy5,
  (e) => {
    if (e.a === 0) {
      if (e.norm > ((WSIZE >> 1) - 32)) moveTemplate(e, 6, 192);
      else e.a = 1;
    } else {
      if (e.norm < WSIZE) moveTemplate2(e, 4, 192);
      else e.a = 0;
    }
    if (--e.count <= 0) {
      e.count = 8;
      if (e.norm > ((WSIZE >> 1) - 32)) shotTemplate(e, beam, 6, 0, 0);
    }
  },
  6, 0, 4, 16);

export const enemy6 = kind(2, makeEnemy5,
  (e) => {
    if (e.a === 0) {
      if (e.norm > ((WSIZE >> 1) - 0)) moveTemplate(e, 6, 192);
      else e.a = 1;
    } else {
      if (e.norm < WSIZE) moveTemplate2(e, 5, 192);
      else e.a = 0;
    }
    if (--e.count <= 0) {
      e.count = 128;
      if (e.norm > ((WSIZE >> 1) - 32)) shotTemplate(e, beam, 6, 0, 0);
    }
  },
  6, 0, 5, 16);

export const enemy7 = kind(5, makeEnemy5,
  (e) => {
    if (e.a === 0) {
      if (e.norm > ((WSIZE >> 1) - 32)) moveTemplate(e, 6, 192);
      else e.a = 1;
    } else {
      if (e.norm < WSIZE) moveTemplate3(e, 4, 192);
      else e.a = 0;
    }
    if (--e.count <= 0) {
      e.count = 8;
      if (e.norm > ((WSIZE >> 1) - 32)) shotTemplate(e, beam, 6, 0, 0);
    }
  },
  6, 0, 6, 16);

// mid-bosses
function makeMid(e) { e.di = 1; e.shield = 26; e.count = rand.get() & 15; }

export const enemy_m1 = kind(50, makeMid,
  (e) => {
    moveTemplate(e, 3, 128);
    e.di = 1;
    if (e.count-- <= 0) {
      e.count = 4;
      if (e.norm < ((WSIZE >> 1) - 16)) shotTemplate(e, enemy1, 4, 0, 0);
    }
    if (e.shield < 10) { shotTemplate8Dir(e, enemy2); e.state = NOTUSE; }
  },
  12, 8, 4, 32);

export const enemy_m2 = kind(50, makeMid,
  (e) => {
    moveTemplate(e, 3, 128);
    e.di = 1;
    if (e.count-- <= 0) {
      e.count = 8;
      if (e.norm < ((WSIZE >> 1) + 8)) shotTemplate(e, enemy2, 4, 128, 192);
    }
    if (e.shield < 10) { shotTemplate8Dir(e, bomb2); e.state = NOTUSE; }
  },
  12, 8, 4, 32);

export const enemy_m3 = kind(50, makeMid,
  (e) => {
    moveTemplate(e, 3, 128);
    e.di = 1;
    if (e.count-- <= 0) {
      e.count = 64;
      if (e.norm < ((WSIZE >> 1) + 8)) shotTemplate8Dir(e, bomb2);
    }
    if (e.shield < 10) { shotTemplate8Dir(e, rock); e.state = NOTUSE; }
  },
  12, 8, 4, 32);

export const enemy_m4 = kind(100, makeMid,
  (e) => {
    moveTemplate(e, 2, 96);
    e.di = 1;
    const shot = [enemy1, enemy2, bomb2, ring, enemy1, enemy2, ring, enemy1];
    if (e.count-- <= 0) {
      e.count = 64;
      if (e.norm < ((WSIZE >> 1) + 8)) shotTemplate8Dir(e, shot[rand.get() & 7]);
    }
    if (e.shield < 10) { shotTemplate8Dir(e, rock); e.state = NOTUSE; }
  },
  12, 8, 4, 32);

export const kinds = {
  beam, rock, ring, bomb1, bomb2, explosion, cannon, core, pipe1, pipe2,
  enemy1, enemy2, enemy3, enemy4, enemy5, enemy6, enemy7,
  enemy_m1, enemy_m2, enemy_m3, enemy_m4,
};

/* ------------------------------------------------------------------ */
/* the enemy object + pool                                             */
/* ------------------------------------------------------------------ */

class Enemy {
  constructor() {
    this.state = NOTUSE;
    this.ek = null;
    this.x = 0; this.y = 0; this.h = 0; this.v = 0;
    this.di = 0; this.a = 0; this.b = 0;
    this.count = 0; this.shield = 0;
    this.diffx = 0; this.diffy = 0; this.norm = 0;
    this.hitsize = 0;
  }

  make(k, px, py, h1, v1, dir) {
    if (this.state !== NOTUSE) return false;
    this.state = RESERVED;
    this.ek = k;
    this.x = px << SHIFT;
    this.y = py << SHIFT;
    this.di = dir;
    this.h = h1;
    this.v = v1;
    this.a = 0;
    this.b = 0;
    this.count = 0;
    this.shield = 1;
    this.hitsize = k.hitsize;
    k.make(this);
    return true;
  }

  hitByBeam() {
    if (--this.shield > 0) return;
    manage.addScore(this.ek.score);
    const ek = this.ek;
    if (ek === cannon) {
      enemies.make(pipe1, this.x >> SHIFT, this.y >> SHIFT);
      this.state = NOTUSE;
    } else if (ek === core) {
      const px = this.x >> SHIFT, py = this.y >> SHIFT;
      enemies.make(pipe2, px, py, 0, 0, 3);
      enemies.make(pipe2, px, py, 0, 0, 7);
      enemies.make(pipe2, px, py, 0, 0, 1);
      enemies.make(pipe2, px, py, 0, 0, 5);
      enemies.make(explosion, px, py);
      this.state = NOTUSE;
      manage.destroyedACore();
    } else {
      enemies.make(explosion, this.x >> SHIFT, this.y >> SHIFT);
      this.state = NOTUSE;
    }
  }

  eraseCannon(px, py) {
    if (this.state !== NOTUSE && this.ek === cannon &&
        ((((this.x >> SHIFT) & (SCREEN_SIZEX - 1)) >> 4) === px) &&
        ((((this.y >> SHIFT) & (SCREEN_SIZEY - 1)) >> 4) === py)) {
      this.state = NOTUSE;
      return 1;
    }
    return 0;
  }

  move() {
    if (this.state !== MOVING) return;
    this.x += this.h;
    this.y += this.v;
    this.diffx = (this.x >> SHIFT) - myship.x;
    this.diffy = (this.y >> SHIFT) - myship.y;

    if (this.diffx > (SCREEN_SIZEX >> 1)) { this.diffx -= SCREEN_SIZEX; this.x -= (SCREEN_SIZEX << SHIFT); }
    if (this.diffx < -(SCREEN_SIZEX >> 1)) { this.diffx += SCREEN_SIZEX; this.x += (SCREEN_SIZEX << SHIFT); }
    if (this.diffy > (SCREEN_SIZEY >> 1)) { this.diffy -= SCREEN_SIZEY; this.y -= (SCREEN_SIZEY << SHIFT); }
    if (this.diffy < -(SCREEN_SIZEY >> 1)) { this.diffy += SCREEN_SIZEY; this.y += (SCREEN_SIZEY << SHIFT); }

    this.norm = MAX(ABS(this.diffx), ABS(this.diffy));
    this.ek.move(this);
    if (this.hitsize >= 0 && this.norm < (this.hitsize + HIT_MYSHIP))
      myship.destroyed();
    if (this.shield < 0 || this.norm >= ((WSIZE >> 1) + 8)) return;
    if (myship.hitBeam(this.x >> SHIFT, this.y >> SHIFT, this.hitsize + HIT_BEAM))
      this.hitByBeam();
  }

  realize() {
    if (this.state === RESERVED) this.state = MOVING;
    return this.state === MOVING;
  }

  isPipe() {
    return this.state !== NOTUSE && (this.ek === pipe1 || this.ek === pipe2);
  }
}

class Enemies {
  constructor() {
    this.pool = Array.from({ length: ENEMY_MAX }, () => new Enemy());
    this.ek1 = null; this.ek2 = null;
    this.eint1 = 1; this.eint2 = 1;
  }

  init() {
    for (const e of this.pool) e.state = NOTUSE;
    this.ek1 = this.ek2 = null;
    this.eint1 = this.eint2 = 1;
  }

  move() {
    const pool = this.pool;
    let last = -1;
    for (let i = 0; i < ENEMY_MAX; i++)
      if (pool[i].realize()) last = i;
    for (let i = 0; i <= last; i++) pool[i].move();
  }

  /** returns true if the pool was full (matches the original's non-zero return) */
  make(ek, x, y, h = 0, v = 0, di = 0) {
    const pool = this.pool;
    for (let i = 0; i < ENEMY_MAX; i++)
      if (pool[i].make(ek, x, y, h, v, di)) return false;
    return true;
  }

  eraseCannon(x, y) {
    let count = 0;
    for (const e of this.pool) count += e.eraseCannon(x, y);
    if (count) radar.erase(x, y);
    return count;
  }

  existPipe() {
    let count = 0;
    for (const e of this.pool) if (e.isPipe()) count++;
    return count;
  }

  setEkindToGenerate(e1, i1, e2, i2) {
    this.ek1 = e1; this.ek2 = e2;
    this.eint1 = i1; this.eint2 = i2;
  }
}

export const enemies = new Enemies();
export { MOVING };
