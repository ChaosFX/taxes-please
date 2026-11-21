import { toCents } from './amount';
import { ContentSchema, OFFEN } from './schema';
import {
  isAmountDecision,
  type Akte,
  type Case,
  type Content,
  type Document,
  type EDecision,
  type Option,
} from './types';

export class ContentError extends Error {
  constructor(
    public readonly problems: string[],
    /** `Datei version` per content file, shown with every error (SPEC 3). */
    public readonly versions: string[] = [],
  ) {
    super(`Inhaltsdatei ungültig:\n- ${problems.join('\n- ')}${versions.length ? `\nVersionen: ${versions.join(', ')}` : ''}`);
    this.name = 'ContentError';
  }
}

/** A content file as read from disk; the name only serves error messages. */
export interface ContentFile {
  name: string;
  data: unknown;
}

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Readable place for a schema issue: `cases.12.decisions.0.correct` becomes
 * `Akte 5-3, decisions.0.correct`, `days.3.…` becomes `Tag 4, …`.
 */
function where(raw: unknown, path: PropertyKey[]): string {
  const [area, index, ...rest] = path;
  const tail = rest.map(String).join('.');
  const item = isObject(raw) && Array.isArray(raw[area as string]) ? (raw[area as string] as unknown[])[index as number] : undefined;
  const join = (head: string) => (tail ? `${head}, ${tail}` : head);
  if (isObject(item)) {
    if (area === 'cases' && typeof item.id === 'string') return join(`Akte ${item.id}`);
    if (area === 'days' && typeof item.day === 'number') return join(`Tag ${item.day}`);
    if (area === 'rules' && typeof item.id === 'string') return join(`Regel ${item.id}`);
  }
  return path.map(String).join('.') || '(Wurzel)';
}

/**
 * Validates raw JSON against the schema plus cross references.
 * Throws a ContentError listing every problem found.
 */
export function loadContent(raw: unknown, versions: string[] = []): Content {
  const parsed = ContentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ContentError(
      parsed.error.issues.map((i) => `${where(raw, i.path)}: ${i.message}`),
      versions,
    );
  }
  const content = parsed.data;
  const problems = crossCheck(content);
  if (problems.length > 0) throw new ContentError(problems, versions);
  return content;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

export const optionValue = (o: Option): string => (typeof o === 'string' ? o : o.value);

/** Checks shared by the documents of an Akte and its follow-up. */
function checkDocuments(where: string, docs: Document[], problems: string[]): void {
  for (const d of duplicates(docs.map((d) => d.title))) problems.push(`${where}: Dokumenttitel doppelt: „${d}“`);
  for (const doc of docs) {
    for (const d of duplicates(doc.lines.map(([label]) => label))) {
      problems.push(`${where}, Dokument „${doc.title}“: Zeile doppelt: „${d}“`);
    }
  }
}

/** Checks for the decisions of an `entscheidungen` Akte or its follow-up. Returns referenced rules. */
function checkDecisions(where: string, decisions: EDecision[], c: Content, problems: string[]): void {
  for (const d of duplicates(decisions.map((d) => d.id))) problems.push(`${where}: Entscheidung doppelt: ${d}`);
  for (const d of decisions) {
    if (isAmountDecision(d)) continue;
    const values = d.options.map(optionValue);
    for (const v of duplicates(values)) problems.push(`${where}, Entscheidung ${d.id}: Option doppelt: „${v}“`);
    if (values.includes(OFFEN)) problems.push(`${where}, Entscheidung ${d.id}: „${OFFEN}“ darf keine Option sein`);
    if (d.correct !== OFFEN && !values.includes(d.correct)) {
      problems.push(`${where}, Entscheidung ${d.id}: richtige Option „${d.correct}“ ist nicht unter den Optionen`);
    }
    for (const o of d.options) {
      if (typeof o === 'string' && !(o in c.texts.optionLabels)) {
        problems.push(`${where}, Entscheidung ${d.id}: Option „${o}“ fehlt in texts.optionLabels`);
      }
    }
  }
}

