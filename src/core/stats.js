/**
 * Attribute definitions, clamping and derived values.
 * Stats are 0..30. `mood` starts at 10 and drifts with events.
 */
export const STAT_KEYS = ['charm', 'intellect', 'physique', 'wealth', 'mood'];

export const STAT_MIN = 0;
export const STAT_MAX = 30;

export const STAT_META = {
  charm: { icon: '✦', tone: 'charm' },
  intellect: { icon: '✧', tone: 'intellect' },
  physique: { icon: '❖', tone: 'physique' },
  wealth: { icon: '◈', tone: 'wealth' },
  mood: { icon: '❀', tone: 'mood' },
};

export function emptyStats() {
  return { charm: 0, intellect: 0, physique: 0, wealth: 0, mood: 10 };
}

export function clampStat(v) {
  return Math.max(STAT_MIN, Math.min(STAT_MAX, v));
}

export function applyEffects(state, effects) {
  if (!effects) return;
  for (const [key, delta] of Object.entries(effects)) {
    if (typeof delta !== 'number') continue;
    if (key === 'money') {
      state.money += delta;
      continue;
    }
    if (STAT_KEYS.includes(key)) state.stats[key] = clampStat(state.stats[key] + delta);
  }
}

/** Total of the four "talent" stats — used for scores and ending grades. */
export function statTotal(stats) {
  return stats.charm + stats.intellect + stats.physique + stats.wealth;
}

/** 0..1 wellbeing ratio used for the summary radar. */
export function statRatio(stats) {
  const out = {};
  for (const key of STAT_KEYS) out[key] = Math.max(0, Math.min(1, stats[key] / STAT_MAX));
  return out;
}
