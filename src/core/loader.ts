import { ContentSchema } from './schema';
import type { Akte, Case, Content } from './types';

export class ContentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Inhaltsdatei ungültig:\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
  }
}

/**
 * Validates raw JSON against the schema plus cross references.
 * Throws a ContentError listing every problem found.
 */
export function loadContent(raw: unknown): Content {
  const parsed = ContentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ContentError(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(Wurzel)'}: ${i.message}`),
    );
  }
  const content = parsed.data;
  const problems = crossCheck(content);
  if (problems.length > 0) throw new ContentError(problems);
  return content;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

function crossCheck(c: Content): string[] {
  const problems: string[] = [];
  const ruleIds = new Set(c.rules.map((r) => r.id));
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

  for (const k of c.cases) {
    const refs: string[] = [];
    if (k.type === 'werbungskosten') {
      for (const d of duplicates(k.positions.map((p) => p.id))) problems.push(`Akte ${k.id}: Position doppelt: ${d}`);
      k.positions.forEach((p) => refs.push(...p.rules));
    } else {
      refs.push(...k.decision.rules);
      for (const o of k.decision.options) {
        if (!(o in c.texts.optionLabels)) problems.push(`Akte ${k.id}: Option „${o}“ fehlt in texts.optionLabels`);
      }
      if (!k.decision.options.includes(k.decision.correct)) {
        problems.push(`Akte ${k.id}: richtige Option „${k.decision.correct}“ ist nicht unter den Optionen`);
      }
    }
    if (k.followUp) {
      k.followUp.positions.forEach((p) => refs.push(...p.rules));
      const day = scheduled.get(k.id);
      if (!c.days.some((x) => x.day === k.followUp!.arrivesOnDay)) {
        problems.push(`Akte ${k.id}: Folgeakte trifft an Tag ${k.followUp.arrivesOnDay} ein, den es nicht gibt`);
      }
      if (day !== undefined && k.followUp.arrivesOnDay <= day) {
        problems.push(`Akte ${k.id}: Folgeakte muss nach Tag ${day} eintreffen`);
      }
      if (k.correctStamp !== 'ergaenzung') {
        problems.push(`Akte ${k.id}: Folgeakte ohne Ergänzungsersuchen als richtigen Stempel kann nie eintreffen`);
      }
    }
    for (const r of refs) if (!ruleIds.has(r)) problems.push(`Akte ${k.id}: unbekannte Regel ${r}`);

    const day = c.days.find((x) => x.day === scheduled.get(k.id));
    if (day && !day.stamps.includes(k.correctStamp)) {
      problems.push(`Akte ${k.id}: richtiger Stempel „${k.correctStamp}“ ist an Tag ${day.day} nicht verfügbar`);
    }
  }
  const usedOptions = new Set(c.cases.flatMap((k) => (k.type === 'steuerpflicht' ? k.decision.options : [])));
  for (const key of Object.keys(c.texts.optionLabels)) {
    if (!usedOptions.has(key)) problems.push(`texts.optionLabels: Schlüssel „${key}“ kommt in keiner Entscheidung vor`);
  }
  return problems;
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
    kind: k.type === 'werbungskosten' ? { type: k.type, positions: k.positions } : { type: k.type, decision: k.decision },
  };
}

export const FOLLOW_UP_SUFFIX = '/folge';

export function followUpToAkte(k: Case): Akte {
  if (!k.followUp) throw new Error(`Akte ${k.id} hat keine Folgeakte`);
  return {
    id: k.id + FOLLOW_UP_SUFFIX,
    sourceCaseId: k.id,
    isFollowUp: true,
    story: k.story ?? false,
    taxpayer: k.taxpayer,
    representative: k.representative,
    documents: k.followUp.documents,
    correctStamp: k.followUp.correctStamp,
    kind: { type: 'werbungskosten', positions: k.followUp.positions },
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
  const ids = akte.kind.type === 'werbungskosten' ? akte.kind.positions.flatMap((p) => p.rules) : akte.kind.decision.rules;
  return [...new Set(ids)];
}

/**
 * Merges several raw content files (one per section) into one and validates it.
 * `meta` and `texts` are taken from the first file.
 */
export function loadContentFiles(files: unknown[]): Content {
  if (files.length === 0) throw new ContentError(['Keine Inhaltsdateien gefunden']);
  if (files.length === 1) return loadContent(files[0]);
  const pick = (f: unknown, key: string): unknown[] => {
    const v = (f as Record<string, unknown> | null)?.[key];
    return Array.isArray(v) ? v : [];
  };
  return loadContent({
    meta: (files[0] as Record<string, unknown> | null)?.meta,
    texts: (files[0] as Record<string, unknown> | null)?.texts,
    rules: files.flatMap((f) => pick(f, 'rules')),
    days: files.flatMap((f) => pick(f, 'days')),
    cases: files.flatMap((f) => pick(f, 'cases')),
  });
}
