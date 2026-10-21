import { h } from '../dom.js';
import { t } from '../../i18n/index.js';

/**
 * Past lives list. Each row is a button: clicking it reruns that seed, which
 * is the whole point of keeping a history in a seeded game.
 */
export function renderHistory(runs, { onClear, onReplay }) {
  const rows = runs.map((run) =>
    h(
      'button',
      {
        class: 'history__row',
        type: 'button',
        title: `${t('ui.replaySeed')} · #${run.seed}`,
        onClick: () => onReplay?.(run.seed),
      },
      h('span', {
        class: `history__grade grade--${run.gradeTone ?? 'common'}`,
        text: t(`grades.${run.gradeId}`),
      }),
      h(
        'div',
        { class: 'history__body' },
        h('div', { class: 'history__ending', text: t(`endings.${run.endingId}.name`) }),
        h('div', { class: 'history__meta', text: `${run.age} ${t('ui.years')} · ${t('ui.score')} ${run.score}` }),
      ),
      h('span', { class: 'history__seed', text: `#${run.seed}` }),
    ),
  );

  return h(
    'div',
    { class: 'panel__body' },
    runs.length
      ? h('div', { class: 'history' }, rows)
      : h('div', { class: 'empty', text: t('ui.historyEmpty') }),
    runs.length
      ? h(
          'button',
          {
            class: 'btn btn--ghost btn--sm',
            type: 'button',
            text: t('ui.clearHistory'),
            style: { marginTop: '12px' },
            onClick: onClear,
          },
        )
      : null,
  );
}