interface Graded {
  correct: string;
  rules: string[];
}

/** Items that carry a verdict and rules, per Akte (regular or follow-up). */
function gradedItems(akte: Akte): Graded[] {
  switch (akte.kind.type) {
    case 'werbungskosten':
      return akte.kind.positions.map((p) => ({ correct: p.correct, rules: p.rules }));
    case 'steuerpflicht':
      return [{ correct: akte.kind.decision.correct, rules: akte.kind.decision.rules }];
    case 'entscheidungen':
      return akte.kind.decisions.map((d) => ({ correct: String(d.correct), rules: d.rules }));
  }
}

function crossCheck(c: Content): string[] {
  const problems: string[] = [];
  const rules = new Map(c.rules.map((r) => [r.id, r]));
  const caseIds = new Set(c.cases.map((k) => k.id));

  for (const d of duplicates(c.rules.map((r) => r.id))) problems.push(`Regel-ID doppelt: ${d}`);
  for (const d of duplicates(c.cases.map((k) => k.id))) problems.push(`Akten-ID doppelt: ${d}`);
  for (const d of duplicates(c.days.map((x) => String(x.day)))) problems.push(`Tag doppelt: ${d}`);

  const scheduled = new Map<string, number>();
  for (const day of c.days) {
    for (const id of day.cases) {
      if (!caseIds.has(id)) problems.push(`Tag ${day.day}: unbekannte Akte ${id}`);
      if (scheduled.has(id)) problems.push(`Akte ${id} ist mehreren Tagen zugeordnet`);
      scheduled.set(id, day.day);
    }
  }
  for (const k of c.cases) {
    if (!scheduled.has(k.id)) problems.push(`Akte ${k.id} ist keinem Tag zugeordnet`);
  }

  const usedOptions = new Set<string>();
  let needsInquiryText = false;
  let needsDiscrepancyText = false;

  for (const k of c.cases) {
    const at = `Akte ${k.id}`;
    const day = scheduled.get(k.id);
    checkDocuments(at, k.documents, problems);

    if (k.type === 'werbungskosten') {
      for (const d of duplicates(k.positions.map((p) => p.id))) problems.push(`${at}: Position doppelt: ${d}`);
    } else if (k.type === 'steuerpflicht') {
      k.decision.options.forEach((o) => usedOptions.add(o));
      for (const o of k.decision.options) {
        if (!(o in c.texts.optionLabels)) problems.push(`${at}: Option „${o}“ fehlt in texts.optionLabels`);
      }
      if (!k.decision.options.includes(k.decision.correct)) {
        problems.push(`${at}: richtige Option „${k.decision.correct}“ ist nicht unter den Optionen`);
      }
    } else {
      const all = [...k.decisions, ...(k.followUp?.decisions ?? [])];
      for (const d of all) if (!isAmountDecision(d)) d.options.forEach((o) => typeof o === 'string' && usedOptions.add(o));
      checkDecisions(at, k.decisions, c, problems);
      const byId = new Map(k.decisions.map((d) => [d.id, d]));

      const docs = new Map(k.documents.map((d) => [d.title, d]));
      const lineExists = (ref: { document: string; line: string }, label: string) => {
        const doc = docs.get(ref.document);
        if (!doc) problems.push(`${label}: Dokument „${ref.document}“ gibt es in der Akte nicht`);
        else if (!doc.lines.some(([l]) => l === ref.line)) problems.push(`${label}: Zeile „${ref.line}“ fehlt in Dokument „${ref.document}“`);
      };
      const discrepancies = k.discrepancies ?? [];
      if (discrepancies.length) needsDiscrepancyText = true;
      for (const d of duplicates(discrepancies.map((x) => x.id))) problems.push(`${at}: Widerspruch doppelt: ${d}`);
      for (const w of discrepancies) {
        const label = `${at}, Widerspruch ${w.id}`;
        if (!byId.has(w.decision)) problems.push(`${label}: unbekannte Entscheidung ${w.decision}`);
        lineExists(w.a, label);
        lineExists(w.b, label);
        if (w.a.document === w.b.document) problems.push(`${label}: a und b liegen im selben Dokument „${w.a.document}“`);
      }

      if (k.inquiry) {
        needsInquiryText = true;
        const q = k.inquiry;
        const label = `${at}, Nachfrage`;
        const target = byId.get(q.decision);
        if (!target) problems.push(`${label}: unbekannte Entscheidung ${q.decision}`);
        else if (target.correct !== OFFEN) problems.push(`${label}: Entscheidung ${q.decision} ist nicht „${OFFEN}“`);
        for (const d of duplicates(q.options.map((o) => o.id))) problems.push(`${label}: Frage doppelt: ${d}`);
        if (!q.options.some((o) => o.id === q.correct)) problems.push(`${label}: richtige Frage „${q.correct}“ ist nicht unter den Fragen`);
        if (!k.followUp) problems.push(`${label}: Akte mit Nachfrage braucht einen followUp`);
      }
      if (k.followUp) checkDecisions(`${at} (Folgeakte)`, k.followUp.decisions, c, problems);
    }

    if (k.variantOf !== undefined) {
      if (k.variantOf === k.id) problems.push(`${at}: variantOf zeigt auf sich selbst`);
      else if (!caseIds.has(k.variantOf)) problems.push(`${at}: variantOf zeigt auf unbekannte Akte ${k.variantOf}`);
    }

    // Rules: known, and unlocked by the day the Akte lands on the desk.
    const check = (akte: Akte, onDay: number | undefined, label: string) => {
      const items = gradedItems(akte);
      for (const it of items) {
        for (const r of it.rules) {
          const rule = rules.get(r);
          if (!rule) problems.push(`${label}: unbekannte Regel ${r}`);
          else if (onDay !== undefined && rule.day > onDay) {
            problems.push(`${label}: Regel ${r} wird erst an Tag ${rule.day} freigeschaltet, die Akte liegt an Tag ${onDay} auf dem Tisch`);
          }
        }
      }
      const hasOffen = items.some((it) => it.correct === OFFEN);
      if (hasOffen && akte.correctStamp !== 'ergaenzung') problems.push(`${label}: hat eine offene Entscheidung, richtiger Stempel muss „ergaenzung“ sein`);
      if (!hasOffen && akte.correctStamp === 'ergaenzung') problems.push(`${label}: Ergänzungsersuchen als richtiger Stempel, aber keine Entscheidung ist „${OFFEN}“`);
      const dayInfo = c.days.find((x) => x.day === onDay);
      if (dayInfo && !dayInfo.stamps.includes(akte.correctStamp)) {
        problems.push(`${label}: richtiger Stempel „${akte.correctStamp}“ ist an Tag ${dayInfo.day} nicht verfügbar`);
      }
    };
    check(caseToAkte(k), day, at);

    if (k.followUp) {
      const fu = k.followUp;
      checkDocuments(`${at} (Folgeakte)`, fu.documents, problems);
      if (!c.days.some((x) => x.day === fu.arrivesOnDay)) {
        problems.push(`${at}: Folgeakte trifft an Tag ${fu.arrivesOnDay} ein, den es nicht gibt`);
      }
      if (day !== undefined && fu.arrivesOnDay <= day) {
        problems.push(`${at}: Folgeakte muss nach Tag ${day} eintreffen`);
      }
      if (k.correctStamp !== 'ergaenzung') {
        problems.push(`${at}: Folgeakte ohne Ergänzungsersuchen als richtigen Stempel kann nie eintreffen`);
      }
      check(followUpToAkte(k), fu.arrivesOnDay, `${at} (Folgeakte)`);
    }
  }

  for (const key of Object.keys(c.texts.optionLabels)) {
    if (!usedOptions.has(key)) problems.push(`texts.optionLabels: Schlüssel „${key}“ kommt in keiner Entscheidung vor`);
  }
  if (needsInquiryText && !c.texts.wrongInquiry) problems.push('texts.wrongInquiry fehlt, wird für Nachfragen gebraucht');
  if (needsDiscrepancyText) {
    if (!c.texts.missedDiscrepancy) problems.push('texts.missedDiscrepancy fehlt, wird für Widersprüche gebraucht');
    if (!c.texts.falseDiscrepancy) problems.push('texts.falseDiscrepancy fehlt, wird für Widersprüche gebraucht');
  }

  // Story events and traces (traces are only checked in this version).
  const eventIds: string[] = [];
  const traceIds: string[] = [];
  for (const day of c.days) {
    for (const e of day.storyEvents) if (e.type === 'event') eventIds.push(e.id);
    for (const tr of day.traces ?? []) {
      traceIds.push(tr.id);
      const label = `Tag ${day.day}, Spur ${tr.id}`;
      for (const link of tr.links) {
        const k = c.cases.find((x) => x.id === link.case);
        if (!k) {
          problems.push(`${label}: unbekannte Akte ${link.case}`);
          continue;
        }
        if ('field' in link) {
          if (!(link.field in k)) problems.push(`${label}: Akte ${k.id} hat kein Feld „${link.field}“`);
          continue;
        }
        const docs = [...k.documents, ...(k.followUp?.documents ?? [])];
        const doc = docs.find((d) => d.title === link.document);
        if (!doc) problems.push(`${label}: Akte ${k.id} hat kein Dokument „${link.document}“`);
        else if (!doc.lines.some(([l]) => l === link.line)) problems.push(`${label}: Akte ${k.id}, Dokument „${link.document}“ hat keine Zeile „${link.line}“`);
      }
    }
  }
  for (const d of duplicates(eventIds)) problems.push(`Ereignis-ID doppelt: ${d}`);
  for (const d of duplicates(traceIds)) problems.push(`Spur-ID doppelt: ${d}`);

  return problems;
}

