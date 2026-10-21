/**
 * Achievements unlock during a life and persist in localStorage.
 * `check(ctx)` receives the run context and returns true when earned.
 *
 * ctx = { stats, money, age, flags, talents, career, history, peak, minMood, peakMood }
 *
 * Two rules learned from the 3000-life simulation:
 *   1. Never gate on a *final* mood — drift pulls every long life back to its
 *      baseline, so "mood <= 0" was unreachable (observed minimum ≈ 6).
 *      Use `minMood` / `peakMood` for emotional extremes.
 *   2. Never gate on a *final* physique/charm/intellect for a "peak" feat —
 *      the body decays after 45. Use `peak` for "you were once this good".
 */
const fourPeak = (c) =>
  ['charm', 'intellect', 'physique', 'wealth'].reduce((sum, k) => sum + (c.peak?.[k] ?? c.stats[k]), 0);

export const ACHIEVEMENTS = [
  { id: 'ach_first', icon: '🌱', check: (c) => c.history.length >= 1 },
  { id: 'ach_longlife', icon: '🕰️', check: (c) => c.age >= 90 },
  { id: 'ach_centenarian', icon: '💯', check: (c) => c.age >= 100 },
  { id: 'ach_genius', icon: '🧠', check: (c) => (c.peak?.intellect ?? c.stats.intellect) >= 24 },
  { id: 'ach_icon', icon: '💫', check: (c) => (c.peak?.charm ?? c.stats.charm) >= 23 },
  { id: 'ach_titan', icon: '💪', check: (c) => (c.peak?.physique ?? c.stats.physique) >= 25 },
  { id: 'ach_tycoon', icon: '💰', check: (c) => c.money >= 120 },
  { id: 'ach_broke', icon: '🕳️', check: (c) => c.money <= -20 },
  { id: 'ach_married', icon: '💍', check: (c) => c.flags.has('married') },
  { id: 'ach_parent', icon: '🍼', check: (c) => c.flags.has('parent') },
  { id: 'ach_scholar', icon: '🎓', check: (c) => c.flags.has('educated') },
  { id: 'ach_dropout', icon: '🚪', check: (c) => c.flags.has('dropout') },
  // "Genuinely content": ended high *and* never really bottomed out. Peak
  // mood alone is too easy (2/3 of lives touch 27) and final mood alone is
  // indistinguishable from luck, so this pairs the two.
  {
    id: 'ach_happy',
    icon: '😄',
    check: (c) => c.stats.mood >= 28 && (c.minMood ?? c.stats.mood) >= 15,
  },
  { id: 'ach_burnout', icon: '🥀', check: (c) => (c.minMood ?? c.stats.mood) <= 6 },
  { id: 'ach_perfect', icon: '🏆', check: (c) => fourPeak(c) >= 60 },
  { id: 'ach_meta', icon: '🌀', check: (c) => c.talents.some((t) => t.id === 'transmigrator' || t.id === 'rebirth') },
  { id: 'ach_founder', icon: '🚀', check: (c) => c.career === 'founder' },
  { id: 'ach_drifter', icon: '🍃', check: (c) => c.career === 'drifter' },
  { id: 'ach_koi', icon: '🎏', check: (c) => c.talents.some((t) => t.id === 'koi') },
  { id: 'ach_survivor', icon: '🛡️', check: (c) => c.age >= 70 && (c.peak?.physique ?? c.stats.physique) >= 22 },
];

export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id);
