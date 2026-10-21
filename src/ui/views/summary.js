import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { statGrid } from '../components.js';
import { CAREER_BY_ID } from '../../content/careers.js';

export function renderSummary(summary, { onAgain, onShareSeed, newAchievements = [] }) {
  const ending = t(`endings.${summary.endingId}`);

  const hero = h(
    'div',
    { class: 'summary__hero' },
    h('div', { class: 'summary__icon', text: summary.endingIcon, 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'summary__text' },
      h('div', { class: 'summary__ending', text: `${t('ui.ending')}: ${ending.name ?? summary.endingId}` }),
      h('div', { class: 'summary__desc', text: ending.desc ?? '' }),
      h('div', { class: 'summary__died', text: t('ui.died', { age: summary.age }) }),
    ),
    h(
      'div',
      { class: 'summary__grade' },
      h('span', { class: 'summary__grade-label', text: t('ui.grade') }),
      h('div', { class: `grade grade--${summary.gradeTone}`, text: t(`grades.${summary.gradeId}`) }),
      h('div', { class: 'summary__score', text: `${t('ui.score')} · ${summary.score}` }),
    ),
  );

  const careerName = summary.career ? t(`careers.${summary.career}.name`) : t('ui.none');

  const minis = h(
    'div',
    { class: 'summary__grid' },
    mini(t('ui.lifetime'), `${summary.age} ${t('ui.unitYears')}`),
    mini(t('ui.money'), `${summary.money} ¥`),
    mini(t('ui.career'), careerName),
    mini(t('ui.events'), String(summary.eventCount)),
    mini(t('ui.total'), String(summary.total)),
  );

  const achIds = summary.achievements ?? [];

  // Split this run's achievements into "newly unlocked" and "already known"
  // so the two lists never show the same items twice.
  const freshIds = new Set(newAchievements);
  const knownIds = achIds.filter((a) => !freshIds.has(a.id));

  const achList = (ids, icon) =>
    h(
      'div',
      { class: 'ach-grid' },
      ids.map((a) => {
        const info = t(`achievements.${a.id}`);
        return h(
          'span',
          { class: `ach ${freshIds.has(a.id) ? 'ach--new' : ''}`, title: info.desc ?? '' },
          h('span', { class: 'ach__icon', text: icon ?? a.icon }),
          info.name ?? a.id,
        );
      }),
    );

  const newSection = freshIds.size
    ? h(
        'div',
        {},
        h(
          'div',
          { class: 'section-head' },
          h('h2', { text: t('ui.newAchievements') }),
          h('p', { text: `+${freshIds.size}` }),
        ),
        achList(achIds.filter((a) => freshIds.has(a.id))),
      )
    : null;

  const knownSection = knownIds.length
    ? h(
        'div',
        {},
        h(
          'div',
          { class: 'section-head' },
          h('h2', { text: t('ui.achievements') }),
          h('p', { text: t('ui.previouslyUnlocked') }),
        ),
        achList(knownIds),
      )
    : !freshIds.size
      ? h(
          'div',
          {},
          h('div', { class: 'section-head' }, h('h2', { text: t('ui.achievements') })),
          h('div', { class: 'empty', text: t('ui.achievementsEmpty') }),
        )
      : null;

  const actions = h(
    'div',
    { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
    h('button', {
      class: 'btn btn--primary',
      type: 'button',
      text: t('ui.again'),
      onClick: onAgain,
      style: { flex: '1 1 200px' },
    }),
    h('button', {
      class: 'btn btn--ghost',
      type: 'button',
      text: t('ui.share'),
      onClick: () => onShareSeed(summary.seed),
    }),
  );

  return h(
    'div',
    { class: 'panel__body' },
    h(
      'div',
      { class: 'summary' },
      hero,
      minis,
      h(
        'div',
        {},
        h('div', { class: 'section-head' }, h('h2', { text: t('ui.stats') })),
        statGrid(summary.stats),
      ),
      newSection,
      knownSection,
      actions,
    ),
  );
}

function mini(label, value) {
  return h(
    'div',
    { class: 'mini' },
    h('div', { class: 'mini__label', text: label }),
    h('div', { class: 'mini__value', text: value }),
  );
}
