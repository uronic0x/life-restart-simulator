import { h, mount, clear, toast, clearToasts } from './dom.js';
import { t, getLang, setLang, onLangChange } from '../i18n/index.js';
import { settings, history as historyStore, achievementStore } from './state.js';
import { statGrid, updateStatGrid } from './components.js';
import { renderTalentView } from './views/talent.js';
import { logEntry, promptCard } from './views/life.js';
import { renderSummary } from './views/summary.js';
import { renderHistory } from './views/history.js';
import {
  createLife,
  advance,
  resolveChoice,
  setTalentPool,
  drawTalents,
  rollBaseStats,
  summary as makeSummary,
  phaseOf,
} from '../core/engine.js';
import { TALENTS } from '../content/talents.js';
import { ACHIEVEMENTS } from '../content/achievements.js';
import { createRng, randomSeed } from '../core/rng.js';

setTalentPool(TALENTS);

document.documentElement.classList.toggle('reduce-motion', settings.get().reduceMotion);

const app = document.getElementById('app');

/* ───────────────────────────── state ───────────────────────────── */

const view = {
  screen: 'talent', // 'talent' | 'life' | 'summary'
  seed: randomSeed(),
  baseStats: null,
  offers: [],
  picked: [],
  life: null,
  lastSummary: null,
  newAchievements: [],
  auto: false,
  autoTimer: null,
  els: { log: null, stats: null, prompt: null },
};

/* ──────────────────────────── bootstrap ─────────────────────────── */

function newRun(seed = randomSeed()) {
  if (view.auto) setAuto(false);
  view.seed = seed;
  view.picked = [];
  view.life = null;
  view.lastSummary = null;
  view.newAchievements = [];
  view.screen = 'talent';

  const rng = createRng(seed);
  view.baseStats = rollBaseStats(rng);
  view.offers = drawTalents(rng, 6);
  render();
}

function beginLife() {
  const talents = view.picked.map((id) => TALENTS.find((x) => x.id === id)).filter(Boolean);
  view.life = createLife({ seed: view.seed, talents });
  view.screen = 'life';
  render();
  step();
}

/* ────────────────────────────── flow ───────────────────────────── */

function step(years = 1) {
  const life = view.life;
  if (!life || !life.alive || life.pending) return;

  const before = { ...life.stats };
  for (let i = 0; i < years; i++) {
    if (!life.alive || life.pending) break;
    advance(life);
  }
  paintLife(before);
  if (!life.alive) finish();
}

/* ───────────────────────────── autoplay ──────────────────────────── */

const AUTO_DELAY = 700;

/**
 * Hands-free mode: keeps pressing "next" until something needs the player
 * (a decision) or the life ends. Any deliberate click or key press stops it,
 * so it never steals control.
 */
function setAuto(on) {
  view.auto = on;
  clearTimeout(view.autoTimer);
  view.autoTimer = null;
  const btn = document.getElementById('btn-auto');
  if (btn) {
    btn.textContent = on ? `⏸ ${t('ui.autoOff')}` : `▶ ${t('ui.autoPlay')}`;
    btn.classList.toggle('is-active', on);
  }
  if (on) tickAuto();
}

function tickAuto() {
  if (!view.auto || !view.life?.alive || view.life.pending || view.screen !== 'life') {
    setAuto(false);
    return;
  }
  step(1);
  if (!view.auto) return;
  if (!view.life?.alive || view.life.pending) {
    setAuto(false);
    return;
  }
  view.autoTimer = setTimeout(tickAuto, AUTO_DELAY);
}

function choose(optionId) {
  const life = view.life;
  if (!life?.pending) return;
  if (view.auto) setAuto(false);
  const before = { ...life.stats };
  resolveChoice(life, optionId);
  clearPrompt();
  paintLife(before);
  if (!life.alive) finish();
  else step();
}

