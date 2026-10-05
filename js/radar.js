// Port of xkobo radar.C -- the 64x128 overview map (one pixel per map cell)
import { MAP_SIZEX, MAP_SIZEY, SCREEN_SIZEX, SCREEN_SIZEY, CORE, SPACE, HIT_MASK } from './config.js';
import { myship } from './myship.js';
import { screen } from './screen.js';

const C_SHIP = 'rgb(128,240,240)';
const C_CORE = 'rgb(200,240,240)';
const C_WALL = 'rgb(64,128,128)';
const C_BG = 'rgb(32,48,64)';

class Radar {
  constructor() { this.ctx = null; this.mxOld = -1; this.myOld = -1; }

  attach(canvas) {
    canvas.width = MAP_SIZEX;
    canvas.height = MAP_SIZEY;
    this.ctx = canvas.getContext('2d');
    this.prepare();
  }

  px(x, y, color) {
    if (!this.ctx) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, 1, 1);
  }

  prepare() {
    this.mxOld = this.myOld = -1;
    if (!this.ctx) return;
    this.ctx.fillStyle = C_BG;
    this.ctx.fillRect(0, 0, MAP_SIZEX, MAP_SIZEY);
    for (let i = 0; i < MAP_SIZEX; i++)
      for (let j = 0; j < MAP_SIZEY; j++) {
        const a = screen.getChipNumber(i, j);
        if (a === CORE) this.px(i, j, C_CORE);
        else if (a & HIT_MASK) this.px(i, j, C_WALL);
      }
  }

  erase(x, y) { this.px(x, y, C_BG); }

  traceMyship() {
    const mx = (myship.x & (SCREEN_SIZEX - 1)) >> 4;
    const my = (myship.y & (SCREEN_SIZEY - 1)) >> 4;
    if (mx === this.mxOld && my === this.myOld) return;
    if (screen.getChipNumber(mx, my) !== SPACE) return;
    this.px(mx, my, C_SHIP);
    if (this.mxOld >= 0) this.px(this.mxOld, this.myOld, C_BG);
    this.mxOld = mx;
    this.myOld = my;
  }
}

export const radar = new Radar();
