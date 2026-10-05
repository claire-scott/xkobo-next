// xkobo's 32-bit LCG, reproduced bit-for-bit (Math.imul keeps the multiply in 32 bits).
let seed = 1;

export const rand = {
  init(s = (Date.now() / 1000) | 0) { seed = s >>> 0; },
  /** full 32-bit unsigned value */
  get() {
    seed = (Math.imul(seed, 1566083941) + 1) >>> 0;
    return seed;
  },
  /** top `bit` bits */
  bits(bit) {
    seed = (Math.imul(seed, 1566083941) + 1) >>> 0;
    return seed >>> (32 - bit);
  },
};
