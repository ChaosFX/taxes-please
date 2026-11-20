import { codexDays, codexEntries, searchCodex } from '../core/codex';
import type { Content, Rule } from '../core/types';
import { h } from './dom';

export interface CodexUiState {
  open: boolean;
  query: string;
}

function ruleCard(rule: Rule, isNew: boolean): HTMLElement {
  return h(
    'article',
    { class: 'rule', id: `regel-${rule.id}`, 'data-rule': rule.id },
    h('header', {}, h('h3', {}, rule.title), isNew ? h('span', { class: 'badge-new' }, 'neu') : null),
    h('p', {}, rule.text),
    h(
      'footer',
      {},
      h('span', { class: 'simplified' }, 'vereinfacht'),
      ' · ',
      h('a', { href: rule.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, rule.source),
    ),
  );
}

/** The codex panel. The search updates only the list, so the input keeps focus. */
export function renderCodex(
  content: Content,
  day: number,
  ui: CodexUiState,
  onToggle: () => void,
): HTMLElement {
  const toggle = h(
    'button',
    { class: 'codex-toggle', 'data-key': 'codex-toggle', 'aria-expanded': String(ui.open), onclick: onToggle },
    ui.open ? 'Kodex schließen' : 'Kodex öffnen',
  );
  if (!ui.open) return h('aside', { class: 'codex closed', 'aria-label': 'Kodex' }, toggle);

  const list = h('div', { class: 'codex-list' });
  const fill = () => {
    list.replaceChildren();
    if (ui.query.trim()) {
      const hits = searchCodex(content, day, ui.query);
      list.append(
        h('p', { class: 'hint', role: 'status' }, `${hits.length} Treffer`),
        ...hits.map((r) => ruleCard(r, r.day === day)),
      );
      return;
    }
    const entries = codexEntries(content, day);
    for (const d of codexDays(content)) {
      list.append(h('h2', { class: 'codex-day', id: `kodex-tag-${d}` }, `Tag ${d}`));
      for (const e of entries.filter((x) => x.day === d)) {
        list.append(
          e.locked
            ? h('article', { class: 'rule locked', 'data-rule': e.id, 'aria-label': 'gesperrte Seite' }, `Gesperrt – ab Tag ${e.day}`)
            : ruleCard(e.rule, e.isNew),
        );
      }
    }
  };
  fill();

  const search = h('input', {
    type: 'search',
    class: 'codex-search',
    'data-key': 'codex-search',
    placeholder: 'Kodex durchsuchen …',
    'aria-label': 'Kodex durchsuchen',
    value: ui.query,
  });
  search.addEventListener('input', () => {
    ui.query = search.value;
    fill();
  });

  const bookmarks = h(
    'nav',
    { class: 'bookmarks', 'aria-label': 'Lesezeichen' },
    codexDays(content).map((d) =>
      h(
        'button',
        {
          class: 'bookmark',
          'data-key': `bookmark-${d}`,
          onclick: () => {
            ui.query = '';
            search.value = '';
            fill();
            list.querySelector(`#kodex-tag-${d}`)?.scrollIntoView({ block: 'start' });
          },
        },
        `Tag ${d}`,
      ),
    ),
  );

  return h('aside', { class: 'codex open', 'aria-label': 'Kodex' }, toggle, bookmarks, search, list);
}
