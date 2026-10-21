/**
 * Zero-dependency engine smoke test. Run: node test/engine.test.js
 * Simulates many lives and asserts invariants — no browser needed.
 */
import assert from 'node:assert/strict';
import {
  createLife,
  advance,
  resolveChoice,
  setTalentPool,
  drawTalents,
  rollBaseStats,
  summary,
  MAX_AGE,
  STAT_KEYS,
} from '../src/core/engine.js';
import { createRng } from '../src/core/rng.js';
import { TALENTS } from '../src/content/talents.js';
import { EVENTS } from '../src/content/events.js';
import { ENDINGS, GRADES } from '../src/content/endings.js';
import { CAREER_BY_ID } from '../src/content/careers.js';
import { ACHIEVEMENTS } from '../src/content/achievements.js';
import { DEATHS } from '../src/content/deaths.js';

setTalentPool(TALENTS);

let liveRuns = 0;
let deaths = 0;
let choicesMade = 0;
let maxAge = 0;
const endingsSeen = new Map();
const gradesSeen = new Map();
const careerSeen = new Set();
const deathReasons = new Map();
const achievementSeen = new Map();
const eventSeen = new Set();
const choiceSeen = new Set();
const agesAtDeath = [];
const statSamples = [];
const clicksPerLife = [];

const RUNS = 3000;

for (let seed = 1; seed <= RUNS; seed++) {
  const rng = createRng(seed);
  const base = rollBaseStats(rng);
  assert.equal(typeof base.charm, 'number', 'base stats must be numeric');

  for (const key of STAT_KEYS) {
    assert.ok(base[key] >= 0 && base[key] <= 30, `base ${key} out of range: ${base[key]}`);
  }

  const offers = drawTalents(rng, 6);
  assert.equal(offers.length, 6, 'should offer 6 talents');
  assert.equal(new Set(offers.map((t) => t.id)).size, 6, 'talents must be unique');

  const picked = offers.slice(0, 3);
  const life = createLife({ seed, talents: picked });
  const chooser = createRng(seed * 7919);

  let guard = 0;
  let clicks = 0;
  while (life.alive && guard++ < 2000) {
    if (life.pending) {
      const choices = life.pending.options;
      assert.ok(choices.length > 0, `pending ${life.pending.kind} had no options`);
      const chosen = choices[Math.floor(chooser.next() * choices.length)];
      resolveChoice(life, chosen.id);
      choicesMade++;
      clicks++;
      continue;
    }
    const before = life.age;
    const batch = advance(life);
    if (batch.length) clicks++;
    assert.ok(life.age >= before, 'age must never go backwards');
    assert.ok(MAX_AGE + 1 >= life.age, 'age must not exceed cap');
    if (life.career) careerSeen.add(life.career);

    for (const key of STAT_KEYS) {
      const v = life.stats[key];
      assert.ok(v >= 0 && v <= 30, `stat ${key} out of range: ${v} (age ${life.age})`);
    }
    assert.ok(life.minMood <= life.stats.mood + 0.001, 'minMood must track the trough');
    assert.ok(life.peakMood >= life.stats.mood - 0.001, 'peakMood must track the peak');
  }

  assert.ok(guard < 2000, `life ${seed} never terminated`);
  assert.equal(life.alive, false, `life ${seed} should have ended`);
  liveRuns++;
  deaths++;

  const s = summary(life);
  assert.ok(s.age > 0, 'should have lived at least a year');
  assert.ok(s.age <= MAX_AGE, `age over cap: ${s.age}`);
  assert.ok(ENDINGS.some((e) => e.id === s.endingId), `unknown ending ${s.endingId}`);
  assert.ok(GRADES.some((g) => g.id === s.gradeId), `unknown grade ${s.gradeId}`);
  assert.ok(Number.isFinite(s.score) && s.score >= 0, `bad score ${s.score}`);
  assert.ok(Array.isArray(s.achievements), 'achievements must be an array');
  if (s.career) assert.ok(CAREER_BY_ID[s.career], `unknown career ${s.career}`);

  agesAtDeath.push(s.age);
  maxAge = Math.max(maxAge, s.age);
  endingsSeen.set(s.endingId, (endingsSeen.get(s.endingId) ?? 0) + 1);
  gradesSeen.set(s.gradeId, (gradesSeen.get(s.gradeId) ?? 0) + 1);
  clicksPerLife.push(clicks);
  if (s.age >= 60) statSamples.push({ ...s.stats, money: s.money });
  for (const a of s.achievements) achievementSeen.set(a.id, (achievementSeen.get(a.id) ?? 0) + 1);
  for (const h of life.history) {
    if (!h.eventId) continue;
    eventSeen.add(h.eventId);
    if (h.type === 'choice') choiceSeen.add(h.eventId);
  }
  const d = life.history.findLast((h) => h.type === 'death');
  if (d) deathReasons.set(d.deathId, (deathReasons.get(d.deathId) ?? 0) + 1);
}