function kindOf(k: Case): Akte['kind'] {
  switch (k.type) {
    case 'werbungskosten':
      return { type: k.type, positions: k.positions };
    case 'steuerpflicht':
      return { type: k.type, decision: k.decision };
    case 'entscheidungen':
      return { type: k.type, decisions: k.decisions, discrepancies: k.discrepancies ?? [], inquiry: k.inquiry };
  }
}

export function caseToAkte(k: Case): Akte {
  return {
    id: k.id,
    sourceCaseId: k.id,
    isFollowUp: false,
    story: k.story ?? false,
    taxpayer: k.taxpayer,
    representative: k.representative,
    documents: k.documents,
    correctStamp: k.correctStamp,
    kind: kindOf(k),
  };
}

export const FOLLOW_UP_SUFFIX = '/folge';

export function followUpToAkte(k: Case): Akte {
  if (!k.followUp) throw new Error(`Akte ${k.id} hat keine Folgeakte`);
  const kind: Akte['kind'] =
    'decisions' in k.followUp
      ? { type: 'entscheidungen', decisions: k.followUp.decisions, discrepancies: [] }
      : { type: 'werbungskosten', positions: k.followUp.positions };
  return {
    id: k.id + FOLLOW_UP_SUFFIX,
    sourceCaseId: k.id,
    isFollowUp: true,
    story: k.story ?? false,
    taxpayer: k.taxpayer,
    representative: k.representative,
    documents: k.followUp.documents,
    correctStamp: k.followUp.correctStamp,
    kind,
  };
}

