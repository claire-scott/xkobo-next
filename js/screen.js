// Port of xkobo screen.C -- stage setup, the map and its pre-rendered backing store
import { MAP_SIZEX, MAP_SIZEY, SCREEN_SIZEX, SCREEN_SIZEY, SCREEN_SIZEX_LOG2, SCREEN_SIZEY_LOG2,
         CHIP, WSIZE, SHIFT, SPACE, CORE, HARD, U_MASK, R_MASK, D_MASK, L_MASK } from './config.js';
import { GameMap } from './map.js';
import { scenes } from './scenes.js';
import { rand } from './random.js';
import { gfx } from './gfx.js';
import { radar } from './radar.js';
import { myship } from './myship.js';
import { enemies, kinds, cannon, core } from './enemy.js';

const SINT = [0, 12, 23, 30, 32, 30, 23, 12, 0, -12, -23, -30, -32, -30, -23, -12];
const COST = [32, 30, 23, 12, 0, -12, -23, -30, -32, -30, -23, -12, 0, 12, 23, 30];

// star colours (xkobo allocated these as 16-bit RGB: 40000, 15000+i*4000, 50000-i*5000)
const STAR_COLORS = Array.from({ length: 8 }, (_, i) =>
  `rgb(${40000 >> 8},${(15000 + i * 4000) >> 8},${(50000 - i * 5000) >> 8})`);

class Screen {
  constructor() {
    this.map = new GameMap();
    this.sceneNum = -1;
    this.level = 0;
    this.generateCount = 0;
    this.sceneMax = scenes.length;
  }

  /** draw map cell n into the backing store at cell (posx,posy) */
  copyAChip(n, posx, posy) {
    let x = n, y = 7;
    if (n & HARD) {
      y = 6;
      if (n & U_MASK) x = 8;
      else if (n & R_MASK) x = 9;
      else if (n & D_MASK) x = 10;
      else if (n & L_MASK) x = 11;
    } else if (n & CORE) {
      y = 6;
      x = 15;
    }
    gfx.storeCtx.drawImage(gfx.chips, x * CHIP, y * CHIP, CHIP, CHIP,
                           posx * CHIP, posy * CHIP, CHIP, CHIP);
  }

  /** sc < 0 means "title": an empty map */
  initScene(sc) {
    if (sc < 0) {
      this.sceneNum = -1;
      this.map.init();
      radar.prepare();
      return;
    }
    this.sceneNum = sc % this.sceneMax;
    this.level = Math.floor(sc / this.sceneMax);
    const s = scenes[this.sceneNum];

    this.map.init();
    for (const b of s.bases) this.map.makeMaze(b.x, b.y, b.h, b.v);
    this.map.convert(s.ratio);
    this.generateCount = 0;
  }

  /** render the map + stars, spawn cannons/cores; returns the number of cores */
  prepare() {
    if (this.sceneNum < 0) return 0;
    const s = scenes[this.sceneNum];
    const map = this.map;
    let countCore = 0;

    const interval1 = Math.max(4, s.ek1Interval >> this.level);
    const interval2 = Math.max(4, s.ek2Interval >> this.level);
    enemies.setEkindToGenerate(kinds[s.ek1], interval1, kinds[s.ek2], interval2);

    const ctx = gfx.storeCtx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_SIZEX, SCREEN_SIZEY);

    for (let i = 0; i < MAP_SIZEX; i++)
      for (let j = 0; j < MAP_SIZEY; j++) {
        const m = map.get(i, j);
        if (m) this.copyAChip(m, i, j);
        if (m === U_MASK || m === R_MASK || m === D_MASK || m === L_MASK) {
          enemies.make(cannon, i * 16 + 8, j * 16 + 8);
        } else if (m === CORE) {
          enemies.make(core, i * 16 + 8, j * 16 + 8);
          countCore++;
        }
      }

    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = STAR_COLORS[i];
      for (let j = 0; j < 2000; j++) {
        const x = rand.bits(SCREEN_SIZEX_LOG2);
        const y = rand.bits(SCREEN_SIZEY_LOG2);
        if (map.get(x >> 4, y >> 4) === SPACE) ctx.fillRect(x, y, 1, 1);
      }
    }

    myship.setPosition(s.startx << 4, s.starty << 4);
    radar.prepare();
    return countCore;
  }

  /** release the next wave of roaming enemies, placed away from the ship */
  generateFixedEnemies() {
    const s = scenes[this.sceneNum];
    if (this.generateCount < s.enemies.length) {
      const set = s.enemies[this.generateCount];
      const kind = kinds[set.kind];
      for (let j = 0; j < set.num; j++) {
        const sp = set.speed;
        let x = rand.get() % (SCREEN_SIZEX - WSIZE * 2);
        let y = rand.get() % (SCREEN_SIZEY - WSIZE * 2);
        x -= (SCREEN_SIZEX / 2 - WSIZE);
        y -= (SCREEN_SIZEY / 2 - WSIZE);
        if (x < 0) x -= WSIZE; else x += WSIZE;
        if (y < 0) y -= WSIZE; else y += WSIZE;
        x += myship.x;
        y += myship.y;

        const t = rand.bits(4);
        const h = (sp * SINT[t]) << (SHIFT - 6);
        const v = (sp * COST[t]) << (SHIFT - 6);
        enemies.make(kind, x, y, h, v);
      }
      this.generateCount++;
    }
    if (this.generateCount >= s.enemies.length) this.generateCount = 0;
  }

  getChipNumber(x, y) { return this.map.get(x, y); }

  setChipNumber(x, y, n) {
    this.map.set(x, y, n);
    this.copyAChip(n, x, y);
    if (n === 0) radar.erase(x, y);
  }
}

export const screen = new Screen();