/* ── determinism: same seed + same choices ⇒ same life ────────────── */

function runSeeded(seed) {
  const rng = createRng(seed);
  const offers = drawTalents(rng, 6);
  const life = createLife({ seed, talents: offers.slice(0, 3) });
  const trace = [];
  let g = 0;
  while (life.alive && g++ < 2000) {
    if (life.pending) {
      const id = life.pending.options[0].id;
      trace.push(`${life.age}:${life.pending.kind}:${id}`);
      resolveChoice(life, id);
      continue;
    }
    advance(life);
    trace.push(`${life.age}:${life.stats.intellect}:${life.money}`);
  }
  return trace.join('|');
}

assert.equal(runSeeded(42), runSeeded(42), 'same seed must reproduce the same life');

/* ── log completeness ────────────────────────────────────────────── */
// Everything advance() reports must also land in history: the UI renders the
// log from `life.history`, so a batch-only entry is invisible and "Continue"
// appears to do nothing (this was a real regression).

{
  const rng = createRng(1234);
  const life = createLife({ seed: 1234, talents: drawTalents(rng, 3) });
  const chooser = createRng(99);
  let g = 0;
  while (life.alive && g++ < 2000) {
    if (life.pending) {
      const opts = life.pending.options;
      resolveChoice(life, opts[Math.floor(chooser.next() * opts.length)].id);
      continue;
    }
    const before = life.history.length;
    const batch = advance(life);
    assert.equal(
      life.history.length,
      before + batch.length,
      'every entry returned by advance() must be pushed into history',
    );
  }
  assert.ok(
    life.history.some((h) => h.type === 'quiet' || h.type === 'event'),
    'a life must produce readable log entries',
  );
  for (const h of life.history) {
    assert.ok(typeof h.age === 'number', `log entry without an age: ${JSON.stringify(h)}`);
  }
}

/* ── content integrity ───────────────────────────────────────────── */

const ids = new Set();
for (const e of EVENTS) {
  assert.ok(!ids.has(e.id), `duplicate event id: ${e.id}`);
  ids.add(e.id);
  assert.ok(Array.isArray(e.age) && e.age[0] <= e.age[1], `bad age range for ${e.id}`);
}
for (const t of TALENTS) {
  assert.ok(!ids.has(`talent:${t.id}`), `duplicate talent id ${t.id}`);
}

/* ── balance invariants ──────────────────────────────────────────── */
// These encode the *design* of the sandbox, not incidental numbers: content
// that can never appear is a bug, and a life that ends after a handful of
// clicks is the exact regression this project set out to fix.

const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
const quantile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

const missingEndings = ENDINGS.filter((e) => !endingsSeen.has(e.id)).map((e) => e.id);
assert.deepEqual(missingEndings, [], `unreachable endings: ${missingEndings.join(', ')}`);

const commonEnding = [...endingsSeen].sort((a, b) => b[1] - a[1])[0];
assert.ok(
  commonEnding[1] / liveRuns < 0.6,
  `one ending dominates the pool: ${commonEnding[0]} at ${pct(commonEnding[1], liveRuns)}`,
);

const missingDeaths = DEATHS.filter((d) => !deathReasons.has(d.id)).map((d) => d.id);
assert.deepEqual(missingDeaths, [], `causes of death that never fire: ${missingDeaths.join(', ')}`);

