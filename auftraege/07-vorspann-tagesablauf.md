# Auftrag 07: Vorspann, Ereignisse im Lauf des Tages, Zeitungsausschnitte

Stand: 23.11.2026 · gehört zu SPEC 0.6.0, Abschnitte 3, 4, 7.8, 9 und 11 · baut auf Auftrag 06 auf · Inhalte: `akt1.json` 0.4.0, `ui.json` 0.6.0, `kalender.json` 0.1.0 unverändert

Die Inhalte liegen auf dem Branch `auftrag-07-prolog-tagesablauf`, weil der heutige Code `prologue`, `at` und `clipping` nicht kennt (die Schemas sind strikt). Arbeite auf diesem Branch und merge erst, wenn alles grün ist.

## Ziel

Beim Durchspielen hat sich gezeigt: Die Mechanik trägt, aber die Story versteht man nicht. Der Spieler weiß nicht, wer Johanna und Mia sind, und alles kommt am Morgen auf einmal, auch was eigentlich am Abend passiert. Dieser Auftrag schafft drei kleine Bausteine, mit denen der Chat Akt I als geschlossenen Bogen erzählen kann:

1. **Vorspann:** drei ruhige Bildschirme vor Tag 1 (Küche, Kühlschrank, Brief der Dienststelle). Sie stellen Johanna, Mia, die Abholzeit 16:30 und Sedlak vor.
2. **Ereignisse im Lauf des Tages:** Ein Story-Ereignis kann gleich nach dem Ablegen einer bestimmten Akte oder am Tagesende erscheinen, am Tisch statt auf der Tageskarte. An Tag 10 heißt das: Nach Brandls letzter Akte sagt Gerri etwas, und erst am Abend geht die Lade auf, Pernold ruft an und Johanna schreibt.
3. **Zeitungsausschnitte:** Die Morgenzeitung bringt nur noch Aktuelles (April 2026). Meldungen über 2025 kommen als Ausschnitt aus Sedlaks Mappe, mit Datum und seiner Randnotiz.

Bewertung, Folgeakten, Pinnwand und Stapel ändern sich nicht.

**Grundgerüst vor Story:** Wie in Auftrag 06 kennt der Code keine Figur und keinen Text. Wann etwas erscheint, steht nur im JSON. Alle neuen Story-Texte tragen `provisional: true`.

## Vorab lesen

- `SPEC.md` 0.6.0: Änderungen am Anfang, Abschnitt 3 (Vorspann, `at`, `clipping`, neue Loader-Prüfungen), 4 (Punkte 1a, 2, 4a, 5), 7.8, 9 (`prologueSeen`, `eventsShown`), 11 (Block „Vorspann und Tagesablauf“).
- `content/akt1.json` 0.4.0: `prologue` (nach `meta`), Tag 4, 5 und 7 (`clipping`), Tag 6 und 9 (neue Zeitungstexte), Tag 10 (`at`, neue Frage q4 nach q3).
- `content/ui.json` 0.6.0: Bereich `prologue`, `intro.clipping`, `intro.marginNote`, `intro.continue`, `aria.prologue`, `aria.deskEvent`.

## Aufgaben in dieser Reihenfolge

### 1. core

- Schema: `prologue` je Datei, `at` an allen Story-Ereignissen außer `actSummary`, `clipping` an `newspaper`. Alle neuen Prüfungen aus SPEC 3, auch „`keep` nicht vor `unlock: drawer`“ unter Berücksichtigung von `at`.
- Reine Funktionen: Ereignisse eines Tages zu einem Zeitpunkt (Start, nach Akte X, Ende), mit Rückfall auf das Tagesende, wenn die Akte an diesem Tag nicht im Stapel liegt. Offene Ereignisse nach dem Neuladen.
- Spielstand um `prologueSeen` und `eventsShown` (SPEC 9). Alte Stände laden.
- `npm run content:report` zeigt bei Ereignissen den Zeitpunkt und listet Vorspann-Bildschirme.

### 2. Vorspann (SPEC 4, Punkt 1a, und 7.8)

- Eigener Bildschirm zwischen „Neues Spiel“ und Tageskarte. Weiter, Überspringen, Tastatur, „Effekte aus“.
- Musik von Akt 1 darf schon im Vorspann laufen.

### 3. Ereignisse am Tisch (SPEC 4, Punkt 4a und 5, und 7.8)

- Overlay über dem Tisch mit den vorhandenen Darstellungen von Zettel, Sprechblase, Anruf, Zeitung und Freischaltung. Mehrere Ereignisse nacheinander. Solange eines offen ist, bleibt der Tisch gesperrt.
- `unlock` am Tisch schaltet das Werkzeug erst in diesem Moment frei. An Tag 10 klemmt die Lade also bis zum Tagesende.
- `keep: "drawer"` funktioniert auch für Zettel am Tisch (`ui.drawer.stored`).

### 4. Zeitungsausschnitt (SPEC 3 und 7.8)

- Ausschnitt statt ganzer Seite, Datum mit `ui.intro.clipping`, Randnotiz in Handschrift, für Screenreader mit `ui.intro.marginNote`.

### 5. Tests und Screenshots

- Unit- und Loader-Tests nach SPEC 11, Block „Vorspann und Tagesablauf“.
- Bestehende Tests, die sich auf den Inhalt von Akt I beziehen, an 0.4.0 anpassen und im Bericht nennen. Bekannt: `tests/unit/board.test.ts` erwartet an Tag 10 genau q1 bis q3, jetzt kommt q4 nach q3 dazu. Die e2e-Tests zur Lade an Tag 10 gehen davon aus, dass sie am Morgen aufgeht, jetzt erst am Tagesende.
- e2e kurz halten (SPEC 2), mit vorbereitetem Spielstand. `@smoke` bekommt: Vorspann durchklicken und überspringen, Tag 10 von der Folgeakte 9-2 bis zum Tagesende.
- Screenshots: jeder Vorspann-Bildschirm, Zeitungsausschnitt an Tag 5 (normal und vergrößert), Gerris Satz am Tisch an Tag 10, Johannas Nachricht am Tagesende von Tag 10, die geöffnete Lade danach.

## Oberflächentexte

Neu in `ui.json` 0.6.0 (vom Chat angelegt, bitte nicht ändern; fehlt etwas, im Bericht melden):

| Schlüssel | Text |
| --- | --- |
| `prologue.next` | Weiter |
| `prologue.skip` | Vorspann überspringen |
| `prologue.start` | Zum ersten Arbeitstag |
| `intro.clipping` | Zeitungsausschnitt vom {date} |
| `intro.marginNote` | Randnotiz von {from} |
| `intro.continue` | Weiter |
| `aria.prologue` | Vorspann |
| `aria.deskEvent` | Ereignis am Tisch |

## Nicht Teil dieses Auftrags

- Porträts und Bilder im Vorspann (kommen mit Claude Design).
- Bedingungen auf Merker oder frühere Entscheidungen (die Texte stimmen in jedem Spielverlauf).
- Kartei und erste Stufe des Metagames (Auftrag 08, wird im Chat vorbereitet).
- Darstellung der Ereigniskarte an Tag 9.

## Bericht

Pro Aufgabe: erledigt, offen, Abweichungen. Dazu die angepassten bestehenden Tests, die Lage des Overlays am Tisch und die Screenshots.
