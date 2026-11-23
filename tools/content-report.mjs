#!/usr/bin/env node
/**
 * Inhaltsbericht (SPEC 10.5): für alle Inhaltsdateien je Tag Akten, Regeln und
 * Fragen, dazu jeder Text mit `provisional: true` mit Tag und Fundort. Für
 * Autoren im Chat-Projekt; läuft ohne Browser: `npm run content:report`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'content');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'ui.json' && f !== 'kalender.json')
  .sort();

const out = [];
const provisional = [];
const short = (s, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

for (const name of files) {
  const data = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  out.push(`# ${name} ${data.meta?.version ?? '?'}`, '');
  const rules = data.rules ?? [];
  for (const d of [...(data.days ?? [])].sort((a, b) => a.day - b.day)) {
    const dayRules = rules.filter((r) => r.day === d.day).map((r) => r.id);
    const questions = (d.questions ?? []).map((q) => q.id + (q.after ? ` (nach ${q.after})` : ''));
    out.push(`Tag ${d.day}`);
    out.push(`  Akten:  ${d.cases.length ? d.cases.join(', ') : '–'}`);
    out.push(`  Regeln: ${dayRules.length ? dayRules.join(', ') : '–'}`);
    out.push(`  Fragen: ${questions.length ? questions.join(', ') : '–'}`);
    d.storyEvents.forEach((e, i) => {
      if (e.provisional) provisional.push(`Tag ${d.day}, storyEvents.${i} (${e.type}${e.id ? ` ${e.id}` : ''}): ${short(e.text ?? e.headline ?? e.feature ?? '')}`);
    });
    for (const q of d.questions ?? []) {
      if (q.provisional) provisional.push(`Tag ${d.day}, Frage ${q.id}${q.from ? ` von ${q.from}` : ''}: ${short(q.text)} | Antwort: ${short(q.answer.text)}`);
    }
  }
  out.push('');
}

out.push(`# Vorläufige Texte (${provisional.length})`, '', ...(provisional.length ? provisional : ['keine']));
console.log(out.join('\n'));
