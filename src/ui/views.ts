import { correctAnswer } from '../core/evaluate';
import { formatEuro } from '../core/format';
import { dayInfo, errorsOfDay, errorsPerDay, needsReprimand, resultsOfDay, type GameState } from '../core/game';
import { getAkte } from '../core/loader';
import type { Akte, CaseError, Content, Document, PlayerVerdict, PositionVerdict, Rule, Stamp } from '../core/types';
import { renderCodex, type CodexUiState } from './codex';
import { h } from './dom';

export interface Actions {
  newGame(): void;
  continueGame(): void;
  beginWork(): void;
  drawNext(): void;
  decide(positionId: string, verdict: PlayerVerdict | undefined): void;
  choose(option: string | undefined): void;
  stamp(stamp: Stamp): void;
  file(): void;
  advanceDay(): void;
  toggleCodex(): void;
  toStart(): void;
}

// ---------- Labels: every game text comes from content.texts ----------

const stampLabel = (c: Content, s: Stamp) => c.texts.stampLabels[s];
const optionLabel = (c: Content, o: string) => c.texts.optionLabels[o] ?? o;
/** `offen` is shown together with the stamp it calls for. */
const verdictLabel = (c: Content, v: PositionVerdict) => (v === 'offen' ? `offen · ${stampLabel(c, 'ergaenzung')}` : v);

/** One line per error, built from data only: what was given and what is correct. */
function errorLine(c: Content, akte: Akte, e: CaseError): HTMLElement {
  if (e.kind === 'unnoetige-verzoegerung') return h('li', {}, c.texts.unnecessaryDelay);
  let subject: string;
  let given: string | undefined;
  let expected: string;
  if (e.kind === 'stempel-falsch') {
    subject = 'Stempel';
    given = e.given ? stampLabel(c, e.given as Stamp) : undefined;
    expected = stampLabel(c, e.expected as Stamp);
  } else if (e.kind === 'option-falsch' || e.kind === 'option-fehlt') {
    subject = akte.kind.type === 'steuerpflicht' ? akte.kind.decision.question : '';
    given = e.given ? optionLabel(c, e.given) : undefined;
    expected = optionLabel(c, e.expected!);
  } else {
    const pos = akte.kind.type === 'werbungskosten' ? akte.kind.positions.find((p) => p.id === e.positionId) : undefined;
    subject = pos?.label ?? e.positionId ?? '';
    given = e.given;
    expected = verdictLabel(c, e.expected as PositionVerdict);
  }
  return h('li', {}, h('strong', {}, subject), `: ${given ?? '–'} → ${expected}`);
}

// ---------- Start ----------

export function startView(content: Content, canContinue: boolean, a: Actions): HTMLElement {
  return h(
    'main',
    { class: 'screen start' },
    h('h1', {}, 'Taxes Please'),
    h('p', { class: 'subtitle' }, `Veranlagungsjahr ${content.meta.veranlagungsjahr}`),
    h('div', { class: 'disclaimer', role: 'note' }, h('p', {}, content.meta.hinweis)),
    h(
      'div',
      { class: 'buttons' },
      h('button', { class: 'primary', 'data-key': 'new-game', onclick: a.newGame }, 'Neues Spiel'),
      h('button', { 'data-key': 'continue', disabled: !canContinue, onclick: a.continueGame }, 'Fortsetzen'),
    ),
  );
}

// ---------- Day intro ----------

export function introView(content: Content, state: GameState, a: Actions): HTMLElement {
  const d = dayInfo(content, state.day);
  return h(
    'main',
    { class: 'screen intro' },
    h(
      'section',
      { class: 'day-card' },
      h('h1', {}, `Tag ${d.day}`),
      h('p', {}, d.intro),
      d.storyEvents.map((e) =>
        e.type === 'note'
          ? h('figure', { class: 'note' }, h('blockquote', {}, e.text), h('figcaption', {}, `– ${e.from}`))
          : h('figure', { class: 'dialog' }, h('figcaption', {}, `${e.from}:`), h('blockquote', {}, e.text)),
      ),
      h('button', { class: 'primary', 'data-key': 'begin', onclick: a.beginWork }, 'An den Schreibtisch'),
    ),
  );
}

// ---------- Desk ----------

