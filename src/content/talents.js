/**
 * Talents are drawn before birth. Pure data — display text lives in i18n.
 *
 * rarity: 1 common · 2 rare · 3 epic · 4 legendary
 * effects: applied once at birth
 * flags:   behaviour switches read by the engine
 */
export const TALENTS = [
  { id: 'beauty', rarity: 1, effects: { charm: 3 }, flags: [] },
  { id: 'photographic', rarity: 1, effects: { intellect: 3 }, flags: [] },
  { id: 'ironbody', rarity: 1, effects: { physique: 3 }, flags: [] },
  { id: 'richfamily', rarity: 1, effects: { wealth: 3 }, flags: [] },
  { id: 'optimist', rarity: 1, effects: { mood: 6 }, flags: ['moodShield'] },
  { id: 'sixfold', rarity: 2, effects: { charm: 1, intellect: 1, physique: 1, wealth: 1 }, flags: [] },

  { id: 'koi', rarity: 2, effects: {}, flags: ['lucky'] },
  { id: 'cursed', rarity: 2, effects: { wealth: 2 }, flags: ['unlucky'] },
  { id: 'transmigrator', rarity: 2, effects: { intellect: 4, physique: -2 }, flags: ['meta'] },
  { id: 'workaholic', rarity: 2, effects: { intellect: 1, wealth: 2, mood: -2 }, flags: ['incomeBoost'] },
  { id: 'socialbutterfly', rarity: 2, effects: { charm: 2, mood: 2 }, flags: ['social'] },
  { id: 'nightowl', rarity: 2, effects: { intellect: 2, physique: -1 }, flags: [] },

  { id: 'daoist', rarity: 3, effects: { physique: 2 }, flags: ['noInfantDeath', 'longevity'] },
  { id: 'businessgenius', rarity: 3, effects: { intellect: 2, wealth: 2 }, flags: ['moneySense'] },
  { id: 'middleschoolsyndrome', rarity: 3, effects: { intellect: -1, physique: 1, mood: 4 }, flags: ['moodShield'] },
  { id: 'prodigy', rarity: 3, effects: { intellect: 5, charm: -1 }, flags: ['scholar'] },

  { id: 'chosenone', rarity: 4, effects: { charm: 2, intellect: 2, physique: 2, wealth: 2 }, flags: ['lucky', 'longevity'] },
  { id: 'rebirth', rarity: 4, effects: { intellect: 3, mood: 8 }, flags: ['meta', 'lucky'] },
];

export const RARITY_WEIGHT = { 1: 60, 2: 28, 3: 10, 4: 2 };
