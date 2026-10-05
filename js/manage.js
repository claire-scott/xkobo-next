// Port of xkobo manage.C -- game flow: title / playing / paused, lives, score, stage changes.
import { SHIPS, GIGA, BONUS_FIRSTTIME, BONUS_EVERY } from './config.js';
import { opts } from './opts.js';
import { screen } from './screen.js';
import { enemies } from './enemy.js';
import { myship } from './myship.js';
import { radar } from './radar.js';
import { key } from './key.js';
import { storage } from './storage.js';

class Manage {
  constructor() {
    this.state = 'title';          // 'title' | 'playing' | 'paused'
    this.nextStateOut = 0;
    this.nextStateNext = 0;
    this.highscore = 0;
    this.lastScene = 0;
    this.sceneNum = 0;
    this.ships = 0;
    this.level = 0;
    this.count = 0;
    this.score = 0;
    this.bonusNext = 0;
    this.flushScoreCount = 0;
    this.flushShipsCount = 0;
    this.delayCount = 0;
    this.restCores = 0;
    // UI-facing bits
    this.scoreVisible = true;
    this.shipsVisible = true;
    this.hooks = { stageStart() {}, gameOver() {}, state() {}, lostShip() {} };
  }

  init() {
    const d = storage.load();
    this.highscore = d.highscore;
    this.lastScene = d.lastScene;
    this.count = 0;
    this.ships = 0;
    this.level = 0;
    this.sceneNum = this.lastScene;
    this.flushShipsCount = 0;
    this.delayCount = 0;
    this.initResourcesTitle();
  }

  /* ---- flow ---- */

  gameStart() {
    this.ships = SHIPS;
    this.level = 0;
    this.score = 0;
    this.flushScoreCount = 0;
    this.bonusNext = BONUS_FIRSTTIME;
    screen.initScene(this.sceneNum);
    this.initResourcesToPlay();
  }

  nextScene() {
    this.sceneNum++;
    if (this.sceneNum >= GIGA - 1) this.sceneNum = GIGA - 2;
    if (this.lastScene < this.sceneNum) {          // save progress as soon as a stage is reached
      this.lastScene = this.sceneNum;
      if (!opts.cheat) { storage.data.lastScene = this.lastScene; storage.save(); }
    }
    screen.initScene(this.sceneNum);
  }

  retry(quit = false) {
    if (!opts.cheat) this.ships--;
    if (this.ships <= 0) {
      if (this.lastScene < this.sceneNum) this.lastScene = this.sceneNum;
      let rank = 0, newHigh = false;
      if (!opts.cheat) {
        if (this.highscore < this.score) { this.highscore = this.score; newHigh = true; }
        storage.data.highscore = this.highscore;
        storage.data.lastScene = this.lastScene;
        rank = storage.record(this.score, this.sceneNum + 1);
      }
      this.ships = 0;
      this.initResourcesTitle();
      this.hooks.gameOver({ score: this.score, stage: this.sceneNum + 1, rank, newHigh, quit });
    }
  }

  initResourcesTitle() {
    this.state = 'title';
    screen.initScene(-1);
    this.scoreVisible = this.shipsVisible = true;
    this.hooks.state(this.state);
  }

  initResourcesToPlay() {
    this.state = 'playing';
    this.count = 0;
    this.delayCount = 0;
    this.flushScoreCount = this.flushScoreCount ? -1 : 0;
    this.flushShipsCount = 0;
    this.scoreVisible = this.shipsVisible = true;
    this.nextStateOut = 0;
    this.nextStateNext = 0;

    key.init();
    enemies.init();
    myship.init();
    this.restCores = screen.prepare();
    screen.generateFixedEnemies();
    this.hooks.state(this.state);
    this.hooks.stageStart(this.sceneNum + 1);
  }

  flushScore() {
    this.flushScoreCount--;
    if (this.flushScoreCount & 1) return;
    this.scoreVisible = !(this.flushScoreCount & 2);
    if (this.flushScoreCount === 0) this.flushScoreCount = -1;
  }

  flushShips() {
    this.flushShipsCount--;
    if (this.flushShipsCount & 1) return;
    this.shipsVisible = !(this.flushShipsCount & 2);
  }

  /** one 30ms game tick */
  mainloop() {
    if (this.state !== 'playing') return;

    this.count++;
    if (this.delayCount) this.delayCount--;

    if (this.delayCount === 1) {
      if (enemies.existPipe()) {
        this.delayCount = 2;          // let the fuses finish burning
      } else {
        if (this.nextStateOut) {
          this.retry();
          if (this.ships <= 0) return;
        }
        if (this.nextStateNext) this.nextScene();
        this.initResourcesToPlay();
        return;
      }
    }

    myship.move();
    enemies.move();
    myship.hitStructure();

    if (this.flushScoreCount > 0) this.flushScore();
    if (this.flushShipsCount) this.flushShips();
    radar.traceMyship();
  }

  /* ---- events from game objects ---- */

  lostMyship() {
    if (this.delayCount === 0) this.delayCount = 20;
    this.nextStateOut = 1;
    this.hooks.lostShip();
  }

  destroyedACore() {
    this.restCores--;
    if (this.restCores === 0) {
      this.nextStateNext = 1;
      this.delayCount = 50;
    }
    screen.generateFixedEnemies();
  }

  addScore(sc) {
    this.score += sc;
    if (this.score >= GIGA) this.score = GIGA - 1;
    else if (!opts.cheat) {
      if (this.score >= this.bonusNext) {
        this.bonusNext += BONUS_EVERY;
        this.ships++;
        this.flushShipsCount = 50;
      }
      if (this.score >= this.highscore && this.flushScoreCount === 0)
        this.flushScoreCount = 50;
    }
  }

  /* ---- player commands ---- */

  /** start from title, or toggle pause */
  startKey() {
    switch (this.state) {
      case 'title': this.gameStart(); break;
      case 'paused': this.state = 'playing'; this.hooks.state(this.state); break;
      case 'playing': this.state = 'paused'; this.hooks.state(this.state); break;
    }
  }

  pause() { if (this.state === 'playing') this.startKey(); }
  resume() { if (this.state === 'paused') this.startKey(); }

  exitKey() {
    if (this.state === 'title') return;
    this.ships = 0;
    this.retry(true);
  }

  stagePlus() {
    if (this.state !== 'title') return;
    if (this.sceneNum < this.lastScene || opts.cheat) this.sceneNum++;
  }

  stageMinus() {
    if (this.state !== 'title') return;
    this.sceneNum = Math.max(0, this.sceneNum - 1);
  }
}

export const manage = new Manage();