/** Looks up any Akte (regular or follow-up) by id. */
export function getAkte(content: Content, akteId: string): Akte {
  const isFollow = akteId.endsWith(FOLLOW_UP_SUFFIX);
  const caseId = isFollow ? akteId.slice(0, -FOLLOW_UP_SUFFIX.length) : akteId;
  const k = content.cases.find((x) => x.id === caseId);
  if (!k) throw new Error(`Unbekannte Akte ${akteId}`);
  return isFollow ? followUpToAkte(k) : caseToAkte(k);
}

/** Rule ids an Akte references, in order, without duplicates. */
export function rulesOf(akte: Akte): string[] {
  return [...new Set(gradedItems(akte).flatMap((it) => it.rules))];
}

/** Correct amount of an amount decision in cents. */
export const correctCents = (d: EDecision): number | null => (isAmountDecision(d) ? toCents(d.correct) : null);

// ---------- Merging several files (SPEC 3) ----------

const TEXT_REQUIRED = ['stampLabels', 'unnecessaryDelay', 'warning', 'emptyDay'] as const;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Merges the content files (one per act, sorted by name) into one and validates it.
 * `meta` comes from the first file; every file needs its own `meta.version`.
 * `rules`, `days` and `cases` are appended; `texts` is merged key by key,
 * `texts.optionLabels` as a union. The same key with different values is an error.
 */
