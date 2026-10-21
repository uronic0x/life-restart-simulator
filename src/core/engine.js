import { createRng, randomSeed } from './rng.js';
import { emptyStats, applyEffects, clampStat, STAT_KEYS, statTotal } from './stats.js';
import { EVENTS } from '../content/events.js';
import { DEATHS, NATURAL_DEATH } from '../content/deaths.js';
import { CAREERS, CAREER_BY_ID } from '../content/careers.js';
import { ACHIEVEMENTS } from '../content/achievements.js';
import { resolveEnding } from '../content/endings.js';
import { RARITY_WEIGHT } from '../content/talents.js';

export const CAREER_AGE = [22, 24];
export const RETIRE_AGE = 62;
export const MAX_AGE = 130;

export const PHASES = [
  { id: 'infant', age: [0, 5] },
  { id: 'child', age: [6, 11] },
  { id: 'teen', age: [12, 17] },
  { id: 'youth', age: [18, 24] },
  { id: 'adult', age: [25, 39] },
  { id: 'midlife', age: [40, 59] },
  { id: 'senior', age: [60, 74] },
  { id: 'elder', age: [75, MAX_AGE] },
];

export function phaseOf(age) {
  return (PHASES.find((p) => age >= p.age[0] && age <= p.age[1]) ?? PHASES.at(-1)).id;
}

/* ────────────────────────────── setup ────────────────────────────── */

export function rollBaseStats(rng) {
  // Total points ~24..30 across four stats, distributed unevenly so builds differ.
  const pool = rng.int(24, 30);
  const weights = [1, 1, 1, 1].map(() => rng.float(0.4, 1.8));
  const sum = weights.reduce((a, b) => a + b, 0);
  const stats = emptyStats();
  const keys = ['charm', 'intellect', 'physique', 'wealth'];
  let spent = 0;

  keys.forEach((key, i) => {
    const v = i === keys.length - 1 ? pool - spent : Math.round((pool * weights[i]) / sum);
    // Everyone starts with *something*; a zero stat is a dead end, not a build.
    stats[key] = Math.max(2, v);
    spent += stats[key];
  });
  stats.mood = rng.int(12, 18);
  return stats;
}

export function drawTalents(rng, count = 4, exclude = []) {
  const picked = [];
  while (picked.length < count) {
    const candidate = rng.weighted(
      TALENT_POOL.filter((t) => !picked.includes(t) && !exclude.includes(t)),
      (t) => RARITY_WEIGHT[t.rarity],
    );
    if (!candidate) break;
    picked.push(candidate);
  }
  return picked;
}

/* TALENT_POOL is injected by the caller to keep this module UI-free. */
let TALENT_POOL = [];
export function setTalentPool(pool) {
  TALENT_POOL = pool;
}

export function createLife({ seed = randomSeed(), talents = [] } = {}) {
  const rng = createRng(seed);
  const stats = emptyStats();
  const state = {
    seed,
    rng,
    age: 0,
    alive: true,
    stats,
    baseStats: null,
    money: 0,
    career: null,
    flags: new Set(),
    talents,
    log: [],
    fired: new Set(),
    pending: null,
    history: [],
    unlocked: [],
    earned: new Set(),
    minMood: stats.mood,
    peakMood: stats.mood,
  };

  for (const t of talents) {
    applyEffects(state, t.effects);
    for (const f of t.flags) state.flags.add(f);
  }
  state.baseStats = { ...stats };
  state.peak = { ...stats };
  state.minMood = stats.mood;
  state.peakMood = stats.mood;
  state.money = Math.max(0, stats.wealth - 6) * 2;
  return state;
}

/* ──────────────────────────── helpers ───────────────────────────── */

const has = (state, flag) => state.flags.has(flag);

function meetsRequirement(state, require) {
  if (!require) return true;
  for (const [key, min] of Object.entries(require)) {
    if (key === 'money') {
      if (state.money < min) return false;
    } else if ((state.stats[key] ?? 0) < min) {
      return false;
    }
  }
  return true;
}

function eventWeight(state, event) {
  let w = event.weight ?? 10;
  const good = event.tags?.includes('good');
  const bad = event.tags?.includes('bad');
  if (good && has(state, 'lucky')) w *= 1.4;
  if (bad && has(state, 'unlucky')) w *= 1.4;
  if (bad && has(state, 'lucky')) w *= 0.85;
  return w;
}

