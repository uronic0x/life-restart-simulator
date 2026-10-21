import { h } from '../dom.js';
import { t, eventText } from '../../i18n/index.js';
import { effectChips, chip } from '../components.js';
import { CAREER_BY_ID } from '../../content/careers.js';
import { DEATHS } from '../../content/deaths.js';

const PHASE_LABEL = (phase) => t(`ui.phase.${phase}`);

/** One log row. `entry` is an engine log entry. */
export function logEntry(entry) {
  if (entry.type === 'quiet') {
    const text =
      entry.from === entry.age
        ? t('ui.quietOne', { from: entry.from })
        : t('ui.quiet', { from: entry.from, to: entry.age });
    return h(
      'div',
      { class: 'entry entry--quiet' },
      h('div', { class: 'entry__age', text: `${entry.from}–${entry.age}` }),
      h('div', { class: 'entry__body', text }),
    );
  }

  if (entry.type === 'death') {
    const death = DEATHS.find((d) => d.id === entry.deathId);
    return h(
      'div',
      { class: 'entry entry--death' },
      h('div', { class: 'entry__age', text: `${entry.age}` }),
      h(
        'div',
        { class: 'entry__body' },
        t(`deaths.${entry.deathId}`),
        h(
          'div',
          { class: 'entry__meta' },
          chip(PHASE_LABEL(entry.phase), 'muted'),
          death?.tags?.includes('natural') ? chip('☾', 'muted') : null,
        ),
      ),
    );
  }

  if (entry.type === 'career') {
    const career = CAREER_BY_ID[entry.careerId];
    return h(
      'div',
      { class: 'entry entry--career' },
      h('div', { class: 'entry__age', text: `${entry.age}` }),
      h(
        'div',
        { class: 'entry__body' },
        `${t('ui.career')}: ${t(`careers.${entry.careerId}.name`)}`,
        h(
          'div',
          { class: 'entry__meta' },
          career ? chip(`${t('ui.incomeLabel')} ${career.income[0]}–${career.income[1]}/y`, 'money') : null,
          h('span', { class: 'chip', text: t(`careers.${entry.careerId}.desc`) }),
        ),
      ),
    );
  }

  // event | choice
  const { text } = eventText(entry.eventId);
  const body = h('div', { class: 'entry__body', text });

  if (entry.type === 'choice') {
    body.dataset.pick = `→ ${t(`events.${entry.eventId}.choices.${entry.choiceId}`)}`;
  }

  const meta = h(
    'div',
    { class: 'entry__meta' },
    chip(PHASE_LABEL(entry.phase), 'phase'),
    ...effectChips(entry.effects),
  );

  return h(
    'div',
    { class: `entry entry--${entry.type}` },
    h('div', { class: 'entry__age', text: `${entry.age}` }),
    h('div', {}, body, meta),
  );
}

/** Prompt card for a pending decision. */
export function promptCard(pending, handlers) {
  if (pending.kind === 'career') {
    const options = pending.options.map((opt) => {
      const career = CAREER_BY_ID[opt.id];
      return h(
        'button',
        {
          class: 'career',
          type: 'button',
          onClick: () => handlers.onChoose(opt.id),
        },
        h(
          'div',
          {},
          h('div', { class: 'career__name', text: t(`careers.${opt.id}.name`) }),
          h('div', { class: 'career__desc', text: t(`careers.${opt.id}.desc`) }),
        ),
        h('div', {
          class: 'career__income',
          text: career ? `${career.income[0]}–${career.income[1]}/y` : '',
        }),
      );
    });

    return h(
      'div',
      { class: 'choice' },
      h('div', { class: 'choice__title', text: t('ui.chooseCareer') }),
      h('div', { class: 'choice__text', text: t('ui.chooseCareerHint') }),
      h('div', { class: 'careers' }, options),
    );
  }

  const { text, choices } = eventText(pending.eventId);
  const options = pending.options.map((opt) => {
    const label = choices?.[opt.id] ?? t(`events.${pending.eventId}.choices.${opt.id}`);
    return h(
      'button',
      {
        class: 'choice__option',
        type: 'button',
        onClick: () => handlers.onChoose(opt.id),
      },
      label,
      h(
        'span',
        { class: 'choice__hint' },
        ...effectChips(opt.effects).map((c) => c),
      ),
    );
  });

  return h(
    'div',
    { class: 'choice' },
    h('div', { class: 'choice__title', text: t('ui.chooseOne') }),
    h('div', { class: 'choice__text', text }),
    h('div', { class: 'choice__options' }, options),
  );
}
