// Sprite sheet + the big off-screen "store" holding walls and stars.
// xkp256.tif: 16x16 chips, 16 across x 8 down. Pure red (255,0,0) is the transparent colour.
import { SCREEN_SIZEX, SCREEN_SIZEY } from './config.js';

export const gfx = {
  sprites: null,   // transparent version (for sprites)
  chips: null,     // red -> black version (for opaque map chips)
  store: null,     // SCREEN_SIZEX x SCREEN_SIZEY backing canvas
  storeCtx: null,
  ready: null,
};

const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

gfx.load = function load(url) {
  this.ready = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width, h = img.height;
      const spr = makeCanvas(w, h), chips = makeCanvas(w, h);
      const sctx = spr.getContext('2d'), cctx = chips.getContext('2d');
      sctx.drawImage(img, 0, 0);
      const data = sctx.getImageData(0, 0, w, h);
      const opaque = new ImageData(new Uint8ClampedArray(data.data), w, h);
      const d = data.data, o = opaque.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 0) {
          d[i + 3] = 0;                        // transparent in sprite version
          o[i] = o[i + 1] = o[i + 2] = 0;      // black in chip version
        }
      }
      sctx.putImageData(data, 0, 0);
      cctx.putImageData(opaque, 0, 0);
      this.sprites = spr;
      this.chips = chips;
      this.store = makeCanvas(SCREEN_SIZEX, SCREEN_SIZEY);
      this.storeCtx = this.store.getContext('2d');
      this.storeCtx.fillStyle = '#000';
      this.storeCtx.fillRect(0, 0, SCREEN_SIZEX, SCREEN_SIZEY);
      resolve();
    };
    img.onerror = () => reject(new Error('could not load ' + url));
    img.src = url;
  });
  return this.ready;
};