function finish() {
  const life = view.life;
  if (view.auto) setAuto(false);
  const result = makeSummary(life);
  const fresh = achievementStore.merge(result.achievements.map((a) => a.id));

  historyStore.add({
    seed: result.seed,
    age: result.age,
    score: result.score,
    endingId: result.endingId,
    gradeId: result.gradeId,
    gradeTone: result.gradeTone,
    at: Date.now(),
  });

  view.lastSummary = result;
  view.newAchievements = fresh;
  view.screen = 'summary';
  view.els = { log: null, stats: null, prompt: null };
  render();
  if (fresh.length) toast(`✨ ${t('ui.newAchievements')} +${fresh.length}`);
}

/* ──────────────────────────── rendering ─────────────────────────── */

function render() {
  mount(app, shell());
  view.els = { log: null, stats: null, prompt: null };
  if (view.screen === 'life') buildLife();
}

function shell() {
  return h(
    'div',
    { class: 'shell' },
    topbar(),
    h(
      'div',
      { class: 'stage' },
      h('div', { class: 'panel panel--flush' }, mainPanel()),
      h('div', { class: 'panel panel--flush' }, sidebar()),
    ),
    h(
      'div',
      { class: 'footer' },
      h('span', { class: 'seed', text: `#${view.seed}` }),
      h('span', { text: '·' }),
      h('span', { text: 'vanilla js · zero dependencies' }),
      h('span', { text: '·' }),
      h('span', { text: 'MIT' }),
    ),
  );
}

function topbar() {
  return h(
    'div',
    { class: 'topbar' },
    h(
      'div',
      { class: 'brand' },
      h('div', { class: 'brand__mark', text: '🌱' }),
      h(
        'div',
        { class: 'brand__text' },
        h('div', { class: 'brand__title', text: t('ui.title') }),
        h('div', { class: 'brand__sub', text: t('ui.tagline') }),
      ),
    ),
    h(
      'div',
      { class: 'topbar__actions' },
      motionToggle(),
      h(
        'div',
        { class: 'segmented segmented--sm' },
        [
          { code: 'zh', label: '中文' },
          { code: 'en', label: 'EN' },
        ].map((lang) =>
          h('button', {
            class: `segmented__item ${getLang() === lang.code ? 'is-active' : ''}`,
            type: 'button',
            lang: lang.code,
            text: lang.label,
            onClick: () => setLang(lang.code),
          }),
        ),
      ),
      h('button', {
        class: 'btn btn--ghost btn--sm',
        type: 'button',
        text: `🕘 ${t('ui.history')}`,
        // The history panel always lives in the sidebar; the button is just a
        // jump-to link (and a way back to it on narrow screens).
        onClick: () => {
          document
            .querySelector('.history__row, .empty')
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        },
      }),
    ),
  );
}

/** Reduced-motion switch; the preference persists in localStorage. */
function motionToggle() {
  const on = settings.get().reduceMotion;
  return h(
    'button',
    {
      class: `btn btn--ghost btn--sm ${on ? 'is-active' : ''}`,
      type: 'button',
      id: 'btn-motion',
      'aria-pressed': on ? 'true' : 'false',
      title: t('ui.reduceMotion'),
      text: on ? '🎞️' : '✨',
      onClick: () => {
        const next = !settings.get().reduceMotion;
        settings.set({ reduceMotion: next });
        document.documentElement.classList.toggle('reduce-motion', next);
        render();
      },
    },
    h('span', { class: 'sr-only', text: t('ui.reduceMotion') }),
  );
}

function mainPanel() {
  if (view.screen === 'talent') {
    const { head, body } = renderTalentView({
      stats: view.baseStats,
      talents: view.offers,
      pickedIds: view.picked,
      seed: view.seed,
      onToggle: (id) => {
        const i = view.picked.indexOf(id);
        if (i >= 0) view.picked.splice(i, 1);
        else if (view.picked.length < 3) view.picked.push(id);
        render();
      },
      onStart: beginLife,
      onReroll: () => newRun(),
      onLoadSeed: (seed) => newRun(seed),
    });
    return [head, body];
  }

  if (view.screen === 'life') {
    return [lifeHead(), h('div', { id: 'stats-host' }), h('div', { id: 'log-host' }), h('div', { id: 'prompt-host' }), h('div', { id: 'action-host' })];
  }

  return [summaryPanel()];
}