const missingAchievements = ACHIEVEMENTS.filter((a) => !achievementSeen.has(a.id)).map((a) => a.id);
assert.deepEqual(missingAchievements, [], `unreachable achievements: ${missingAchievements.join(', ')}`);

// Every authored event must be reachable, and every decision event must
// actually present its choices at least once — otherwise the copy is dead
// content that the player will never read.
const firedEvents = new Set(eventSeen);
const missingEvents = EVENTS.filter((e) => !firedEvents.has(e.id)).map((e) => e.id);
assert.deepEqual(missingEvents, [], `events that never fire: ${missingEvents.join(', ')}`);
const choiceEvents = EVENTS.filter((e) => e.choices).map((e) => e.id);
const unseenChoices = choiceEvents.filter((id) => !choiceSeen.has(id));
assert.deepEqual(unseenChoices, [], `decision events never offered: ${unseenChoices.join(', ')}`);
assert.ok(choiceEvents.length >= 12, `too few decision points: ${choiceEvents.length}`);

assert.equal(gradesSeen.size, GRADES.length, 'every grade should be reachable');

const avgClicks = clicksPerLife.reduce((a, b) => a + b, 0) / clicksPerLife.length;
assert.ok(avgClicks >= 25, `a life ends after too few clicks: ${avgClicks.toFixed(1)}`);
assert.ok(avgClicks <= 120, `a life drags on for too many clicks: ${avgClicks.toFixed(1)}`);

// The original complaint: "a few clicks and it's over". Early deaths should be
// rare enough to feel like a twist, not like the game breaking.
const earlyLives = clicksPerLife.filter((c) => c <= 3).length / clicksPerLife.length;
assert.ok(earlyLives < 0.02, `${(earlyLives * 100).toFixed(1)}% of lives ended within 3 clicks`);
const shortLives = clicksPerLife.filter((c) => c <= 8).length / clicksPerLife.length;
assert.ok(shortLives < 0.05, `${(shortLives * 100).toFixed(1)}% of lives ended within 8 clicks`);

const avgLife = agesAtDeath.reduce((a, b) => a + b, 0) / agesAtDeath.length;
assert.ok(avgLife > 55 && avgLife < 100, `implausible average lifespan: ${avgLife.toFixed(1)}`);

/* ── report ──────────────────────────────────────────────────────── */

const avgAge = avgLife.toFixed(1);

console.log(`\n✅ ${liveRuns} lives simulated, all invariants held.\n`);
console.log(`   avg lifespan : ${avgAge} yrs (max ${maxAge})`);
console.log(`   avg clicks   : ${avgClicks.toFixed(1)} per life (one per meaningful event)`);
console.log(`   choices made : ${choicesMade}`);
console.log(`   careers used : ${careerSeen.size} of ${Object.keys(CAREER_BY_ID).length}`);

console.log('\n   endings:');
for (const [id, n] of [...endingsSeen].sort((a, b) => b[1] - a[1])) {
  console.log(`     ${id.padEnd(16)} ${pct(n, liveRuns).padStart(6)}`);
}
console.log('\n   grades:');
for (const [id, n] of [...gradesSeen].sort((a, b) => b[1] - a[1])) {
  console.log(`     ${id.padEnd(16)} ${pct(n, liveRuns).padStart(6)}`);
}
console.log('\n   causes of death:');
for (const [id, n] of [...deathReasons].sort((a, b) => b[1] - a[1])) {
  console.log(`     ${id.padEnd(16)} ${pct(n, deaths).padStart(6)}`);
}
console.log(`\n   final stats (lives ≥ 60, n=${statSamples.length}):`);
for (const key of [...STAT_KEYS, 'money']) {
  const values = statSamples.map((s) => s[key]);
  console.log(`     ${key.padEnd(16)} p50 ${String(quantile(values, 0.5)).padStart(4)}   p90 ${quantile(values, 0.9)}`);
}
console.log('\n   achievements:');
for (const a of ACHIEVEMENTS) {
  console.log(`     ${a.id.padEnd(18)} ${pct(achievementSeen.get(a.id) ?? 0, liveRuns).padStart(6)}`);
}
console.log('');
