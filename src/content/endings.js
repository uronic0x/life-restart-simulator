/**
 * Endings are evaluated top-down; the first matching entry wins.
 *
 * Thresholds are calibrated against the 3000-life simulation and re-checked by
 * test/engine.test.js on every run (every ending must appear at least once and
 * no single ending may take more than 60% of all lives):
 *   charm/intellect p50 ≈ 11–12, p90 ≈ 17
 *   physique (at death, ≥60 yrs) p50 ≈ 6, p90 ≈ 12
 *   mood p50 ≈ 25 (drift pulls it back to a baseline, so lows are rare)
 *   money p50 ≈ 12, p90 ≈ 135, p25 ≈ -31 (the ¥-40 floor is hit by ~22%)
 */
import { statTotal } from '../core/stats.js';

/** The four stats that share the point pool (mood has its own drift). */
const CORE_KEYS = ['charm', 'intellect', 'physique', 'wealth'];

export const ENDINGS = [
  // ── legendary: genuinely rare, needs several things at once ──────
  {
    id: 'end_legend',
    icon: '👑',
    check: (c) => c.stats.intellect >= 20 && c.money >= 105 && c.stats.mood >= 20,
  },
  { id: 'end_tycoon', icon: '🏦', check: (c) => c.money >= 150 },
  { id: 'end_idol', icon: '🌟', check: (c) => c.stats.charm >= 21 && c.age >= 60 },
  { id: 'end_ironman', icon: '🏋️', check: (c) => c.stats.physique >= 16 && c.age >= 85 },

  // ── epic ────────────────────────────────────────────────────────
  { id: 'end_sage', icon: '📚', check: (c) => c.stats.intellect >= 18 },
  { id: 'end_beloved', icon: '💞', check: (c) => c.stats.charm >= 16 && c.stats.mood >= 24 },
  { id: 'end_wanderer', icon: '🧭', check: (c) => c.career === 'drifter' && c.stats.mood >= 20 },
  // All-rounder: every core stat must stand on its own. A plain stat-total
  // threshold was unreachable (max observed ≈65, p99 = 52 → 0.0%), because
  // one hyper-invested stat could carry the sum alone. Requiring a floor in
  // each of the four core stats plus a strong total lands at ~1%.
  {
    id: 'end_hexagon',
    icon: '⬡',
    check: (c) => CORE_KEYS.every((k) => c.stats[k] >= 8) && statTotal(c.stats) >= 44,
  },

  // ── notable ─────────────────────────────────────────────────────
  { id: 'end_wealthy', icon: '💎', check: (c) => c.money >= 85 },
  { id: 'end_strong', icon: '🌳', check: (c) => c.stats.physique >= 13 },
  // Burnout: a life that kept going while the person inside it stopped.
  // Final mood <= 6 never happened (min observed ≈6, p1 ≈12), so the old
  // cut-off produced a literally unreachable ending.
  { id: 'end_burnout', icon: '🕯️', check: (c) => c.stats.mood <= 11 },

  // ── default ─────���───────────────────────────────────────────────
  { id: 'end_ordinary', icon: '🍂', check: () => true },
];

/** Weighted life score used for the final grade and the leaderboard. */
export function lifeScore(ctx) {
  const { stats, money, age } = ctx;
  const base =
    stats.charm * 1.0 +
    stats.intellect * 1.2 +
    stats.physique * 1.1 +
    stats.wealth * 1.0 +
    stats.mood * 0.8 +
    Math.max(0, money) * 0.55 +
    Math.max(0, age - 40) * 0.7;
  return Math.max(0, Math.round(base));
}

/**
 * Grade cut-offs, calibrated so the bell curve lands where a report card
 * should: SSS ~1%, SS ~2%, S ~6%, A ~12%, B ~25%, C ~30%, D ~18%, F ~6%.
 */
export const GRADES = [
  { id: 'grade_sss', min: 206, tone: 'legendary' },
  { id: 'grade_ss', min: 186, tone: 'epic' },
  { id: 'grade_s', min: 165, tone: 'epic' },
  { id: 'grade_a', min: 134, tone: 'rare' },
  { id: 'grade_b', min: 101, tone: 'rare' },
  { id: 'grade_c', min: 85, tone: 'common' },
  { id: 'grade_d', min: 58, tone: 'common' },
  { id: 'grade_f', min: 0, tone: 'poor' },
];

export function resolveEnding(ctx) {
  const ending = ENDINGS.find((e) => e.check(ctx)) ?? ENDINGS[ENDINGS.length - 1];
  const score = lifeScore(ctx);
  const grade = GRADES.find((g) => score >= g.min) ?? GRADES[GRADES.length - 1];
  return { ending, score, grade };
}