function eligibleEvents(state) {
  return EVENTS.filter(
    (e) =>
      state.age >= e.age[0] &&
      state.age <= e.age[1] &&
      !(e.once && state.fired.has(e.id)) &&
      meetsRequirement(state, e.require) &&
      !(e.forbid && has(state, e.forbid)),
  );
}

/** Mood-scaled effect application (optimists take less emotional damage). */
function applyEventEffects(state, effects) {
  if (!effects) return {};
  const scaled = { ...effects };
  if (has(state, 'moodShield') && scaled.mood < 0) {
    scaled.mood = Math.ceil(scaled.mood / 2);
  }
  if (has(state, 'moneySense') && typeof scaled.money === 'number') {
    scaled.money = scaled.money > 0 ? Math.round(scaled.money * 1.25) : scaled.money;
  }
  applyEffects(state, scaled);
  syncExtremes(state);
  return scaled;
}

function push(state, entry) {
  state.log.push(entry);
  state.history.push(entry);
  return entry;
}

/* ───────────────────────────── stepper ──────────────────────────── */

/**
 * Advance until something worth showing happens (an event, a milestone,
 * a death) and return the batch of log entries produced.
 */
export function advance(state) {
  if (!state.alive || state.pending) return [];
  const batch = [];
  let quiet = 0;
  let quietStart = null;

  while (state.alive) {
    state.age += 1;
    if (state.age > MAX_AGE) {
      die(state, 'death_extreme', batch);
      break;
    }

    // yearly income and living costs
    state.money += yearlyIncome(state);
    state.money -= yearlyUpkeep(state);
    if (state.money < -40) state.money = -40;

    // ── natural body curve ──────────────────────────────────────
    // Physique is not purely event-driven: children grow into it, and
    // everyone declines after 45. Without this, physique only ever falls.
    applyBodyCurve(state);
    trackPeak(state);

    // ── mood regression toward a personal baseline ───────────────
    // Keeps mood from pinning at 30 after a few good events.
    applyMoodDrift(state);
    syncExtremes(state);

    // career milestone
    if (!state.career && state.age >= CAREER_AGE[0]) {
      if (quiet) batch.push(quietEntry(state, quietStart, state.age - 1, quiet));
      state.pending = { kind: 'career', options: careerOptions(state) };
      return batch;
    }

    // death check
    const death = rollDeath(state);
    if (death) {
      if (quiet) batch.push(quietEntry(state, quietStart, state.age - 1, quiet));
      die(state, death.id, batch);
      break;
    }

    // event check
    const event = rollEvent(state);
    if (event) {
      if (quiet) batch.push(quietEntry(state, quietStart, state.age - 1, quiet));
      if (event.once) state.fired.add(event.id);

      if (event.choices) {
        state.pending = {
          kind: 'event',
          eventId: event.id,
          age: state.age,
          options: event.choices.filter((c) => meetsRequirement(state, c.require)),
        };
        return batch;
      }

      const applied = applyEventEffects(state, event.effects);
      batch.push(
        push(state, {
          type: 'event',
          age: state.age,
          eventId: event.id,
          phase: phaseOf(state.age),
          tags: event.tags ?? [],
          effects: applied,
        }),
      );
      return batch;
    }

    quiet += 1;
    if (quietStart === null) quietStart = state.age;
    if (quiet >= 6) {
      batch.push(quietEntry(state, quietStart, state.age, quiet));
      return batch;
    }
  }

  return batch;
}

/**
 * A stretch of years with nothing worth reporting. It goes through `push()` so
 * it lands in `state.history` like every other row — the UI renders the log
 * from history, not from the returned batch, so a batch-only entry would be
 * invisible and "Continue" would look like it did nothing.
 */
function quietEntry(state, from, to, years) {
  return push(state, { type: 'quiet', age: to, from, years, phase: phaseOf(to) });
}

/** Remember the highest value each stat ever reached — adulthood baseline. */
function trackPeak(state) {
  if (!state.peak) state.peak = { ...state.stats };
  for (const key of STAT_KEYS) {
    if (state.stats[key] > state.peak[key]) state.peak[key] = state.stats[key];
  }
  syncExtremes(state);
}

/**
 * Mood extremes are remembered separately: the *final* mood of a long life is
 * almost always pulled back to its baseline by drift, so end-state checks can
 * never see a genuine low. Achievements use the trough/peak instead.
 */
function syncExtremes(state) {
  if (typeof state.minMood !== 'number') state.minMood = state.stats.mood;
  if (typeof state.peakMood !== 'number') state.peakMood = state.stats.mood;
  if (state.stats.mood < state.minMood) state.minMood = state.stats.mood;
  if (state.stats.mood > state.peakMood) state.peakMood = state.stats.mood;
}

