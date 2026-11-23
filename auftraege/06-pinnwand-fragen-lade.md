# Auftrag 06: Pinnwand mit Fragen, Lade

Stand: 23.11.2026 · gehört zu SPEC 0.5.0, Abschnitte 3, 4, 5, 7.1, 7.6, 7.7, 9, 10, 11 und 12 · baut auf Auftrag 05 auf · Inhalte: `akt1.json` 0.3.4, `ui.json` 0.5.0, `kalender.json` 0.1.0 unverändert

Die Inhalte liegen auf dem Branch `auftrag-06-pinnwand`, weil der heutige Code `questions`, `keep` und die neuen `ui.json`-Schlüssel nicht kennt. Arbeite auf diesem Branch und merge erst, wenn alles grün ist.

## Ziel

Die Story von Akt I wird spielbar, ohne den Spieler zu überfordern. Vorbild ist das Case Board aus Alan Wake 2. Ab Tag 7 hängt eine Pinnwand am Tisch. Darauf stehen offene Fragen, zum Beispiel Sedlaks „Wer hat die 118 bekommen?“. Legt der Spieler eine Akte ab, in der eine passende Stelle steht, kommt diese Stelle als Hinweis in seine Hand. In der Pinnwand legt er den Hinweis auf die Frage, zu der er passt. Sind alle Hinweise einer Frage da, wird sie grün, die Antwort erscheint, und eine Folgefrage kann auftauchen. Falsch legen kostet nichts. Mit der Nadel kann der Spieler jede Zeile auch selbst in die Hand legen. Ab Tag 10 geht die Lade auf. Dazu kommt ein kleiner Baustein: Regel-IDs in der Tagesauswertung springen in den Kodex.

Bewertung, Folgeakten und Tagesablauf ändern sich nicht. Die Pinnwand erzeugt keine Fehler.

**Grundgerüst vor Story:** Die Story wird noch überarbeitet. Deshalb kennt der Code keine Figur, keinen Namen und keinen Story-Text. Wer fragt, was gefragt wird, welche Stellen antworten, wie viel schon vorgegeben ist (`given`), ob ein Hinweis von selbst kommt oder angeheftet werden muss (`source`) und wie die Antwort lautet, steht nur im JSON. Eine Story-Änderung darf nie eine Codeänderung brauchen.

**Vorlage:** `auftraege/06-prototyp-pinnwand.html` ist ein klickbarer Prototyp aus dem Chat (eine Datei, Vanilla JS, Fragen und Akten aus `akt1.json` eingebettet). Er ist Referenz für Ablauf und Gefühl, nicht für Aufbau, Lage am Tisch oder Code: Dort ist die Pinnwand ein Knopf in einer Kopfzeile und „Stempeln und ablegen“ ersetzt den echten Ablauf. Im Spiel hängt sie am Tisch (SPEC 7.1), und Hinweise kommen beim Ablegen im Ausgangskorb. Texte stehen dort im Code. Durchschläge fehlen im Prototyp.

## Vorab lesen

- `SPEC.md` 0.5.0: Änderungen am Anfang, Abschnitt 3 (Fragen, `note` mit `keep`, `provisional`), 4 (Anheften, Ablegen bringt Hinweise, Punkte 9 und 10), 5 (Sprung in den Kodex, keine Fehler), 7.1, 7.6, 7.7, 9, 10 (Inhaltsbericht), 11 (Block „Pinnwand mit Fragen und Lade“) und 12.
- `content/akt1.json`: `questions` an Tag 7 (q1, q2) und Tag 10 (q3), die beiden Zettel von Tag 10 mit `keep: "drawer"`. Die bisherigen `traces` sind entfernt.
- Den Prototyp im Browser einmal durchspielen: Tag 7, Akte 7-3 ablegen, Hinweis auf q1 ziehen, dann q2. Tag 10, Akte 10-4 ablegen, Stempel auf q3.

## Aufgaben in dieser Reihenfolge

### 1. core

- Schema: `questions` an Tagen (SPEC 3), `traces` entfällt. `keep: "drawer"` optional an `note`. `provisional: true` optional an jedem Story-Ereignis und jeder Frage. Alle Prüfungen aus SPEC 3.
- `src/core/board.ts` mit reinen Funktionen: sichtbare Fragen (Tag, `after`), Inhalt der Hand (aus abgelegten Akten, `auto` und `pin`, ohne Doppelte), Zuordnen mit Ergebnis passt oder passt nicht, beantwortete Fragen, Durchschläge aus dem Spielstand, Inhalt der Lade bis zu einem Tag.
- Spielstand um `board` erweitern (SPEC 9). Alte Spielstände bekommen eine leere Pinnwand. Einträge zu unbekannten Fragen oder Fundstellen fallen beim Laden weg.
- `npm run content:report` (SPEC 10).
- Tests nach SPEC 11, Block „Pinnwand mit Fragen und Lade“.

### 2. Tisch

