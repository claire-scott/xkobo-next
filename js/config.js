// Constants from xkobo config.h / map.h / enemies.h (GPL v2, (c) 1995,1996 Akira Higuchi)

export const WAIT_MSEC = 30;      // one game tick
export const SHIPS = 5;
export const BEAM_MAX = 10;
export const ENEMY_MAX = 1024;

export const WSIZE = 226;         // playfield window, in pixels
export const HIT_MYSHIP = 5;
export const HIT_BEAM = 5;

export const MAP_SIZEX_LOG2 = 6;
export const MAP_SIZEY_LOG2 = 7;
export const CHIP_LOG2 = 4;
export const SCREEN_SIZEX_LOG2 = MAP_SIZEX_LOG2 + CHIP_LOG2;
export const SCREEN_SIZEY_LOG2 = MAP_SIZEY_LOG2 + CHIP_LOG2;
export const CHIP = 1 << CHIP_LOG2;
export const MAP_SIZEX = 1 << MAP_SIZEX_LOG2;
export const MAP_SIZEY = 1 << MAP_SIZEY_LOG2;
export const SCREEN_SIZEX = 1 << SCREEN_SIZEX_LOG2;
export const SCREEN_SIZEY = 1 << SCREEN_SIZEY_LOG2;

export const SHIFT = 6;           // fixed-point shift for enemy coordinates

// map cell bits
export const SPACE = 0;
export const WALL = 1;
export const U_MASK = 1 << 0;
export const R_MASK = 1 << 1;
export const D_MASK = 1 << 2;
export const L_MASK = 1 << 3;
export const CORE = 1 << 4;
export const HARD = 1 << 5;
export const HIT_MASK = CORE | U_MASK | R_MASK | D_MASK | L_MASK;

export const GIGA = 1000000000;
export const BONUS_FIRSTTIME = 2000;
export const BONUS_EVERY = 3000;