function lifeHead() {
  const life = view.life;
  return h(
    'div',
    { class: 'panel__head' },
    h('span', { class: 'panel__title', text: t('ui.lifeLog') }),
    h('span', { class: 'panel__spacer' }),
    h('span', { class: 'chip chip--phase', text: t(`ui.phase.${phaseOf(life.age)}`) }),
    h('span', { class: 'chip', id: 'age-chip', text: `${life.age} ${t('ui.years')}` }),
  );
}

/** Builds the scrolling log + control bar once, then updates incrementally. */
function buildLife() {
  const life = view.life;

  const statsHost = document.getElementById('stats-host');
  const logHost = document.getElementById('log-host');
  const actionHost = document.getElementById('action-host');
  if (!statsHost || !logHost || !actionHost) return;

  view.els.stats = statGrid(life.stats);
  mount(statsHost, h('div', { class: 'panel__body' }, view.els.stats));

  view.els.log = h('div', { class: 'log', role: 'log', 'aria-live': 'polite' });
  for (const entry of life.history) view.els.log.append(logEntry(entry));
  // Remember how much we already rendered, otherwise the next incremental
  // paint (e.g. after a language switch, which rebuilds this log) appends
  // the whole history a second time.
  view.els.log.dataset.count = String(life.history.length);
  mount(logHost, view.els.log);
  requestAnimationFrame(() => {
    view.els.log.scrollTop = view.els.log.scrollHeight;
  });

  mount(
    actionHost,
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        {
          class: 'btn btn--primary',
          type: 'button',
          id: 'btn-next',
          onClick: () => {
            if (view.auto) setAuto(false);
            step(1);
          },
        },
        t('ui.continue'),
        h('span', { class: 'btn__hint', text: t('ui.spaceHint') }),
      ),
      h('button', {
        class: 'btn btn--ghost',
        type: 'button',
        text: t('ui.skip5'),
        onClick: () => {
          if (view.auto) setAuto(false);
          step(5);
        },
      }),
      h('button', {
        class: `btn btn--ghost btn--sm ${view.auto ? 'is-active' : ''}`,
        type: 'button',
        id: 'btn-auto',
        text: view.auto ? `⏸ ${t('ui.autoOff')}` : `▶ ${t('ui.autoPlay')}`,
        onClick: () => setAuto(!view.auto),
      }),
    ),
  );

  view.els.prompt = document.getElementById('prompt-host');
  if (life.pending) renderPrompt();
  if (!life.alive) renderDeadState();
}

/** Re-sync stats, log tail and sidebar after the engine moved forward. */
function paintLife(before) {
  const life = view.life;
  if (!view.els.log) return;

  if (view.els.stats) updateStatGrid(view.els.stats, life.stats, before);

  const rendered = Number(view.els.log.dataset.count ?? 0);
  for (let i = rendered; i < life.history.length; i++) {
    view.els.log.append(logEntry(life.history[i]));
  }
  view.els.log.dataset.count = String(life.history.length);
  view.els.log.scrollTop = view.els.log.scrollHeight;

  const ageChip = document.getElementById('age-chip');
  if (ageChip) ageChip.textContent = `${life.age} ${t('ui.years')}`;

  const phaseChip = document.querySelector('.chip--phase');
  if (phaseChip) phaseChip.textContent = t(`ui.phase.${phaseOf(life.age)}`);

  refreshSidebar();

  if (life.pending) renderPrompt();
  if (!life.alive) renderDeadState();
}

function renderDeadState() {
  const actionHost = document.getElementById('action-host');
  if (actionHost) clear(actionHost);
  clearPrompt();
}