/**
 * The body grows until ~22, plateaus, then slowly declines after 45.
 * Decline is asymptotic: it approaches a floor rather than hitting zero,
 * so a frail old person is weak but not "physique 0".
 */
function applyBodyCurve(state) {
  const { age, stats } = state;

  if (age <= 22) {
    // Growing up: gains get rarer as you approach your adult peak.
    const peak = 14;
    const headroom = Math.max(0, peak - stats.physique);
    if (headroom > 0 && state.rng.chance(0.35 + headroom * 0.03)) {
      stats.physique = clampStat(stats.physique + 1);
    }
    return;
  }

  if (age <= 44) return; // plateau: prime of life

  // Decline: relative to your *peak* physique, not your current one —
  // otherwise the floor keeps sinking and physique spirals to zero.
  const longLived = has(state, 'longevity') || has(state, 'daoist');
  const decayStart = longLived ? 58 : 45;
  if (age < decayStart) return;

  const peak = Math.max(state.peak?.physique ?? stats.physique, stats.physique);
  const yearsPast = age - decayStart;
  // Keep a meaningful fraction of your peak: ~50% at 75, ~35% at 90.
  let floorRatio = 0.62 - yearsPast * 0.004;
  if (longLived) floorRatio += 0.18;
  floorRatio = Math.max(0.3, floorRatio);
  const floor = Math.max(2, Math.round(peak * floorRatio));

  if (stats.physique <= floor) return;

  const gap = stats.physique - floor;
  // Slow drift: roughly one point every few years, not every year.
  const p = Math.min(0.4, 0.06 + gap * 0.018 + yearsPast * 0.0015);
  if (state.rng.chance(p)) stats.physique = clampStat(stats.physique - 1);
}

/**
 * Mood is noisy but self-correcting: extreme highs fade, extreme lows
 * slowly lift. Baseline rises slightly with a good life.
 */function applyMoodDrift(state) {
  const { stats } = state;
  const baseline = 14 + Math.floor(Math.max(0, state.money) / 40);
  const target = Math.min(26, baseline);
  const delta = stats.mood - target;
  if (Math.abs(delta) < 2) return;
  const step = delta > 0 ? 1 : 2; // fall faster than it rises
  const chance = Math.min(0.9, 0.28 + Math.abs(delta) * 0.05);
  if (state.rng.chance(chance)) {
    stats.mood = clampStat(stats.mood - Math.sign(delta) * step);
  }
}

function yearlyIncome(state) {
  if (!state.career || state.age < CAREER_AGE[0] || state.age > RETIRE_AGE) return 0;
  const career = CAREER_BY_ID[state.career];
  if (!career) return 0;
  let gain = state.rng.int(career.income[0], career.income[1]);
  if (has(state, 'incomeBoost')) gain += 1;
  gain += Math.floor(state.stats.intellect / 14);
  return gain;
}

/** Cost of simply existing: rent, food, family. Returns a positive number. */
function yearlyUpkeep(state) {
  if (state.age < CAREER_AGE[0]) return 0; // supported by parents
  let cost = state.age > RETIRE_AGE ? 1 : 2;
  if (has(state, 'married')) cost += 1;
  if (has(state, 'parent')) cost += 2;
  cost += Math.floor(state.stats.wealth / 15);
  return cost;
}

function rollEvent(state) {
  const pool = eligibleEvents(state);
  if (!pool.length) return null;
  // Not every year has an event: ~65% base rate, higher in eventful phases.
  const rate = state.age <= 5 ? 0.7 : 0.62;
  if (!state.rng.chance(rate)) return null;
  return state.rng.weighted(pool, (e) => eventWeight(state, e));
}

function rollDeath(state) {
  for (const d of DEATHS) {
    if (state.age < d.age[0] || state.age > d.age[1]) continue;
    if (d.require && !meetsRequirement(state, d.require)) continue;
    if (d.requireMax && !meetsMaxRequirement(state, d.requireMax)) continue;
    if (d.id === 'death_infant' && has(state, 'noInfantDeath')) continue;

    let p = d.base;
    if (has(state, 'lucky')) p *= 0.6;
    if (has(state, 'unlucky')) p *= 1.5;
    if (has(state, 'longevity')) p *= 0.55;
    if (has(state, 'daoist')) p *= 0.75;
    // Fragile bodies are more exposed to everything.
    p *= 1 + Math.max(0, 8 - state.stats.physique) * 0.075;
    if (state.stats.mood <= 2) p *= 1.3;

    if (state.rng.chance(Math.min(0.9, p))) return d;
  }

  // Natural old-age mortality: compounding curve, strongly physique-dependent.
  const natural = naturalDeath(state);
  if (natural && state.rng.chance(natural)) {
    return { id: naturalId(state), age: [0, 0], tags: ['natural'] };
  }
  return null;
}

