import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { STAT_KEYS, STAT_META } from '../core/stats.js';

export function statTile(key, value, delta = null, prev = null) {
  const meta = STAT_META[key];
  const tile = h(
    'div',
    { class: `stat stat--${key}`, dataset: { key } },
    h('div', { class: 'stat__icon', text: meta.icon }),
    h('div', { class: 'stat__label', text: t(`stats.${key}`) }),
    h('div', { class: 'stat__value', text: String(value) }),
  );
  if (delta) {
    const up = delta > 0;
    tile.append(
      h('div', {
        class: `stat__delta stat__delta--${up ? 'up' : 'down'}`,
        text: `${up ? '+' : ''}${delta}`,
      }),
    );
  }
  if (prev != null && prev !== value) tile.classList.add('is-bump');
  return tile;
}

export function statGrid(stats) {
  return h('div', { class: 'stats' }, STAT_KEYS.map((k) => statTile(k, stats[k])));
}

/** Patch an existing grid in place so values animate instead of flashing. */
export function updateStatGrid(grid, stats, prevStats) {
  for (const key of STAT_KEYS) {
    const tile = grid.querySelector(`[data-key="${key}"]`);
    if (!tile) continue;
    const valueEl = tile.querySelector('.stat__value');
    const next = stats[key];
    const prev = prevStats?.[key] ?? next;
    if (valueEl.textContent !== String(next)) {
      tile.classList.remove('is-bump');
      void tile.offsetWidth;
      tile.classList.add('is-bump');
      animateTile(valueEl, prev, next);
    }
    let deltaEl = tile.querySelector('.stat__delta');
    const delta = next - prev;
    if (delta) {
      if (!deltaEl) {
        deltaEl = h('div', { class: 'stat__delta' });
        tile.append(deltaEl);
      }
      deltaEl.className = `stat__delta stat__delta--${delta > 0 ? 'up' : 'down'}`;
      deltaEl.textContent = `${delta > 0 ? '+' : ''}${delta}`;
    }
  }
}

function animateTile(el, from, to) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    el.textContent = String(to);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / 320);
    el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function chip(text, variant = '') {
  return h('span', { class: `chip ${variant ? `chip--${variant}` : ''}`, text });
}

export function effectChips(effects) {
  if (!effects) return [];
  return Object.entries(effects)
    .filter(([, v]) => v)
    .map(([key, value]) => {
      if (key === 'money') {
        return chip(`${value > 0 ? '+' : ''}${value} ¥`, value > 0 ? 'money' : 'down');
      }
      const label = t(`stats.${key}`);
      return chip(`${label} ${value > 0 ? '+' : ''}${value}`, value > 0 ? 'up' : 'down');
    });
}
