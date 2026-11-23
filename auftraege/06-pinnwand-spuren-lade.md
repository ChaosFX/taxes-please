# Auftrag 06: Pinnwand, Spuren, Lade

Stand: 23.11.2026 · gehört zu SPEC 0.5.0, Abschnitte 3, 4, 5, 7.1, 7.6, 7.7, 9 und 11 · baut auf Auftrag 05 auf · Inhalte: `akt1.json` 0.3.4, `ui.json` 0.5.0, `kalender.json` 0.1.0 unverändert

Die Inhalte liegen auf dem Branch `auftrag-06-pinnwand`, weil der heutige Code die neuen `ui.json`-Schlüssel nicht verwendet und `keep` noch nicht kennt. Arbeite auf diesem Branch und merge erst, wenn alles grün ist.

## Ziel

Die Story von Akt I wird spielbar statt nur erzählt, ohne den Spieler zu überfordern. Ab Tag 7 hängt eine Pinnwand am Tisch. Sedlak hat dort angefangene Spuren hinterlassen: eine Karte mit einer Frage und schon angeheftete Fundstellen. Der Spieler findet die fehlende Stelle in der Akte des Tages, ein Klick auf die Nadel heftet sie an, und der Faden verbindet sich von selbst. Dann hängt Sedlaks Zettel daneben. Spuren ohne Vorarbeit kann der Spieler selbst verbinden, indem er Karten aufeinanderzieht. Ein Faden hält nur zwischen Stellen derselben Spur. Ältere Akten liegen an der Pinnwand als Durchschlag.

**Grundgerüst vor Story:** Die Story wird noch überarbeitet. Deshalb kennt der Code keine Figur, keinen Namen und keinen Story-Text. Wer eine Karte schreibt, was darauf steht, wie viel Vorarbeit eine Spur hat und welche Texte vorläufig sind, steht nur im JSON. Eine Story-Änderung darf nie eine Codeänderung brauchen. Ab Tag 10 geht die Lade auf, darin bleiben Sedlaks Notizbuch und seine Beurteilung. Dazu kommt ein kleiner Baustein: Regel-IDs in der Tagesauswertung springen in den Kodex.

Bewertung, Folgeakten und Tagesablauf ändern sich nicht. Pinnwand und Spuren erzeugen keine Fehler.

**Vorlage:** `auftraege/06-prototyp-pinnwand.html` ist ein klickbarer Prototyp aus dem Chat (eine Datei, Vanilla JS, Daten aus `akt1.json` eingebettet, Vorarbeit dort noch hart eingetragen). Er ist Referenz für Ablauf und Gefühl, nicht für Aufbau, Lage am Tisch oder Code: Dort ist die Pinnwand ein Knopf in einer Kopfzeile, im Spiel hängt sie am Tisch (SPEC 7.1). Texte stehen dort im Code. Die Kartei mit Suche im Prototyp gehört **nicht** zu diesem Auftrag.

## Vorab lesen

- `SPEC.md` 0.5.0: Änderungen am Anfang, Abschnitt 3 (Story-Ereignisse `note` mit `keep`, `unlock`, Spuren), 4 (Anheften, Punkte 9 und 10), 5 (Sprung in den Kodex, keine Fehler), 7.1, 7.6, 7.7, 9, 11 (neuer Block „Pinnwand, Spuren, Lade“) und 12.
- `content/akt1.json`: Spuren `t1` (Tag 7) und `t2` (Tag 10) mit `seed`, die beiden Zettel von Tag 10 mit `keep: "drawer"`.
- Den Prototyp im Browser öffnen: Spieltag 7, Akte 7-3, Nadel an der Rechnungsnummer. Dann Spieltag 10, Akte 10-4, Klick auf den Kanzleistempel.

## Aufgaben in dieser Reihenfolge

### 1. core

- Schema: `keep: "drawer"` optional an `note`, `provisional: true` optional an jedem Story-Ereignis, an `seed` und an `reward`, `seed` an Spuren. Die Spur-Prüfungen aus SPEC 3 (Akte spätestens am Tag der Spur, `field` nur `representative` mit sichtbarem Stempel, eindeutige IDs, Pinnwand vorher freigeschaltet, `keep` erst nach der Lade, `seed.links` gültig und Akten der Vorarbeit vor dem Tag der Spur).
- `src/core/pinboard.ts` mit reinen Funktionen: Schlüssel einer Fundstelle (`ref`), Spuren einer Fundstelle, `threadHolds(content, a, b)`, `solvedTraces(content, cards, threads, day)`, Durchschläge aus dem Spielstand (abgelegte Akten und Folgeakten nach Tag), Inhalt der Lade bis zu einem Tag.
- Spielstand um `pinboard` erweitern (SPEC 9): Karten mit Lage, Fäden, `solved`, `seenSolved`, `misses`. Alte Spielstände bekommen eine leere Pinnwand. Karten mit unbekannter Fundstelle fallen beim Laden weg.
- Vorarbeit: zu Beginn des Tages einer Spur die Karten aus `seed.links` anlegen (falls noch nicht angeheftet) und untereinander verbinden. Beim Anheften einer weiteren Fundstelle derselben Spur selbsttätig mit der Vorarbeit verbinden (reine Funktion, getestet).
- Eine gelöste Spur bleibt gelöst. Ist sie vor ihrem Tag verbunden, wird sie zu Beginn ihres Tages gelöst.
- `npm run content:report` (SPEC 10): Tage, Akten, Regeln, Spuren und alle Texte mit `provisional: true`.
- Tests nach SPEC 11, Block „Pinnwand, Spuren, Lade“.

