// Keyboard, gamepad and on-screen touch controls, all funnelled into `key`.
import { key } from './key.js';

// code -> [left, right, up, down]
const KEYMAP = {
  ArrowLeft: [1, 0, 0, 0], KeyA: [1, 0, 0, 0], Numpad4: [1, 0, 0, 0],
  ArrowRight: [0, 1, 0, 0], KeyD: [0, 1, 0, 0], Numpad6: [0, 1, 0, 0],
  ArrowUp: [0, 0, 1, 0], KeyW: [0, 0, 1, 0], Numpad8: [0, 0, 1, 0],
  ArrowDown: [0, 0, 0, 1], KeyS: [0, 0, 0, 1], Numpad2: [0, 0, 0, 1],
  Numpad7: [1, 0, 1, 0], Home: [1, 0, 1, 0],
  Numpad9: [0, 1, 1, 0], PageUp: [0, 1, 1, 0],
  Numpad1: [1, 0, 0, 1], End: [1, 0, 0, 1],
  Numpad3: [0, 1, 0, 1], PageDown: [0, 1, 0, 1],
};
const FIRE_KEYS = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'KeyZ', 'KeyX', 'KeyJ', 'KeyK', 'NumpadEnter', 'Numpad0']);

/** angle (0 = up, clockwise) -> xkobo direction 1..8 */
export function dirFromVector(dx, dy) {
  const a = Math.atan2(dx, -dy);                 // -PI..PI
  return ((Math.round(a / (Math.PI / 4)) + 8) % 8) + 1;
}

export const input = {
  keys: new Set(),
  fireKeys: new Set(),
  autofire: false,
  touchShot: false,
  stickDir: 0,           // 0 = stick not held
  padDir: 0,
  padShot: false,
  onCommand: () => {},   // ('pause' | 'start' | 'quit' | 'left' | 'right' | 'confirm')
  padPrev: { start: false, a: false, left: false, right: false },

  attachKeyboard() {
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (KEYMAP[e.code] || FIRE_KEYS.has(e.code) || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      if (KEYMAP[e.code]) this.keys.add(e.code);
      if (FIRE_KEYS.has(e.code)) this.fireKeys.add(e.code);
      switch (e.code) {
        case 'KeyF': this.onCommand('autofire'); break;
        case 'KeyP': case 'Escape': this.onCommand('pause'); break;
        case 'KeyQ': this.onCommand('quit'); break;
        case 'Enter': this.onCommand('confirm'); break;
        case 'KeyN': this.onCommand('left'); break;
        case 'KeyM': this.onCommand('right'); break;
      }
      this.onCommand('key:' + e.code);
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.fireKeys.delete(e.code);
    });
    addEventListener('blur', () => { this.keys.clear(); this.fireKeys.clear(); });
  },

  /**
   * Virtual 8-way stick. Direction comes from finger movement relative to an anchor point:
   *  - floating: the anchor is wherever the thumb first lands, and it follows the thumb if it
   *    strays past `follow` x radius, so you never have to "find" a quadrant again;
   *  - fixed: the anchor is the pad's home position.
   * `zone` receives the touches, `pad` is the visual that gets moved to the anchor.
   */
  attachStick(zone, pad, { onDir, onKnob, floating }) {
    let id = null, ax = 0, ay = 0, hx = 0, hy = 0, R = 1, prev = -1, zr = null;
    const FOLLOW = 0.55, DEAD = 0.16;

    const place = () => {
      pad.style.transform = `translate(${ax - hx}px, ${ay - hy}px)`;
    };
    const sector = (dx, dy) => {
      let f = Math.atan2(dx, -dy) / (Math.PI / 4);   // 0 = up, +1 per 45deg clockwise
      f = (f + 8) % 8;
      if (prev >= 0) {
        let d = Math.abs(f - prev);
        d = Math.min(d, 8 - d);
        if (d < 0.5 + 0.14) return prev;              // hysteresis: stick to the current sector
      }
      return Math.round(f) % 8;
    };
    const update = (e) => {
      let dx = e.clientX - ax, dy = e.clientY - ay;
      let dist = Math.hypot(dx, dy);
      if (floating() && dist > R * FOLLOW) {          // drag the anchor along behind the thumb
        const k = (dist - R * FOLLOW) / dist;
        ax += dx * k; ay += dy * k;
        ax = Math.min(Math.max(ax, zr.left + R), Math.max(zr.left + R, zr.right - R));
        ay = Math.min(Math.max(ay, zr.top + R), Math.max(zr.top + R, zr.bottom - R));
        place();
        dx = e.clientX - ax; dy = e.clientY - ay; dist = Math.hypot(dx, dy);
      }
      const kn = Math.min(1, dist / (R * FOLLOW));
      onKnob(dist ? (dx / dist) * kn * 45 : 0, dist ? (dy / dist) * kn * 45 : 0);
      if (dist < R * DEAD) return;                     // dead zone: keep flying the same way
      prev = sector(dx, dy);
      this.stickDir = prev + 1;
      key.setDirection(this.stickDir);
      onDir(this.stickDir, true);
    };

    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      zone.setPointerCapture(id);
      pad.style.transition = 'none';
      pad.style.transform = '';
      const r = pad.getBoundingClientRect();
      hx = r.left + r.width / 2; hy = r.top + r.height / 2; R = r.width / 2;
      zr = zone.getBoundingClientRect();
      if (floating()) {
        ax = Math.min(Math.max(e.clientX, zr.left + R), Math.max(zr.left + R, zr.right - R));
        ay = Math.min(Math.max(e.clientY, zr.top + R), Math.max(zr.top + R, zr.bottom - R));
      } else { ax = hx; ay = hy; }
      place();
      prev = key.direction - 1;                        // start from the current heading
      update(e);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) update(e); });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.stickDir = 0;
      pad.style.transition = 'transform .18s ease-out';
      pad.style.transform = '';
      onKnob(0, 0);
      onDir(key.direction, false);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  },

  attachFire(el, onChange) {
    let id = null;
    el.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      el.setPointerCapture(id);
      this.touchShot = true;
      onChange(true);
      e.preventDefault();
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.touchShot = false;
      onChange(false);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  },

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) { this.padDir = 0; this.padShot = false; return; }
    const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    let dx = pad.axes[0] || 0, dy = pad.axes[1] || 0;
    if (b(14)) dx = -1; else if (b(15)) dx = 1;
    if (b(12)) dy = -1; else if (b(13)) dy = 1;
    this.padDir = Math.hypot(dx, dy) > 0.45 ? dirFromVector(dx, dy) : 0;
    this.padShot = b(0) || b(1) || b(2) || b(3) || b(5) || b(7);
    const start = b(9), a = b(0);
    if (start && !this.padPrev.start) this.onCommand('pause');
    if (a && !this.padPrev.a) this.onCommand('confirm');
    if (b(14) && !this.padPrev.left) this.onCommand('left');
    if (b(15) && !this.padPrev.right) this.onCommand('right');
    this.padPrev = { start, a, left: b(14), right: b(15) };
  },

  /** called before each game tick (after pollGamepad): merge every source into `key` */
  apply() {
    let l = 0, r = 0, u = 0, d = 0;
    for (const code of this.keys) {
      const m = KEYMAP[code];
      l |= m[0]; r |= m[1]; u |= m[2]; d |= m[3];
    }
    key.left = l; key.right = r; key.up = u; key.down = d;
    key.change();
    if (this.padDir) key.direction = this.padDir;
    if (this.stickDir) key.direction = this.stickDir;
    key.shot = (this.autofire || this.fireKeys.size || this.touchShot || this.padShot) ? 1 : 0;
  },
};