function paper(doc: Document): HTMLElement {
  return h(
    'article',
    { class: `paper ${doc.kind}` },
    h('h3', {}, doc.title),
    h(
      'table',
      {},
      h(
        'tbody',
        {},
        doc.lines.map(([label, value]) => h('tr', {}, h('th', { scope: 'row' }, label), h('td', {}, value))),
      ),
    ),
    doc.stamp ? h('div', { class: 'office-stamp', 'aria-label': `Kanzleistempel ${doc.stamp}` }, doc.stamp) : null,
  );
}

function pruefvermerk(content: Content, akte: Akte, state: GameState, a: Actions): HTMLElement {
  const answer = state.current!.answer;
  const locked = answer.stamp !== undefined;
  const header = h(
    'header',
    {},
    h('h2', {}, 'Prüfvermerk'),
    h('p', {}, `Akte ${akte.id.replace('/folge', ' (Nachreichung)')} · ${akte.taxpayer.name}, ${akte.taxpayer.job}`),
  );

  let body: HTMLElement;
  if (akte.kind.type === 'werbungskosten') {
    body = h(
      'table',
      { class: 'positions' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Position'), h('th', {}, 'Betrag'), h('th', {}, 'Entscheidung'))),
      h(
        'tbody',
        {},
        akte.kind.positions.map((p) => {
          const given = answer.positions[p.id];
          const btn = (v: PlayerVerdict) =>
            h(
              'button',
              {
                class: `verdict ${v}`,
                'data-key': `pos-${p.id}-${v}`,
                'aria-pressed': String(given === v),
                disabled: locked,
                onclick: () => a.decide(p.id, given === v ? undefined : v),
              },
              v,
            );
          return h(
            'tr',
            { 'data-position': p.id },
            h('td', {}, p.label),
            h('td', { class: 'amount' }, formatEuro(p.amount)),
            h('td', {}, h('div', { class: 'verdicts', role: 'group', 'aria-label': p.label }, btn('anerkennen'), btn('streichen'))),
          );
        }),
      ),
    );
  } else {
    const d = akte.kind.decision;
    body = h(
      'div',
      { class: 'decision', role: 'group', 'aria-label': d.question },
      h('h3', {}, d.question),
      d.options.map((o) =>
        h(
          'button',
          {
            class: 'option',
            'data-key': `opt-${o}`,
            'aria-pressed': String(answer.option === o),
            disabled: locked,
            onclick: () => a.choose(answer.option === o ? undefined : o),
          },
          optionLabel(content, o),
        ),
      ),
    );
  }

  return h(
    'section',
    { class: 'paper pruefvermerk', 'aria-label': 'Prüfvermerk', 'data-akte': akte.id },
    header,
    body,
    answer.stamp ? h('div', { class: `stamp-imprint ${answer.stamp}`, role: 'status' }, stampLabel(content, answer.stamp)) : null,
  );
}

export function deskView(content: Content, state: GameState, codexUi: CodexUiState, a: Actions): HTMLElement {
  const d = dayInfo(content, state.day);
  const akte = state.current ? getAkte(content, state.current.akteId) : null;
  const stamped = state.current?.answer.stamp !== undefined;

  const stack = h(
    'div',
    { class: 'stack-bar' },
    h('span', { class: 'day-label' }, `Tag ${state.day}`),
    h(
      'button',
      {
        class: 'stack',
        'data-key': 'stack',
        disabled: !!state.current || state.queue.length === 0,
        onclick: a.drawNext,
      },
      `Aktenstapel (${state.queue.length})`,
    ),
  );

  const work = h(
    'section',
    { class: 'worksurface', 'aria-label': 'Arbeitsfläche' },
    akte
      ? [pruefvermerk(content, akte, state, a), h('div', { class: 'papers' }, akte.documents.map(paper))]
      : h('p', { class: 'empty-desk' }, 'Der Tisch ist leer. Nehmen Sie die nächste Akte vom Stapel.'),
  );

  const tools = h(
    'aside',
    { class: 'tools', 'aria-label': 'Stempel und Ausgangskorb' },
    h('h2', {}, 'Stempel'),
    d.stamps.map((s) =>
      h(
        'button',
        { class: `stamp-btn ${s}`, 'data-key': `stamp-${s}`, disabled: !akte || stamped, onclick: () => a.stamp(s) },
        stampLabel(content, s),
      ),
    ),
    h('h2', {}, 'Ausgangskorb'),
    h('button', { class: 'outbox', 'data-key': 'outbox', disabled: !stamped, onclick: a.file }, 'In den Ausgangskorb'),
    akte && !stamped ? h('p', { class: 'hint' }, 'Erst stempeln, dann ablegen.') : null,
  );

  return h(
    'main',
    { class: 'screen desk' },
    stack,
    h('div', { class: 'desk-grid' }, renderCodex(content, state.day, codexUi, a.toggleCodex), work, tools),
  );
}

// ---------- Summary ----------

function ruleRef(rule: Rule): HTMLElement {
  return h(
    'li',
    {},
    h('strong', {}, rule.title),
    ' – ',
    h('a', { href: rule.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, rule.source),
  );
}

function solution(content: Content, akte: Akte): HTMLElement {
  const rules = (ids: string[]) =>
    h('ul', { class: 'rule-refs' }, ids.map((id) => ruleRef(content.rules.find((r) => r.id === id)!)));
  const stamp = h('p', {}, h('strong', {}, 'Richtiger Stempel: '), stampLabel(content, correctAnswer(akte).stamp!));
  if (akte.kind.type === 'werbungskosten') {
    return h(
      'div',
      { class: 'solution' },
      akte.kind.positions.map((p) =>
        h(
          'div',
          { class: 'solution-item' },
          h('p', {}, h('strong', {}, `${p.label} (${formatEuro(p.amount)}): `), verdictLabel(content, p.correct)),
          h('p', { class: 'explanation' }, p.explanation),
          rules(p.rules),
        ),
      ),
      stamp,
    );
  }
  const d = akte.kind.decision;
  return h(
    'div',
    { class: 'solution' },
    h(
      'div',
      { class: 'solution-item' },
      h('p', {}, h('strong', {}, `${d.question}: `), optionLabel(content, d.correct)),
      h('p', { class: 'explanation' }, d.explanation),
      rules(d.rules),
    ),
    stamp,
  );
}

export function summaryView(content: Content, state: GameState, a: Actions): HTMLElement {
  const results = resultsOfDay(state, state.day);
  const total = errorsOfDay(state, state.day);
  return h(
    'main',
    { class: 'screen summary' },
    h('h1', {}, `Tagesauswertung – Tag ${state.day}`),
    h('p', { class: 'total', 'data-testid': 'errors-total' }, total === 0 ? 'Keine Fehler.' : `Fehler heute: ${total}`),
    needsReprimand(content, state, state.day)
      ? h(
          'figure',
          { class: 'dialog reprimand' },
          h('figcaption', {}, `${content.texts.warning.from}:`),
          h('blockquote', {}, content.texts.warning.text),
        )
      : null,
    results.length === 0 ? h('p', { class: 'empty-day', 'data-testid': 'empty-day' }, content.texts.emptyDay) : null,
    results.map((r) => {
      const akte = getAkte(content, r.akteId);
      const ok = r.errors.length === 0;
      return h(
        'section',
        { class: `result ${ok ? 'ok' : 'wrong'}`, 'data-akte': r.akteId },
        h(
          'h2',
          {},
          h('span', { class: 'mark', 'aria-hidden': 'true' }, ok ? '✓' : '✗'),
          ` ${akte.taxpayer.name}${akte.isFollowUp ? ' (Nachreichung)' : ''} – ${ok ? 'richtig' : 'falsch'}`,
        ),
        ok ? null : h('ul', { class: 'errors' }, r.errors.map((e) => errorLine(content, akte, e))),
        h('details', { open: !ok }, h('summary', {}, 'Lösung und Begründung'), solution(content, akte)),
      );
    }),
    h('button', { class: 'primary', 'data-key': 'advance', onclick: a.advanceDay }, 'Feierabend'),
  );
}

// ---------- End of prototype ----------

export function finishedView(content: Content, state: GameState, a: Actions): HTMLElement {
  const perDay = errorsPerDay(content, state);
  return h(
    'main',
    { class: 'screen finished' },
    h('h1', {}, 'Ende des Prototyps'),
    h(
      'table',
      { class: 'overview' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Tag'), h('th', {}, 'Fehler'))),
      h(
        'tbody',
        {},
        Object.entries(perDay).map(([d, n]) => h('tr', {}, h('td', {}, d), h('td', {}, n))),
      ),
    ),
    h('button', { class: 'primary', 'data-key': 'to-start', onclick: a.toStart }, 'Zum Startbildschirm'),
  );
}

export function errorView(message: string): HTMLElement {
  return h('main', { class: 'screen error' }, h('h1', {}, 'Inhalte konnten nicht geladen werden'), h('pre', {}, message));
}