function renderPrompt() {
  const host = document.getElementById('prompt-host');
  if (!host || !view.life.pending) return;
  mount(host, promptCard(view.life.pending, { onChoose: choose }));
  requestAnimationFrame(() => host.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

function clearPrompt() {
  const host = document.getElementById('prompt-host');
  if (host) clear(host);
}

/* ───────────────────────────── sidebar ──────────────────────────── */

function sidebar() {
  const life = view.life;
  const showLife = view.screen === 'life' && life;
  const runs = historyStore.all();

  if (!showLife) {
    return [
      h(
        'div',
        { class: 'panel__head' },
        h('span', { class: 'panel__title', text: t('ui.history') }),
        h('span', { class: 'panel__spacer' }),
        h('span', { class: 'hint', text: `${t('ui.bestScore')} ${historyStore.best()}` }),
      ),
      renderHistory(runs, {
        onClear: () => {
          historyStore.clear();
          render();
        },
        onReplay: (seed) => newRun(seed),
      }),
    ];
  }
  return [
    h(
      'div',
      { class: 'panel__head' },
      h('span', { class: 'panel__title', text: t('ui.stats') }),
      h('span', { class: 'panel__spacer' }),
      h('span', { class: 'hint', id: 'seed-hint', text: `#${life.seed}` }),
    ),
    h(
      'div',
      { class: 'panel__body' },
      h(
        'div',
        { class: 'summary__grid' },
        mini(t('ui.career'), life.career ? t(`careers.${life.career}.name`) : t('ui.none'), 'career-val'),
        mini(t('ui.money'), `${life.money} ¥`, 'money-val'),
        mini(t('ui.lifetime'), String(life.age), 'age-val'),
      ),
      h(
        'div',
        { class: 'section-head', style: { marginTop: '18px' } },
        h('h2', { text: t('ui.achievements') }),
      ),
      h('div', { class: 'ach-grid', id: 'ach-live' }, ...liveAchievements(life)),
    ),
  ];
}

function liveAchievements(life) {
  const ctx = {
    stats: life.stats,
    money: life.money,
    age: life.age,
    flags: life.flags,
    talents: life.talents,
    career: life.career,
    history: life.history,
    peak: life.peak,
    minMood: life.minMood,
    peakMood: life.peakMood,
  };
  const earned = ACHIEVEMENTS.filter((a) => {
    try {
      return a.check(ctx);
    } catch {
      return false;
    }
  });
  if (!earned.length) return [h('span', { class: 'hint', text: t('ui.achievementsEmpty') })];
  return earned.slice(-8).map((a) =>
    h('span', { class: 'ach', title: t(`achievements.${a.id}.desc`) }, h('span', { class: 'ach__icon', text: a.icon }), t(`achievements.${a.id}.name`)),
  );
}

function mini(label, value, id) {
  return h(
    'div',
    { class: 'mini' },
    h('div', { class: 'mini__label', text: label }),
    h('div', { class: 'mini__value', id, text: value }),
  );
}

function refreshSidebar() {
  const life = view.life;
  if (!life) return;
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set('career-val', life.career ? t(`careers.${life.career}.name`) : t('ui.none'));
  set('money-val', `${life.money} ¥`);
  set('age-val', String(life.age));

  const ach = document.getElementById('ach-live');
  if (ach) {
    clear(ach);
    for (const node of liveAchievements(life)) ach.append(node);
  }
}

/* ───────────────────────────── summary ──────────────────────────── */

function summaryPanel() {
  if (!view.lastSummary) return h('div', { class: 'panel__body', text: '…' });
  return renderSummary(view.lastSummary, {
    onAgain: () => newRun(),
    onShareSeed: async (seed) => {
      try {
        await navigator.clipboard.writeText(String(seed));
        toast(t('ui.copied'));
      } catch {
        toast(`seed: ${seed}`);
      }
    },
    newAchievements: view.newAchievements,
  });
}

/* ────────────────────────────── wiring ─────────────────────────── */

onLangChange(() => {
  clearToasts();
  render();
  // Rebuilding the shell drops the autoplay button's DOM state; keep the
  // timer alive so a language switch mid-run doesn't silently stop it.
  if (view.auto) {
    clearTimeout(view.autoTimer);
    view.autoTimer = setTimeout(tickAuto, AUTO_DELAY);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (view.screen !== 'life' || view.life?.pending) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (view.auto) setAuto(false);
    step(1);
  }
});

newRun();