- Pinnwand-Platz oben in der rechten Leiste mit Zahl neuer Hinweise und Marke, Lade-Griff an der Vorderkante (SPEC 7.1). Neue Zeilen in der Tabelle der Ablageflächen. Bitte Lage und Größen im Bericht nennen und die drei Fenstergrößen prüfen.
- Ablegen im Ausgangskorb löst `ui.pinboard.newClue` aus, wenn dadurch ein Hinweis in die Hand kommt.
- Anheften nach SPEC 4: Nadel an jeder Zeile herausgezogener Papiere beim Darüberfahren und bei Fokus, Klick auf den Kanzleistempel. Nicht in der Tasche, nicht im Markiermodus, nicht mit aufgenommenem Stempel. Achte darauf, dass die Nadeln die Tastaturbedienung nicht verlängern (zum Beispiel Taste N auf einer fokussierten Zeile statt einer eigenen Schaltfläche je Zeile in der Tab-Reihenfolge). Deine Lösung im Bericht beschreiben.
- Zum Tagesbeginn erscheint jede neue Frage ohne `after` als Zettel (`ui.pinboard.questionNotice` beziehungsweise `questionNoticeOwn`).
- Lade nach SPEC 7.7: klemmt bis Tag 10, danach Lade-Ansicht. `ui.drawer.stored` nach einem Zettel mit `keep`.

### 3. Pinnwand-Ansicht (SPEC 7.6)

- Dialog wie der Lesemodus: oben die Wand mit Fragen in Spalten nach `group`, unten die Hand, seitlich die Durchschläge nach Tag.
- Hand-Karten auf Fragen ziehen (Pointer Events, Listener am `window` wie am Tisch, die Karte folgt dem Zeiger, die Frage darunter hebt sich hervor). Ohne Ziehen: Karte wählen, dann Frage wählen, per Klick oder Enter, Escape hebt auf.
- Passt nicht: Frage wackelt (nur bei „voll“), Karte bleibt in der Hand. Passt: Karte hängt mit rotem Faden an der Frage. Beantwortet: grün mit Haken, Antwort daneben, Folgefrage erscheint.
- Die Lage an der Wand berechnet das Spiel. Sie wird nicht gespeichert, und der Spieler ordnet nichts selbst.

### 4. Sprung aus der Auswertung in den Kodex (SPEC 5)

- Regel-IDs in der Tagesauswertung als Schaltflächen, Lesemodus an der Regel, zurück mit Escape, Fokus zurück.

### 5. Tests und Screenshots

- Unit- und Loader-Tests nach SPEC 11.
- e2e kurz halten (SPEC 2). Jeder neue Test startet mit einem vorbereiteten Spielstand am passenden Tag, nicht mit einem Durchspiel. `@smoke` bekommt: q1 an Tag 7 lösen (7-3 ablegen, Hinweis auf q1 ziehen), Lade an Tag 10, Sprung in den Kodex. Zuordnen nur mit Tastatur, falsches Zuordnen und Anheften mit der Nadel dürfen eigene Tests ohne `@smoke` sein.
- Die beiden Durchspieltests (`@long`) bleiben, wie sie sind. Sie dürfen die Pinnwand ignorieren.
- Screenshots: Tisch an Tag 7 mit Pinnwand-Platz und neuer Frage als Zettel, Tisch an Tag 10 mit Lade-Griff, Pinnwand an Tag 7 vor dem Zuordnen (q1 mit Sedlaks Hinweis, ES-2025-118 in der Hand), beim Ziehen über q1, nach dem Lösen mit q2, Tag 10 mit allen drei Fragen beantwortet, Pinnwand mit offenem Durchschlag, Lade-Ansicht an Tag 10, Tagesauswertung mit Kodex im Lesemodus nach dem Sprung.

## Oberflächentexte

Die neuen Schlüssel stehen schon in `ui.json` 0.5.0: `intro.unlockPinboard`, `intro.unlockDrawer`, `evaluation.ruleJump`, die Bereiche `pinboard` und `drawer`, dazu `aria.pinboard`, `aria.pinCard`, `aria.question`, `aria.questionAnswered`, `aria.hand`, `aria.pinnableLine`, `aria.pinnableStamp`, `aria.drawer`, `aria.copy`. Wie bei Auftrag 03 bis 05 darfst du fehlende Schlüssel selbst anlegen und unbenutzte entfernen. Nenne beides im Bericht, mit CHANGELOG-Zeile und `ui.json` 0.5.1.

## Abnahmekriterien

- [ ] Alle Kriterien aus SPEC 11, Block „Pinnwand mit Fragen und Lade“.
- [ ] Alle bisherigen Abnahmekriterien bleiben erfüllt: Durchspieltests mit null Fehlern, Textliteral-Test, `ui.json`-Schlüssel vollständig verwendet, keine gesperrten Inhalte im DOM.
- [ ] CI grün in Chromium, Firefox und WebKit (`@smoke`), `@long` bei Push auf `main`.
- [ ] Bericht mit: erledigt, offen, Abweichungen, Lage von Pinnwand und Lade, Lösung für die Nadel per Tastatur, neue oder entfernte `ui.json`-Schlüssel.

## Nicht dabei

Kartei mit Suche, freie Fäden zwischen Karten, Personenkarten (Profiling), Metagame (Zeitbudget, Wirkung von `misses`, Ereigniskarte an Tag 9), eigener Aktenvermerk des Spielers, Begründung beim Stempel, Bedingungen für Story-Ereignisse, neue Fragen oder Akten, Atmosphäre (Auftrag 07).
