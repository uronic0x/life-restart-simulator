/**
 * Careers. Chosen at a milestone event; give yearly income and unlock flavour.
 * `require` is checked against stats/flags when the player picks.
 *
 * Income is per working year, *before* upkeep (rent, family, lifestyle), so a
 * career's real value is `income − upkeep`. Upkeep is 2 base + 1 married
 * + 2 children + wealth/15, so a stable job must clear ~4 to stay afloat.
 * These bands were re-tuned after the 3000-life simulation showed 62% of all
 * lives ending in debt and 42% pinned to the −40 floor.
 */
export const CAREERS = [
  {
    id: 'scholar',
    require: { intellect: 8 },
    income: [2, 4],
    tier: 'stable',
  },
  {
    id: 'engineer',
    require: { intellect: 6 },
    income: [3, 6],
    tier: 'stable',
  },
  {
    id: 'doctor',
    require: { intellect: 9, physique: 4 },
    income: [5, 8],
    tier: 'prestige',
  },
  {
    id: 'artist',
    require: { charm: 7 },
    income: [1, 9],
    tier: 'wild',
  },
  {
    id: 'athlete',
    require: { physique: 9 },
    income: [2, 9],
    tier: 'wild',
  },
  {
    id: 'trader',
    require: { intellect: 5, wealth: 5 },
    income: [-3, 10],
    tier: 'wild',
  },
  {
    id: 'civilservant',
    require: { intellect: 6 },
    income: [3, 5],
    tier: 'stable',
  },
  {
    id: 'influencer',
    require: { charm: 8 },
    income: [1, 11],
    tier: 'wild',
  },
  {
    id: 'founder',
    require: { intellect: 7, wealth: 4 },
    income: [-4, 15],
    tier: 'wild',
  },
  {
    id: 'craftsman',
    require: { physique: 5 },
    income: [2, 4],
    tier: 'stable',
  },
  {
    id: 'teacher',
    require: { intellect: 5, mood: 5 },
    income: [2, 3],
    tier: 'stable',
  },
  {
    // No salary, but the road pays for itself — otherwise this choice is a
    // guaranteed bankruptcy rather than a lifestyle.
    id: 'drifter',
    require: {},
    income: [1, 3],
    tier: 'wild',
  },
];

export const CAREER_BY_ID = Object.fromEntries(CAREERS.map((c) => [c.id, c]));
