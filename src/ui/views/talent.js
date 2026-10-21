import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { statGrid } from '../components.js';

export function renderTalentView({
  stats,
  talents,
  pickedIds,
  seed,
  onToggle,
  onStart,
  onReroll,
  onLoadSeed,
}) {
  const atMax = pickedIds.length >= 3;

  const cards = talents.map((talent) => {
    const picked = pickedIds.includes(talent.id);
    const disabled = !picked && atMax;
    const info = t(`talents.${talent.id}`);
    const card = h(
      'button',
      {
        class: `talent talent--r${talent.rarity} ${picked ? 'is-picked' : ''}`,
        type: 'button',
        'aria-pressed': picked ? 'true' : 'false',
        disabled,
        style: disabled ? { opacity: '0.42' } : null,
        onClick: () => onToggle(talent.id),
      },
      h(
        'div',
        { class: 'talent__top' },
        h('span', { class: 'talent__name', text: typeof info === 'object' ? info.name : talent.id }),
        h('span', { class: 'talent__rarity', text: t(`ui.rarity.${talent.rarity}`) }),
      ),
      h('span', { class: 'talent__desc', text: typeof info === 'object' ? info.desc : '' }),
    );
    return card;
  });

  const body = h(
    'div',
    { class: 'panel__body' },
    sectionHead(t('ui.attributes'), t('ui.talentCount', { n: pickedIds.length })),
    statGrid(stats),
    h('div', { style: { height: '20px' } }),
    sectionHead(t('ui.talentsTitle'), t('ui.talentsHint')),
    h('div', { class: 'talents' }, cards),
    h('div', { style: { height: '20px' } }),
    h(
      'div',
      { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      h('button', {
        class: 'btn btn--primary btn--block',
        type: 'button',
        text: t('ui.start'),
        onClick: onStart,
        style: { flex: '1 1 220px' },
      }),
      h('button', {
        class: 'btn btn--ghost',
        type: 'button',
        text: t('ui.reroll'),
        onClick: onReroll,
      }),
    ),
    h('div', { style: { height: '14px' } }),
    seedBar(seed, onLoadSeed),
  );

  return {
    head: h(
      'div',
      { class: 'panel__head' },
      h('span', { class: 'panel__title', text: t('ui.tabTalent') }),
      h('span', { class: 'panel__spacer' }),
      h('span', { class: 'hint', text: t('ui.born') }),
    ),
    body,
  };
}

/**
 * Seed control: a life is fully reproducible from its seed, so letting the
 * player paste one back in is the natural counterpart to "copy seed".
 */
function seedBar(seed, onLoadSeed) {
  const input = h('input', {
    class: 'seed-input',
    type: 'text',
    inputmode: 'numeric',
    value: String(seed),
    'aria-label': t('ui.seedLabel'),
    maxlength: '10',
  });

  const submit = () => {
    const raw = input.value.trim().replace(/^#/, '');
    if (/^\d+$/.test(raw)) onLoadSeed(Number(raw) >>> 0);
    else input.value = String(seed);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  return h(
    'div',
    { class: 'seedbar' },
    h('span', { class: 'seedbar__label', text: t('ui.seedLabel') }),
    input,
    h('button', {
      class: 'btn btn--ghost btn--sm',
      type: 'button',
      text: t('ui.loadSeed'),
      title: t('ui.replaySeed'),
      onClick: submit,
    }),
  );
}

function sectionHead(title, hint) {
  return h(
    'div',
    { class: 'section-head' },
    h('h2', { text: title }),
    h('p', { text: hint }),
  );
}
