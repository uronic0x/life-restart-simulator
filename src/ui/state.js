/** Small persisted store: settings + past lives. */
const KEYS = {
  settings: 'lrs.settings',
  history: 'lrs.history',
  achievements: 'lrs.achievements',
};

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — game still works */
  }
};

export const settings = {
  get() {
    return { reduceMotion: false, autoSpeed: 1, ...readJson(KEYS.settings, {}) };
  },
  set(patch) {
    const next = { ...this.get(), ...patch };
    writeJson(KEYS.settings, next);
    return next;
  },
};

export const history = {
  all() {
    return readJson(KEYS.history, []);
  },
  add(run) {
    const all = this.all();
    all.unshift(run);
    writeJson(KEYS.history, all.slice(0, 12));
    return this.all();
  },
  clear() {
    writeJson(KEYS.history, []);
  },
  best() {
    return this.all().reduce((max, r) => Math.max(max, r.score ?? 0), 0);
  },
};

export const achievementStore = {
  ids() {
    return readJson(KEYS.achievements, []);
  },
  /** Returns the ids that are new this time. */
  merge(ids) {
    const known = new Set(this.ids());
    const fresh = ids.filter((id) => !known.has(id));
    if (fresh.length) writeJson(KEYS.achievements, [...known, ...fresh]);
    return fresh;
  },
};
