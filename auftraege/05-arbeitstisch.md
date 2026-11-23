# Auftrag 05: Arbeitstisch zum Anfassen

Stand: 22.11.2026 · gehört zu SPEC 0.4.0, Abschnitte 4, 6.1a, 6.2, 7.1 bis 7.5, 9 und 11 · baut auf Auftrag 04 auf · Inhalte: `akt1.json` 0.3.2, `ui.json` 0.4.0, neu `kalender.json` 0.1.0

## Ziel

Der Schreibtisch wird vom Klickformular zum Ablauf mit den Händen, näher an Papers, Please: **Eingang → Unterlage → Stempel → Ausgangskorb**. Die Akte ist eine Mappe, die man auf die Unterlage zieht und aufschlägt. Die Unterlagen zieht man aus der Tasche, beim Schließen fliegen sie zurück. Stempel nimmt man aus dem Halter und drückt sie aufs Stempelfeld. Kodex, Kalender und Rechner liegen in einer Werkzeugleiste und werden auf die Unterlage gezogen. Neu ist der Tischkalender ab Tag 4.

Die Spiellogik (Bewertung, Folgeakten, Spielstand) ändert sich nicht. Neu in `core` sind nur Kalender und Ostersonntag.

**Vorlage:** `auftraege/05-prototyp-arbeitstisch.html` ist ein klickbarer Prototyp aus dem Chat (eine Datei, Vanilla JS). Dominik hat Aufbau, Größenverhältnisse und Verhalten so abgenommen. Er ist Referenz für Gefühl und Ablauf, nicht für den Code: Texte stehen dort im Code, Inhalte sind hart eingetragen, Tastaturwege fehlen teilweise.

## Vorab lesen

- `SPEC.md` 0.4.0: Änderungen am Anfang, Abschnitt 3 (Tischkalender, `unlock: calendar`, `meta.kalenderStart`), 4 (Spielablauf), 6.1, 6.1a, 6.2, 7 mit 7.1 bis 7.5, 9, 10 und 11.
- Den Prototyp im Browser öffnen und einmal durchspielen.

## Aufgaben in dieser Reihenfolge

Der Auftrag hat zwei Etappen. Nach Etappe A ist `main` spielbar und grün und kann gemergt werden. Etappe B baut darauf auf.

### Etappe A: Tischplan, Mappe, Werkzeuge, Kalender

#### A1. core: Kalender

- `src/core/calendar.ts` mit reinen Funktionen: `easterSunday(year)` (gregorianisch), `holidaysOfYear(calendarContent, year)` (Liste mit Datum und Name), `monthGrid(year, month)` (Wochen von Montag bis Sonntag, mit Leerfeldern), `daysBetween(a, b)` (Kalendertage, Reihenfolge egal).
- Schema und Loader für `content/kalender.json` (SPEC 3). Die Datei wird nicht mit den Akt-Dateien zusammengeführt. Fehler im Schema brechen den Start mit klarer Meldung ab.
- `ToolSchema` um `calendar` erweitern. `meta.kalenderStart` optional mit Format `JJJJ-MM`.
- Tests: Ostersonntag 2024 bis 2030, Feiertage 2026 (vollständige Liste aus `kalender.json` mit den Daten 1.1., 6.1., 6.4., 1.5., 14.5., 25.5., 4.6., 15.8., 26.10., 1.11., 8.12., 25.12., 26.12.), Karfreitag 3.4.2026 und 24.12.2026 sind keine Feiertage, `daysBetween` über Monats- und Jahreswechsel, Februar im Schaltjahr 2028, Monatsraster für Februar 2026 (beginnt Sonntag) und März 2026. Kaputte `kalender.json` (Monat 13, doppeltes Datum, leerer Name) als Loader-Test.

#### A2. Tischplan als Bühne (SPEC 7.1)