### 2. Tisch

- Pinnwand-Platz oben in der rechten Leiste, Lade-Griff an der Vorderkante (SPEC 7.1). Neue Zeilen in der Tabelle der Ablageflächen. Bitte Lage und Größen im Bericht nennen und die drei Fenstergrößen prüfen.
- Anheften nach SPEC 4: Nadel an jeder Zeile herausgezogener Papiere beim Darüberfahren und bei Fokus, Klick auf den Kanzleistempel. Nicht in der Tasche, nicht im Markiermodus, nicht mit aufgenommenem Stempel. Die Karte fliegt kurz zur Korkfläche. Achte darauf, dass die Nadeln die Tastaturbedienung nicht verlängern (zum Beispiel eine Nadel je Papier, die mit Pfeiltasten durch die Zeilen geht, oder Taste N auf einer fokussierten Zeile). Deine Lösung im Bericht beschreiben.
- Zum Tagesbeginn erscheint die Karte einer Vorarbeit als Zettel (`ui.pinboard.seedNotice`).
- Lade nach SPEC 7.7: klemmt bis Tag 10, danach Lade-Ansicht. `ui.drawer.stored` nach einem Zettel mit `keep`.

### 3. Pinnwand-Ansicht (SPEC 7.6)

- Dialog wie der Lesemodus: links die erledigten Akten nach Tag, daneben die Korkwand. Durchschlag öffnet sich neben der Wand, seine Zeilen haben Nadeln wie am Tisch.
- Karten ziehen (Pointer Events, Listener am `window` wie am Tisch), mit Pfeiltasten verschieben, nicht über den Rand. Eine Karte auf eine andere ziehen spannt einen Faden. Fäden als SVG-Linie von Nadel zu Nadel, sie folgen beim Ziehen.
- Vorarbeit: Karte der Figur mit losem Faden, eine Zeile je Spur an der Wand.
- Faden starten, Ziel wählen, halten oder herunterfallen. Fäden lösen, Karte abnehmen.
- Gelöste Spur: Zettel unter den Karten der Spur, Überschrift `ui.pinboard.solved`, Meldung, Marke `ui.pinboard.new` am Tisch bis zum nächsten Öffnen.

### 4. Sprung aus der Auswertung in den Kodex (SPEC 5)

- Regel-IDs in der Tagesauswertung als Schaltflächen, Lesemodus an der Regel, zurück mit Escape, Fokus zurück.

### 5. Tests und Screenshots

- Unit- und Loader-Tests nach SPEC 11.
- e2e kurz halten (SPEC 2). Jeder neue Test startet mit einem vorbereiteten Spielstand am passenden Tag, nicht mit einem Durchspiel. `@smoke` bekommt: Spur t1 an Tag 7 mit einem Klick lösen, Lade an Tag 10, Sprung in den Kodex. Der Tastaturweg für Anheften und Faden und das freie Verbinden ohne Vorarbeit dürfen eigene Tests ohne `@smoke` sein.
- Die beiden Durchspieltests (`@long`) bleiben, wie sie sind. Sie dürfen die Pinnwand ignorieren.
- Screenshots: Tisch an Tag 7 mit Pinnwand-Platz, Tisch an Tag 10 mit Lade-Griff, Pinnwand-Ansicht mit offenem Durchschlag und sichtbarer Nadel, Tag 7 mit Sedlaks Vorarbeit vor dem Lösen, Pinnwand mit gelöster Spur t1 und herunterfallendem Faden (Standbild), Spur t2 mit drei Karten, Lade-Ansicht an Tag 10, Tagesauswertung mit Kodex im Lesemodus nach dem Sprung.

## Oberflächentexte

Die neuen Schlüssel stehen schon in `ui.json` 0.5.0: `intro.unlockPinboard`, `intro.unlockDrawer`, `evaluation.ruleJump`, die Bereiche `pinboard` (mit `seedFrom`, `seedPinned`, `seedNotice`, `seedJoined` für die Vorarbeit) und `drawer`, dazu `aria.pinboard`, `aria.pinboardWall`, `aria.pinCard`, `aria.thread`, `aria.pinnableLine`, `aria.pinnableStamp`, `aria.drawer`, `aria.copy`. Wie bei Auftrag 03 bis 05 darfst du fehlende Schlüssel selbst anlegen und unbenutzte entfernen. Nenne beides im Bericht, mit CHANGELOG-Zeile und `ui.json` 0.5.1.

## Abnahmekriterien

- [ ] Alle Kriterien aus SPEC 11, Block „Pinnwand, Spuren, Lade“.
- [ ] Alle bisherigen Abnahmekriterien bleiben erfüllt: Durchspieltests mit null Fehlern, Textliteral-Test, `ui.json`-Schlüssel vollständig verwendet, keine gesperrten Inhalte im DOM.
- [ ] CI grün in Chromium, Firefox und WebKit (`@smoke`), `@long` bei Push auf `main`.
- [ ] Bericht mit: erledigt, offen, Abweichungen, Lage von Pinnwand und Lade, neue oder entfernte `ui.json`-Schlüssel.

## Nicht dabei

Kartei mit Suche (kommt mit Akt II), Metagame (Zeitbudget, Wirkung von `misses`, Ereigniskarte an Tag 9), eigener Aktenvermerk des Spielers, Begründung beim Stempel, Bedingungen für Story-Ereignisse, neue Spuren oder Akten, Atmosphäre (Auftrag 07).
