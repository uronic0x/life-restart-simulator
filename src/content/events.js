/**
 * Event pool. Text lives in i18n/events.js keyed by `id`.
 *
 * Schema
 *   id       unique key, also the i18n lookup key
 *   age      [min, max] in years (inclusive)
 *   weight   relative chance when eligible (default 10)
 *   once     fire at most once per life
 *   tags     ['good' | 'bad' | 'neutral' | 'story' | 'career' | 'love' | 'money' | 'health']
 *   require  { statKey: minValue } — all must pass
 *   forbid   talent flag that blocks the event
 *   effects  stat deltas; `money` is handled separately
 *   choices  optional [{ id, effects, require, flag }] — pauses the flow
 */
export const EVENTS = [
  // ─── 0-5 · infancy ───────────────────────────────────────────────
  { id: 'inf_cute', age: [0, 5], weight: 12, once: true, tags: ['good'], effects: { charm: 1 } },
  { id: 'inf_firststep', age: [1, 3], weight: 14, once: true, tags: ['good'], effects: { mood: 2 } },
  { id: 'inf_fever', age: [0, 5], weight: 10, tags: ['bad', 'health'], effects: { physique: -1, mood: -1 } },
  { id: 'inf_grab', age: [1, 2], weight: 12, once: true, tags: ['good'], effects: { intellect: 1 } },
  { id: 'inf_fall', age: [1, 5], weight: 7, once: true, tags: ['bad'], effects: { charm: -1 } },
  { id: 'inf_story', age: [2, 5], weight: 10, once: true, tags: ['good'], effects: { intellect: 1, mood: 1 } },
  { id: 'inf_lonely', age: [2, 5], weight: 6, tags: ['bad'], effects: { mood: -2 } },
  { id: 'inf_pet', age: [3, 5], weight: 8, tags: ['good'], effects: { mood: 2 } },

  // ─── 6-11 · childhood ───────────────────────────────────────────
  { id: 'kid_first', age: [6, 11], weight: 10, tags: ['good'], effects: { intellect: 1, mood: 2 } },
  { id: 'kid_games', age: [6, 11], weight: 11, tags: ['neutral'], effects: { intellect: -1, mood: 1 } },
  { id: 'kid_sport', age: [6, 11], weight: 10, tags: ['good', 'health'], effects: { physique: 2 } },
  { id: 'kid_bully', age: [6, 11], weight: 8, tags: ['bad'], effects: { mood: -2, physique: -1 } },
  { id: 'kid_friend', age: [6, 11], weight: 11, once: true, tags: ['good'], effects: { mood: 3 } },
  { id: 'kid_piano', age: [6, 11], weight: 7, once: true, tags: ['good'], effects: { charm: 2, wealth: -1 } },
  { id: 'kid_math', age: [7, 11], weight: 7, tags: ['good'], effects: { intellect: 2 } },
  { id: 'kid_sick', age: [6, 11], weight: 7, tags: ['bad', 'health'], effects: { physique: -1 } },
  { id: 'kid_sibling', age: [6, 11], weight: 6, once: true, tags: ['neutral'], effects: { mood: 1, wealth: -1 } },
  { id: 'kid_shy', age: [6, 11], weight: 6, tags: ['bad'], effects: { charm: -1, mood: -1 } },
  { id: 'kid_growth', age: [6, 11], weight: 10, tags: ['good', 'health'], effects: { physique: 1 } },
  { id: 'kid_chores', age: [6, 11], weight: 8, tags: ['good'], effects: { physique: 1, mood: -1 } },
  { id: 'kid_allowance', age: [6, 11], weight: 8, tags: ['money'], effects: { money: 2 } },
  { id: 'kid_familytrip', age: [6, 11], weight: 8, tags: ['good'], effects: { mood: 2, wealth: 1 } },
  { id: 'kid_goodlooks', age: [6, 11], weight: 8, tags: ['good'], effects: { charm: 2 } },

  {
    id: 'kid_hobby',
    age: [6, 11],
    weight: 14,
    once: true,
    tags: ['story', 'good'],
    choices: [
      { id: 'sport', effects: { physique: 2, mood: 1 }, flag: 'sporty' },
      { id: 'books', effects: { intellect: 2 }, flag: 'bookworm' },
      { id: 'music', effects: { charm: 2, mood: 1 }, flag: 'musical' },
    ],
  },

  // ─── 12-17 · teens ──────────────────────────────────────────────
  {
    id: 'teen_crush',
    age: [12, 17],
    weight: 10,
    tags: ['love'],
    choices: [
      { id: 'confess', effects: { charm: 1, mood: 3 }, require: { charm: 6 } },
      { id: 'hide', effects: { mood: -2, intellect: 1 } },
    ],
  },
  {
    id: 'teen_cheat',
    age: [12, 17],
    weight: 7,
    tags: ['neutral'],
    choices: [
      { id: 'refuse', effects: { intellect: 1, mood: -1 }, flag: 'honest' },
      { id: 'accept', effects: { intellect: 2, mood: -3 }, flag: 'guilt' },
    ],
  },
  { id: 'teen_exam', age: [14, 17], weight: 12, once: true, tags: ['story'], effects: { intellect: 2, mood: -1 } },
  { id: 'teen_club', age: [12, 17], weight: 9, tags: ['good'], effects: { mood: 2, charm: 1 } },
  { id: 'teen_rebel', age: [13, 17], weight: 7, tags: ['bad'], effects: { mood: -1, physique: 1, wealth: -1 } },
  { id: 'teen_night', age: [13, 17], weight: 8, tags: ['bad'], effects: { physique: -1, intellect: 1 } },
  { id: 'teen_novel', age: [12, 17], weight: 8, tags: ['neutral'], effects: { intellect: 1, mood: 1 } },
  { id: 'teen_sportstar', age: [13, 17], weight: 6, tags: ['good', 'health'], effects: { physique: 2, charm: 1 } },
  { id: 'teen_lonely', age: [12, 17], weight: 6, tags: ['bad'], effects: { mood: -2 } },
  { id: 'teen_growth', age: [12, 17], weight: 11, tags: ['good', 'health'], effects: { physique: 2 } },
  { id: 'teen_parttime', age: [15, 17], weight: 9, tags: ['money'], effects: { money: 3, physique: -1 } },
  { id: 'teen_makeup', age: [14, 17], weight: 8, tags: ['good'], effects: { charm: 2, money: -1 } },
  { id: 'teen_pocketmoney', age: [12, 17], weight: 7, tags: ['money'], effects: { money: 2 } },
  { id: 'teen_growthspurt', age: [13, 17], weight: 8, tags: ['good'], effects: { physique: 1, charm: 1 } },
  { id: 'teen_debate', age: [13, 17], weight: 6, tags: ['good'], effects: { intellect: 1, charm: 1 } },

  {
    id: 'teen_track',
    age: [15, 17],
    weight: 16,
    once: true,
    tags: ['story'],
    choices: [
      { id: 'science', effects: { intellect: 2, mood: -1 }, flag: 'science_track' },
      { id: 'humanities', effects: { charm: 2, intellect: 1 }, flag: 'arts_track' },
      { id: 'vocational', effects: { physique: 1, wealth: 1, money: 2 }, flag: 'vocational' },
    ],
  },

  // ─── 18-24 · youth ──────────────────────────────────────────────
  {
    id: 'youth_major',
    age: [18, 19],
    weight: 40,
    once: true,
    tags: ['story'],
    require: { intellect: 4 },
    choices: [
      { id: 'science', effects: { intellect: 3, mood: -1 }, flag: 'educated' },
      { id: 'arts', effects: { charm: 3, mood: 1 }, flag: 'educated' },
      { id: 'dropout', effects: { wealth: 1, mood: 1, intellect: -1 }, flag: 'dropout' },
    ],
  },
  { id: 'youth_love', age: [18, 24], weight: 11, tags: ['love'], effects: { mood: 3, charm: 1 } },
  { id: 'youth_heartbreak', age: [18, 26], weight: 9, tags: ['bad', 'love'], effects: { mood: -3, intellect: 1 } },
  { id: 'youth_parttime', age: [18, 24], weight: 10, tags: ['money'], effects: { money: 3, physique: -1 } },
  { id: 'youth_gym', age: [18, 30], weight: 9, tags: ['good', 'health'], effects: { physique: 2, mood: 1 } },
  { id: 'youth_scam', age: [18, 28], weight: 6, tags: ['bad', 'money'], effects: { money: -4, mood: -2 } },
  { id: 'youth_travel', age: [18, 28], weight: 8, tags: ['good'], effects: { mood: 3, money: -2 } },
  { id: 'youth_sidehustle', age: [19, 29], weight: 8, tags: ['money'], effects: { money: 4, mood: -1, physique: -1 } },
  { id: 'youth_health', age: [18, 30], weight: 10, tags: ['good', 'health'], effects: { physique: 2 } },
  { id: 'youth_looksmax', age: [18, 30], weight: 9, tags: ['good'], effects: { charm: 2, money: -1 } },
  { id: 'youth_firstpay', age: [18, 24], weight: 10, tags: ['money'], effects: { money: 3, mood: 2 } },
  { id: 'youth_intern', age: [19, 24], weight: 9, tags: ['good', 'career'], effects: { intellect: 1, money: 2 } },
  { id: 'youth_friendgroup', age: [18, 26], weight: 9, tags: ['good'], effects: { mood: 2, charm: 1 } },
  { id: 'youth_learnskill', age: [18, 30], weight: 9, tags: ['good'], effects: { intellect: 2 } },

  {
    id: 'youth_city',
    age: [18, 26],
    weight: 15,
    once: true,
    tags: ['story'],
    choices: [
      { id: 'stay', effects: { mood: 3, money: 1 }, flag: 'hometown' },
      { id: 'move', effects: { money: 5, mood: -2, intellect: 1 }, flag: 'moved_city' },
    ],
  },

  // ─── 25-39 · adulthood ──────────────────────────────────────────
  {
    id: 'adult_marriage',
    age: [24, 34],
    weight: 26,
    once: true,
    tags: ['story', 'love'],
    require: { charm: 5 },
    choices: [
      { id: 'marry', effects: { mood: 5, money: -3 }, flag: 'married' },
      { id: 'wait', effects: { mood: 1 }, flag: 'single' },
    ],
  },
  {
    id: 'adult_child',
    age: [26, 38],
    weight: 22,
    once: true,
    tags: ['story'],
    choices: [
      { id: 'have', effects: { mood: 4, money: -5, physique: -1 }, flag: 'parent' },
      { id: 'no', effects: { mood: 1 }, flag: 'childfree' },
    ],
  },
  { id: 'adult_promotion', age: [25, 40], weight: 11, tags: ['good', 'career'], effects: { money: 4, mood: 2 } },
  { id: 'adult_layoff', age: [25, 45], weight: 8, tags: ['bad', 'career'], effects: { money: -4, mood: -3 } },
  { id: 'adult_burnout', age: [26, 45], weight: 9, tags: ['bad', 'health'], effects: { physique: -2, mood: -2 } },
  { id: 'adult_house', age: [28, 42], weight: 8, tags: ['money'], require: { money: 6 }, effects: { money: -8, mood: 4 } },
  { id: 'adult_baby', age: [26, 40], weight: 10, tags: ['neutral'], effects: { mood: 2, physique: -1 } },
  { id: 'adult_friendlost', age: [28, 45], weight: 7, tags: ['bad'], effects: { mood: -2 } },
  { id: 'adult_hobby', age: [25, 50], weight: 9, tags: ['good'], effects: { mood: 2, money: -1 } },
  { id: 'adult_volunteer', age: [25, 55], weight: 7, tags: ['good'], effects: { mood: 2, charm: 1 } },
  { id: 'adult_investwin', age: [26, 50], weight: 9, tags: ['money'], effects: { money: 5, mood: 1 } },
  { id: 'adult_investloss', age: [26, 50], weight: 9, tags: ['bad', 'money'], effects: { money: -5, mood: -2 } },
  { id: 'adult_raise', age: [26, 50], weight: 11, tags: ['good', 'money'], effects: { money: 3, mood: 1 } },
  { id: 'adult_fitness', age: [28, 50], weight: 10, tags: ['good', 'health'], effects: { physique: 2, mood: 1 } },
  { id: 'adult_wealth', age: [28, 52], weight: 8, tags: ['money'], effects: { wealth: 2 } },
  { id: 'adult_grooming', age: [26, 50], weight: 8, tags: ['good'], effects: { charm: 1, mood: 1 } },
  { id: 'adult_careerwin', age: [26, 50], weight: 8, tags: ['good', 'career'], effects: { money: 4, intellect: 1 } },

  {
    id: 'adult_sideproject',
    age: [26, 48],
    weight: 13,
    tags: ['money'],
    choices: [
      { id: 'take', effects: { money: 6, mood: -2, physique: -1 }, flag: 'grinder' },
      { id: 'decline', effects: { mood: 2 }, flag: 'balanced' },
    ],
  },
  {
    id: 'adult_parentsick',
    age: [30, 52],
    weight: 11,
    tags: ['story'],
    choices: [
      { id: 'care', effects: { mood: 3, money: -6, physique: -1 }, flag: 'caregiver' },
      { id: 'pay', effects: { money: -4, mood: -1 } },
      { id: 'ignore', effects: { mood: -4, money: 2 } },
    ],
  },

  // ─── 40-59 · midlife ────────────────────────────────────────────
  { id: 'mid_crisis', age: [40, 50], weight: 10, tags: ['bad'], effects: { mood: -3, money: -2 } },
  { id: 'mid_checkup', age: [40, 58], weight: 11, tags: ['health'], effects: { physique: -2, mood: -1 } },
  { id: 'mid_health', age: [40, 58], weight: 9, tags: ['good', 'health'], effects: { physique: 2, mood: 2 } },
  { id: 'mid_bigjob', age: [40, 55], weight: 7, tags: ['good', 'career'], effects: { money: 6, mood: 2 } },
  { id: 'mid_parents', age: [40, 60], weight: 9, tags: ['story'], effects: { mood: -3, intellect: 1 } },
  { id: 'mid_kidgrown', age: [42, 58], weight: 8, tags: ['good'], effects: { mood: 3 } },
  { id: 'mid_debt', age: [40, 58], weight: 6, tags: ['bad', 'money'], effects: { money: -6, mood: -2 } },
  { id: 'mid_teach', age: [40, 60], weight: 6, tags: ['good'], effects: { mood: 2, charm: 1 } },
  { id: 'mid_estate', age: [45, 60], weight: 5, tags: ['money'], effects: { money: 7, mood: 1 } },
  { id: 'mid_secondwind', age: [42, 58], weight: 9, tags: ['good', 'health'], effects: { physique: 2, mood: 2 } },
  { id: 'mid_wealth', age: [40, 58], weight: 8, tags: ['money'], effects: { wealth: 2, money: 2 } },
  { id: 'mid_newskill', age: [40, 58], weight: 7, tags: ['good'], effects: { intellect: 2, mood: 1 } },
  { id: 'mid_glowup', age: [40, 58], weight: 7, tags: ['good'], effects: { charm: 2, money: -1 } },

  {
    id: 'mid_healthscare',
    age: [45, 58],
    weight: 12,
    tags: ['health'],
    choices: [
      { id: 'treat', effects: { physique: 2, money: -6, mood: 1 }, flag: 'treated' },
      { id: 'delay', effects: { physique: -3, money: 1, mood: -2 } },
    ],
  },
  {
    id: 'mid_mentor',
    age: [44, 58],
    weight: 10,
    tags: ['good'],
    choices: [
      { id: 'teach', effects: { charm: 2, mood: 3 }, flag: 'mentor' },
      { id: 'push', effects: { money: 5, intellect: 1, mood: -2 }, flag: 'climber' },
    ],
  },

  // ─── 60-74 · senior ─────────────────────────────────────────────
  { id: 'sen_retire', age: [60, 66], weight: 30, once: true, tags: ['story'], effects: { mood: 4, money: -1 } },
  { id: 'sen_travel', age: [60, 75], weight: 10, tags: ['good'], effects: { mood: 3, money: -3 } },
  { id: 'sen_taichi', age: [60, 80], weight: 11, tags: ['good', 'health'], effects: { physique: 1, mood: 2 } },
  { id: 'sen_tech', age: [60, 80], weight: 9, tags: ['good'], effects: { intellect: 1, mood: 2 } },
  { id: 'sen_fall', age: [62, 85], weight: 9, tags: ['bad', 'health'], effects: { physique: -3, mood: -2 } },
  { id: 'sen_spouse', age: [62, 85], weight: 8, tags: ['bad', 'love'], effects: { mood: -5, physique: -1 } },
  { id: 'sen_garden', age: [60, 85], weight: 10, tags: ['good'], effects: { mood: 3 } },
  { id: 'sen_grandkid', age: [60, 85], weight: 9, tags: ['good'], effects: { mood: 4 } },
  { id: 'sen_memoir', age: [65, 88], weight: 6, tags: ['good'], effects: { mood: 3, intellect: 1 } },
  { id: 'sen_pension', age: [62, 85], weight: 10, tags: ['money'], effects: { money: 3 } },
  { id: 'sen_dance', age: [60, 82], weight: 9, tags: ['good', 'health'], effects: { physique: 1, mood: 2, charm: 1 } },
  { id: 'sen_community', age: [60, 85], weight: 9, tags: ['good'], effects: { mood: 2, charm: 1 } },

  {
    id: 'sen_estate',
    age: [64, 85],
    weight: 11,
    once: true,
    tags: ['story', 'money'],
    require: { money: 10 },
    choices: [
      { id: 'give', effects: { mood: 4, money: -8 }, flag: 'generous' },
      { id: 'keep', effects: { money: 2, mood: -1 } },
      { id: 'donate', effects: { mood: 6, charm: 1, money: -10 }, flag: 'philanthropist' },
    ],
  },

  // ─── 75+ · elder ────────────────────────────────────────────────
  { id: 'eld_sun', age: [75, 110], weight: 11, tags: ['good'], effects: { mood: 2 } },
  { id: 'eld_hospital', age: [75, 110], weight: 10, tags: ['bad', 'health'], effects: { physique: -4, money: -2 } },
  { id: 'eld_story', age: [75, 110], weight: 10, tags: ['good'], effects: { mood: 3 } },
  { id: 'eld_legacy', age: [78, 110], weight: 8, tags: ['good'], effects: { mood: 3, wealth: 1 } },
  { id: 'eld_sleep', age: [80, 110], weight: 9, tags: ['neutral'], effects: { physique: -1 } },

  {
    id: 'eld_wish',
    age: [78, 110],
    weight: 10,
    once: true,
    tags: ['story'],
    choices: [
      { id: 'family', effects: { mood: 5, charm: 1 }, flag: 'family_first' },
      { id: 'world', effects: { mood: 3, money: -3 }, flag: 'one_last_trip' },
      { id: 'quiet', effects: { mood: 2, physique: 1 } },
    ],
  },
];