- Feste logische Größe, als Ganzes ins Fenster skaliert. Pointer-Koordinaten werden durch den Skalierungsfaktor geteilt (siehe `pt()` im Prototyp). Das Seitenverhältnis darfst du an 16:9-Bildschirme anpassen, wenn alle Flächen Platz haben. Bitte im Bericht nennen.
- Ablageflächen in einer Tabelle im Code (Name, Rechteck, was angenommen wird). Hit-Test beim Loslassen über diese Tabelle.
- Die vorhandene Ziehlogik aus `paper-interaction.ts` bleibt die Grundlage (Rand mit Drehung, Tastatur-Verschieben, Zoom). Erweitern um Ziehen zwischen Flächen, Umhängen eines Elements während des Ziehens (aus der Tasche auf die Bühne) und Zurückgleiten an den letzten gültigen Platz. Listener für `pointermove` und `pointerup` am `window`, nicht per Pointer Capture am Element, weil das Element beim Herausziehen den Elternknoten wechselt.
- Kein HTML-Drag-and-Drop (`draggable="true"`): schlecht auf Touch, Ziehbild nicht steuerbar.
- Meldungen (`ui.desk.oneAkteOnly` usw.) in einer Live-Region auf der Bühne.

#### A3. Akte als Mappe (SPEC 7.2)

- Eingang mit Stapel und Zähler, oberste Akte fokussierbar. Ziehen, Klick oder Enter öffnet sie auf der Unterlage.
- Mappe offen: Kopfleiste (verschiebt die Mappe), Prüfvermerk links mit allen bisherigen Teilen (Positionen, Entscheidungen, Betragsfelder, Markiermodus, Nachfrage) und Stempelfeld unten, Tasche rechts. Prüfvermerk scrollt in sich, Stempelfeld bleibt sichtbar. Bitte mit der längsten Akte von Akt I prüfen (meiste Entscheidungen) und im Bericht nennen, welche das war.
- Herausziehen und Zurücklegen nach SPEC 7.2, Klick auf ein Papier in der Tasche legt es an einen freien Platz (Kandidaten rechts, links, unter, über der Mappe, siehe `pullOut()` im Prototyp).
- Schließen: Papiere fliegen gestaffelt zurück, dann klappt der Deckel zu. Für das Zurückfliegen ist GSAP Flip erlaubt (SPEC 2), die Web Animations API genügt auch. Effekte „aus“: sofort.
- Markiermodus: nur Zeilen auf herausgezogenen Papieren sind anklickbar.

#### A4. Werkzeuge in der Leiste (SPEC 6.1, 6.1a, 7.4, 7.5)

- **Kodex am Tisch:** zugeklappt in der Leiste (Aussehen aus Auftrag 04), auf die Unterlage gezogen klappt er auf. Der Seitenumbruch aus Auftrag 04 läuft für die kleine Doppelseite eigens. Gemeinsame Leseposition mit dem Lesemodus über `codex.lastRuleId`. Schaltflächen `ui.codex.readMode` und `ui.desk.putBack`. Taste K öffnet und schließt den Lesemodus wie bisher. Das Aufklappen wie im Prototyp (Einband dreht sich um den Rücken).
- **Rechner:** zieht von seinem bisherigen Platz in die Leiste um, sonst unverändert.
- **Kalender:** nach SPEC 7.5. Monatsnamen und Wochentage über `Intl.DateTimeFormat('de-AT')`. Erscheint erst nach `unlock: calendar` (Tag 4) und zeigt an dem Tag `ui.intro.unlockCalendar`.
- Am Tagesende und nach dem Neuladen liegen alle Werkzeuge zugeklappt auf ihrem Platz.

### Etappe B: Stempel, Ablage, Tastatur, Feinschliff

#### B1. Stempel nehmen und aufdrücken (SPEC 7.3)

- Stempelhalter rechts mit den Stempeln des Tages. Aufnehmen, Stempel folgt dem Zeiger, Aufdrücken aufs Stempelfeld, Zurücklegen mit Escape, Rechtsklick, Klick daneben oder Klick auf den Halter.
- Nachfrage beim Ergänzungsersuchen nach SPEC 4: Auswahl erscheint beim Aufnehmen, Stempelfeld nimmt erst nach der Wahl an.
- Abdruck wie bisher, Wackeln der Mappe nur bei „voll“, kleiner Abdruck auf dem zugeklappten Deckel.

#### B2. Schließen und Ablegen (SPEC 7.2)