export function loadContentFiles(files: ContentFile[]): Content {
  if (files.length === 0) throw new ContentError(['Keine Inhaltsdateien gefunden']);
  const problems: string[] = [];
  const versions: string[] = [];
  const texts: Raw = {};
  const optionLabels: Raw = {};
  const textFrom = new Map<string, string>();
  const list = (f: Raw, key: string, name: string): unknown[] => {
    const v = f[key];
    if (v === undefined) return [];
    if (!Array.isArray(v)) {
      problems.push(`${name}: ${key} ist keine Liste`);
      return [];
    }
    return v;
  };

  for (const { name, data } of files) {
    if (!isObject(data)) {
      problems.push(`${name}: ist kein JSON-Objekt`);
      continue;
    }
    const version = isObject(data.meta) && typeof data.meta.version === 'string' ? data.meta.version : null;
    if (version === null) problems.push(`${name}: meta.version fehlt`);
    versions.push(`${name} ${version ?? '?'}`);

    if (data.texts === undefined) continue;
    if (!isObject(data.texts)) {
      problems.push(`${name}: texts ist kein Objekt`);
      continue;
    }
    for (const [key, value] of Object.entries(data.texts)) {
      if (key === 'optionLabels' && isObject(value)) {
        for (const [o, label] of Object.entries(value)) {
          const id = `optionLabels.${o}`;
          if (o in optionLabels && !same(optionLabels[o], label)) {
            problems.push(`texts.${id}: verschiedene Werte in ${textFrom.get(id)} und ${name}`);
          } else {
            optionLabels[o] = label;
            textFrom.set(id, textFrom.get(id) ?? name);
          }
        }
        continue;
      }
      if (key in texts && !same(texts[key], value)) {
        problems.push(`texts.${key}: verschiedene Werte in ${textFrom.get(key)} und ${name}`);
      } else {
        texts[key] = value;
        textFrom.set(key, textFrom.get(key) ?? name);
      }
    }
  }
  for (const key of TEXT_REQUIRED) {
    if (!(key in texts)) problems.push(`texts.${key} fehlt in allen Inhaltsdateien`);
  }
  if (problems.length > 0) throw new ContentError(problems, versions);

  const objects = files.map((f) => f.data as Raw);
  const merged = {
    meta: objects[0]!.meta,
    texts: { ...texts, optionLabels },
    rules: files.flatMap((f, i) => list(objects[i]!, 'rules', f.name)),
    days: files.flatMap((f, i) => list(objects[i]!, 'days', f.name)),
    cases: files.flatMap((f, i) => list(objects[i]!, 'cases', f.name)),
  };
  if (problems.length > 0) throw new ContentError(problems, versions);
  return loadContent(merged, versions);
}
