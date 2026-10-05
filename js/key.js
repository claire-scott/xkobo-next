// Port of xkobo key.C -- input state. Keyboard, touch and gamepad all feed this.
// Directions are 1..8 clockwise from "up"; the ship keeps flying in its last direction.
export const key = {
  left: 0, right: 0, up: 0, down: 0, shot: 0,
  direction: 1,

  init() { this.direction = 1; this.clear(); },

  clear() { this.left = this.right = this.up = this.down = this.shot = 0; },

  /** recompute direction from the four direction flags (unchanged when none held) */
  change() {
    const lr = this.left - this.right;
    const ud = this.up - this.down;
    if (lr > 0) this.direction = ud > 0 ? 8 : ud < 0 ? 6 : 7;
    else if (lr < 0) this.direction = ud > 0 ? 2 : ud < 0 ? 4 : 3;
    else if (ud > 0) this.direction = 1;
    else if (ud < 0) this.direction = 5;
  },

  /** set direction directly (virtual stick / gamepad) */
  setDirection(d) { if (d >= 1 && d <= 8) this.direction = d; },
};