- Ziehen der zugeklappten, gestempelten Akte in den Ausgangskorb, oder Schaltfläche `ui.desk.outboxButton` am Deckel. Abweisen mit `ui.desk.stampFirst` und `ui.desk.closeFirst`.
- Erst nach dem Ablegen wird die nächste Akte im Eingang greifbar. Speichern wie bisher nach dem Stempeln (SPEC 9).

#### B3. Tastatur und Zugänglichkeit

- Tastaturweg für den ganzen Ablauf: Tab zum Eingang, Enter öffnet, Enter auf Papier in der Tasche zieht heraus, Entscheidungen wie bisher, Tab zum Stempel, Enter nimmt auf, Enter drückt auf, `ui.desk.closeAkte`, `ui.desk.outboxButton`. Fokus folgt sinnvoll (nach dem Öffnen auf den Prüfvermerk, nach dem Ablegen auf den Eingang).
- Zugängliche Namen nach `aria.*` (neu: `aria.inbox`, `aria.folder`, `aria.folderStamped`, `aria.calendar`, `aria.calendarDay`, `aria.calendarHoliday`).

#### B4. Ton und Animation

- Mappe auf und zu: Papierrascheln. Ablegen im Ausgangskorb: Ablageton. Stempel wie bisher. Keine neuen Klangdateien.
- Alle Animationen je Effekt-Einstellung: „voll“ wie im Prototyp, „reduziert“ Überblendung bis 120 ms, „aus“ sofort. Nur `transform` und `opacity`.

#### B5. Tests und Screenshots

- e2e-Durchspieltest von Akt I mit Maus-Ziehen und einer zweiten Fassung nur mit Tastatur (SPEC 11). Die bisherigen e2e-Tests auf den neuen Ablauf umstellen, in Chromium, Firefox und WebKit.
- Screenshots nach SPEC 10 (neue Ansichten für den Arbeitstisch) und selbst prüfen.

## Texte

- `content/ui.json` 0.4.0 bringt die neuen Schlüssel mit: `intro.unlockCalendar`, `desk.closeAkte`, `desk.pocket`, `desk.stampField`, `desk.oneAkteOnly`, `desk.closeFirst`, `desk.stampTaken`, `desk.alreadyStamped`, `desk.noOpenAkte`, `desk.putBack`, `codex.readMode`, der Bereich `calendar` und die genannten `aria`-Schlüssel. Geändert: `desk.stack` („Eingang ({count})“), `desk.emptyDesk`.
- Ausnahme wie in Auftrag 03 und 04: Fehlt dir ein Oberflächentext, darfst du den Schlüssel selbst in `ui.json` anlegen (Version 0.4.1, CHANGELOG-Zeile) und listest ihn im Bericht. Spieltexte und Inhalte änderst du nicht.
- Schlüssel, die durch den Umbau unbenutzt werden, nicht löschen, sondern im Bericht nennen. Der Chat entscheidet.

## Abnahme

Alle Kriterien in SPEC 11, besonders die sieben neuen zum Arbeitstisch. Dazu:

- [ ] Etappe A ist einzeln gemergt, `main` war danach grün und auf Pages spielbar.
- [ ] Der Prototyp und das Spiel fühlen sich beim Ziehen, Aufklappen und Zurückfliegen gleich an (Dominik prüft das selbst).
- [ ] Die Tagesbewertung ist für denselben Spielverlauf vor und nach dem Umbau identisch. Die Unit-Tests von `core` laufen unverändert durch.

## Bericht

Wie bisher: erledigt, offen, Abweichungen, neue oder unbenutzte `ui.json`-Schlüssel, gewähltes Seitenverhältnis der Bühne, längste Akte im Prüfvermerk, Screenshots.

## Nicht Teil dieses Auftrags

Lade mit Notizbuch, Pinnwand und Spuren, Begründung beim Stempel (Regel-ID per Ziehen aus dem Kodex ist eine Idee für später), Atmosphäre-Ebene (wird Auftrag 06), Fristen im Spielablauf, Sprung aus der Tagesauswertung in den Kodex, Story-Durchgang Akt I in `akt1.json`.