function naturalDeath(state) {
  const { from, base, scale } = NATURAL_DEATH;
  if (state.age < from) return 0;

  // Longevity talent pushes the curve out; frail bodies pull it in.
  let startAge = from;
  if (has(state, 'longevity')) startAge += 14;
  if (has(state, 'daoist')) startAge += 5;
  const physiqueShift = (state.stats.physique - 10) * 1.1;
  const effectiveAge = state.age - physiqueShift;
  if (effectiveAge < startAge) return 0;

  let p = base * Math.exp((effectiveAge - startAge) / scale);
  if (has(state, 'longevity')) p *= 0.7;
  if (has(state, 'lucky')) p *= 0.85;
  if (has(state, 'unlucky')) p *= 1.15;
  return Math.min(0.85, p);
}

function naturalId(state) {
  if (state.age >= 100) return 'death_extreme';
  if (state.age >= 78) return 'death_peaceful';
  return 'death_illness';
}

function meetsMaxRequirement(state, requireMax) {
  for (const [key, max] of Object.entries(requireMax)) {
    const value = key === 'money' ? state.money : state.stats[key] ?? 0;
    if (value > max) return false;
  }
  return true;
}

/* ─────────────────────────── decisions ─────────────────────────── */

function careerOptions(state) {
  const open = CAREERS.filter((c) => c.id !== 'drifter' && meetsRequirement(state, c.require));
  // Prefer the most demanding options so the offer feels earned, but keep
  // the list short enough to read at a glance.
  const ranked = open
    .map((c) => ({ c, demand: Object.values(c.require ?? {}).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.demand - a.demand || a.c.id.localeCompare(b.c.id))
    .map((x) => x.c);
  const list = [...ranked.slice(0, 4), CAREER_BY_ID.drifter];
  return list.map((c) => ({ id: c.id }));
}

export function resolveChoice(state, optionId) {
  const pending = state.pending;
  if (!pending) return null;
  state.pending = null;

  if (pending.kind === 'career') {
    state.career = optionId;
    return push(state, {
      type: 'career',
      age: state.age,
      careerId: optionId,
      phase: phaseOf(state.age),
      tags: ['career'],
    });
  }

  const event = EVENTS.find((e) => e.id === pending.eventId);
  const choice = event?.choices?.find((c) => c.id === optionId) ?? event?.choices?.[0];
  if (!choice) return null;
  if (choice.flag) state.flags.add(choice.flag);
  const applied = applyEventEffects(state, choice.effects);
  return push(state, {
    type: 'choice',
    age: pending.age,
    eventId: pending.eventId,
    choiceId: choice.id,
    phase: phaseOf(pending.age),
    tags: event?.tags ?? [],
    effects: applied,
  });
}

function die(state, deathId, batch) {
  state.alive = false;
  const entry = {
    type: 'death',
    age: state.age,
    deathId,
    phase: phaseOf(state.age),
    tags: ['death'],
  };
  batch.push(push(state, entry));
  state.ending = summary(state);
}

/* ──────────────────────────── summary ─────────────────────────── */

export function contextOf(state) {
  return {
    stats: state.stats,
    money: state.money,
    age: state.age,
    flags: state.flags,
    talents: state.talents,
    career: state.career,
    history: state.history,
    peak: state.peak,
    minMood: state.minMood,
    peakMood: state.peakMood,
  };
}

export function summary(state) {
  const ctx = contextOf(state);
  const { ending, score, grade } = resolveEnding(ctx);
  const unlocked = ACHIEVEMENTS.filter((a) => {
    try {
      return a.check(ctx);
    } catch {
      return false;
    }
  }).map((a) => ({ id: a.id, icon: a.icon }));
  state.unlocked = unlocked;
  return {
    age: state.age,
    stats: { ...state.stats },
    money: state.money,
    career: state.career,
    talents: state.talents.map((t) => t.id),
    endingId: ending.id,
    endingIcon: ending.icon,
    gradeId: grade.id,
    gradeTone: grade.tone,
    score,
    total: statTotal(state.stats),
    achievements: unlocked,
    seed: state.seed,
    eventCount: state.history.filter((h) => h.type === 'event' || h.type === 'choice').length,
  };
}

export { STAT_KEYS };
