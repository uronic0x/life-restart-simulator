/**
 * Content integrity: every id in the data layer must have copy in BOTH
 * languages, and the two dictionaries must have identical key sets.
 * Run: node test/i18n.test.js
 */
import { zh } from '../src/i18n/zh.js';
import { en } from '../src/i18n/en.js';
import { EVENTS } from '../src/content/events.js';
import { TALENTS } from '../src/content/talents.js';
import { CAREERS } from '../src/content/careers.js';
import { DEATHS } from '../src/content/deaths.js';
import { ACHIEVEMENTS } from '../src/content/achievements.js';
import { ENDINGS, GRADES } from '../src/content/endings.js';

const problems = [];

/** Flatten to dotted paths so we can diff the two dictionaries. */
function flatten(obj, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out);
    else out.add(path);
  }
  return out;
}

const zhKeys = flatten(zh);
const enKeys = flatten(en);

for (const key of zhKeys) if (!enKeys.has(key)) problems.push(`missing in en: ${key}`);
for (const key of enKeys) if (!zhKeys.has(key)) problems.push(`missing in zh: ${key}`);

const has = (dict, path) => path.split('.').reduce((acc, p) => acc?.[p], dict) !== undefined;

function requireKey(section, id, { choices = false } = {}) {
  for (const [name, dict] of [['zh', zh], ['en', en]]) {
    if (!has(dict, `${section}.${id}`)) {
      problems.push(`${name}: missing ${section}.${id}`);
      continue;
    }
    if (choices) {
      const entry = dict[section][id];
      if (!entry?.choices) problems.push(`${name}: ${section}.${id} needs choices copy`);
    }
  }
}

for (const e of EVENTS) requireKey('events', e.id, { choices: Boolean(e.choices) });
for (const t of TALENTS) requireKey('talents', t.id);
for (const c of CAREERS) {
  requireKey('careers', c.id);
  for (const key of ['name', 'desc']) {
    if (!has(zh, `careers.${c.id}.${key}`)) problems.push(`zh: missing careers.${c.id}.${key}`);
    if (!has(en, `careers.${c.id}.${key}`)) problems.push(`en: missing careers.${c.id}.${key}`);
  }
}
for (const d of DEATHS) requireKey('deaths', d.id);
for (const a of ACHIEVEMENTS) requireKey('achievements', a.id);
for (const e of ENDINGS) requireKey('endings', e.id);
for (const g of GRADES) requireKey('grades', g.id);

// Choice option labels must exist for every branch of every choice event.
for (const e of EVENTS) {
  if (!e.choices) continue;
  for (const c of e.choices) {
    for (const [name, dict] of [['zh', zh], ['en', en]]) {
      if (!has(dict, `events.${e.id}.choices.${c.id}`)) {
        problems.push(`${name}: missing events.${e.id}.choices.${c.id}`);
      }
    }
  }
}

// Placeholders must match between languages (catches {from}/{to} typos).
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const key of zhKeys) {
  if (!enKeys.has(key)) continue;
  const get = (dict) => key.split('.').reduce((a, p) => a?.[p], dict);
  const a = get(zh);
  const b = get(en);
  if (typeof a === 'string' && typeof b === 'string' && placeholders(a) !== placeholders(b)) {
    problems.push(`placeholder mismatch at ${key}: zh(${placeholders(a)}) vs en(${placeholders(b)})`);
  }
}

if (problems.length) {
  console.error(`\n❌ ${problems.length} i18n problem(s):\n`);
  for (const p of problems) console.error(`   · ${p}`);
  process.exit(1);
}

console.log(
  `\n✅ i18n complete: ${EVENTS.length} events, ${TALENTS.length} talents, ` +
    `${CAREERS.length} careers, ${ACHIEVEMENTS.length} achievements — all in zh + en.\n`,
);
