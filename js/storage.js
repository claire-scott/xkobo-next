// High score / progress persistence (replaces xkobo's score file). Never throws.
const KEY = 'mobilekobo.v1';
const TABLE_MAX = 10;

const DEFAULT_SETTINGS = { autofire: false, floating: true };
const blank = () => ({ highscore: 0, lastScene: 0, table: [], settings: { ...DEFAULT_SETTINGS } });

export const storage = {
  data: blank(),

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = Object.assign(blank(), JSON.parse(raw));
    } catch (e) { this.data = blank(); }
    this.data.settings = { ...DEFAULT_SETTINGS, ...(this.data.settings || {}) };
    return this.data;
  },

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode etc. */ }
  },

  /** record a finished game; returns the rank (1-based) or 0 if it didn't place */
  record(score, stage) {
    const d = this.data;
    d.table.push({ score, stage, date: Date.now() });
    d.table.sort((a, b) => b.score - a.score);
    d.table.length = Math.min(d.table.length, TABLE_MAX);
    const rank = d.table.findIndex((r) => r.score === score && r.stage === stage) + 1;
    this.save();
    return score > 0 ? rank : 0;
  },
};
