# Taxes Please – Anweisungen für Claude Code

Lernspiel im Stil von Papers Please in der österreichischen Finanzverwaltung (Dienstprüfung A2/v2). Repo: github.com/ChaosFX/taxes-please. Antworte auf Deutsch, technische Begriffe dürfen englisch bleiben.

## Zusammenarbeit mit dem Claude-Projekt „Taxes Please“

Konzept, Story, Fälle und Spezifikation entstehen im Claude-Chat (Projekt „Taxes Please“). Hier im Repo wird umgesetzt. Damit es nicht zu Konflikten kommt, hat jede Datei genau einen Eigentümer.

| Bereich | Eigentümer | Regel |
| --- | --- | --- |
| `src/`, `tests/`, Konfiguration, `.github/` | Claude Code | Änderst du frei. |
| `SPEC.md`, `content/*.json`, `auftraege/*.md` | Chat | Änderst du nicht selbst. Fällt ein Fehler, Widerspruch oder fehlender Text auf, im Bericht melden, nicht still anpassen oder im Code erfinden. |
| `CHANGELOG.md` | beide | Eine Zeile pro Änderung an SPEC oder JSON mit Datum, Datei und Version. Du ergänzt, wenn du auf Anweisung eine dieser Dateien änderst. |
| Konzept und Story (`konzept/`, Rahmenhandlung, Stoffgliederungsplan) | Chat, nur im Projekt | Liegen nicht im Repo. |

Arbeitsaufträge liegen in `auftraege/` als nummerierte Markdown-Dateien mit klaren Abnahmekriterien. Arbeite sie der Reihe nach ab und melde pro Auftrag: erledigt, offen, Abweichungen. Erledigte Aufträge nicht löschen, sondern im Bericht als erledigt nennen.

Zu Beginn jeder Session: `git pull`, dann die Version in `SPEC.md` und `content/*.json` (`meta.version`) nennen, damit Abweichungen zum Projekt sofort auffallen.

## Technik
- Alles, was gelesen oder angeklickt wird, ist HTML/CSS. Three.js nur für Atmosphäre als eigene Ebene.
- Vite mit TypeScript (strict), Spiellogik in `src/core` getrennt von `src/ui` und vollständig getestet. Inhalte als JSON, Veröffentlichung über GitHub Pages.
- Spieltexte stehen im JSON (`texts`), nie im Code (siehe `tests/unit/no-hardcoded-text.test.ts`).

## Steuerrecht und Inhalt
- Keine Steuerregel im Code nachbauen oder raten. Die Spiellogik entscheidet nur anhand der Daten im JSON.
- Kodextexte sind vereinfacht und tragen den Hinweis „vereinfacht“.

## Grenzen
- Alle Personen und Firmen sind erfunden.
- Nichts aus internen Fällen, Daten oder Programmen des Finanzamts verwenden, auch nicht anonymisiert.
- Die BFA-Skripten sind Dienstexemplare und gehören nicht ins Repo.
