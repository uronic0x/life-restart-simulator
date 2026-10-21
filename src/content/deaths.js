/**
 * Death checks run every year they're eligible for.
 *
 * `base`   yearly probability
 * `require`  minimum stats (all must pass)
 * `requireMax` maximum stats (all must be <=); useful for "only when miserable"
 * `tags`   flavour grouping
 *
 * Natural old-age mortality is handled separately in engine.js via an
 * exponential curve, not by a flat base rate — that keeps lifespans realistic.
 */
export const DEATHS = [
  // Infancy starts at 3, not 0: dying at age 1 gave the player a one-click
  // "life" with nothing in it. The rate is unchanged — only the window moved.
  { id: 'death_infant', age: [3, 5], base: 0.0035, tags: ['health'] },
  { id: 'death_accident', age: [12, 70], base: 0.0009, tags: ['accident'] },
  {
    id: 'death_overwork',
    age: [28, 66],
    base: 0.02,
    tags: ['health'],
    // Only the genuinely miserable burn out. A cut-off of mood <= 2 was
    // unreachable in 3000 simulated lives (min final mood ≈ 6, and only
    // 0.25% of working-age years sat below 8), so this cause never fired.
    requireMax: { mood: 10 },
  },
  { id: 'death_illness', age: [45, 110], base: 0.0026, tags: ['health'] },
];
/** Natural mortality starts here and compounds yearly. */
export const NATURAL_DEATH = {
  from: 60,
  base: 0.0035,
  /** e-folding time in years: smaller = steeper curve */
  scale: 8.5,
};
