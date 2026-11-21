# Auftrag 03: Akt I komplett (Tag 4 bis 10)

Stand: 21.11.2026 · Grundlage: `SPEC.md` 0.3.0 · Inhalte: `content/akt1-tag1-3.json` 0.2.0, `content/akt1-tag4-10.json` 0.1.0, `content/ui.json` 0.2.0

## Ziel

Akt I ist von Tag 1 bis Tag 10 spielbar. Dafür kommen der neue Akten-Typ `entscheidungen` mit Betragsfeldern, das Markieren von Widersprüchen, die Nachfrage mit Auswahl, die neuen Story-Ereignisse (Morgenzeitung, Anruf, Freischaltung, Akt-Abschluss), der Tischrechner und Hinweisregeln im Kodex dazu. Pinnwand, Lade und Metagame sind nur als Daten da und werden geprüft, aber nicht dargestellt.

## Wichtig: Branch

Die neuen Inhalte liegen auf dem Branch `inhalt/akt1-tag4-10`, nicht auf `main`. Grund: Der jetzige Loader liest alle `content/*.json`. Mit den neuen Dateien auf `main` würden Tests und Pages-Deploy brechen, bis dieser Auftrag umgesetzt ist.

1. `git fetch`, dann auf `inhalt/akt1-tag4-10` arbeiten (oder einen eigenen Branch davon abzweigen).
2. Erst wenn alle Abnahmekriterien grün sind, nach `main` mergen. Dann läuft der Deploy mit Akt I.

## Betroffene Dateien

- Lesen, nicht ändern: `SPEC.md`, `content/akt1-tag1-3.json`, `content/akt1-tag4-10.json`.
- `content/ui.json`: nur nach der Ausnahme unten.
- Ändern: `src/core` (Schema, Loader, Bewertung, Spielablauf, Rechner, Spielstand), `src/ui`, `src/audio`, `tests/`, `public/audio/QUELLEN.md`, gegebenenfalls Schriftdateien und deren Lizenz.
- `CHANGELOG.md`: Eintrag zur Umsetzung, und je ein Eintrag, falls du `ui.json` nach der Ausnahme ergänzt.

## Ausnahme für `ui.json`

Die neuen Oberflächentexte sind schon in `ui.json` 0.2.0 vorgeschlagen (Bereiche `desk`, `intro`, `calculator`, `codex`, `evaluation`, `aria`, `end`). Brauchst du für die neuen Teile einen weiteren Schlüssel, darfst du ihn in diesem Auftrag selbst in `ui.json` anlegen, mit einem kurzen deutschen Text, und erhöhst die Version auf 0.2.1. Jeden so angelegten oder geänderten Schlüssel listest du im Bericht mit Text auf. Der Chat prüft die Texte danach. Bestehende Schlüssel außerhalb der neuen Teile änderst du nicht, Schlüssel, die du nicht brauchst, meldest du.

## Aufgaben

### 1. Schema und Loader (`src/core`)
- Schema für `entscheidungen` (Auswahl mit Optionen als Zeichenkette oder `{value, label}`, `correct` inklusive `offen`; Betrag mit `answerType: "amount"`), `discrepancies`, `inquiry`, `variantOf`, `followUp.decisions`, `taxpayer.job` optional, `Rule.hint`, `Day.traces` und alle Story-Typen aus SPEC Abschnitt 3.
- Zusammenführen der Dateien wie in SPEC Abschnitt 3, auch `texts` mit Konfliktprüfung. Heute wird `texts` nur aus der ersten Datei genommen, das reicht nicht mehr.
- Alle Querprüfungen aus SPEC Abschnitt 3 mit klaren Fehlermeldungen (Akte, Entscheidung, Dokument, Zeile benennen).

### 2. Bewertung (`src/core`)
- Betragsvergleich in ganzen Cent, Einlesen der Eingabe als reine Funktion.
- Widersprüche und Nachfrage nach SPEC Abschnitt 5.
- `offen` bei `entscheidungen` wie bei Positionen.
- Die Auswertungsdaten enthalten alles, was die Tagesauswertung zeigen soll (eingegebener Betrag, Markierungen, gewählte Frage).

### 3. Spielablauf und Spielstand (`src/core`)
- Tag 4 bis 10 aus der zweiten Datei, Folgeakten an Tag 5, 6, 7, 8 und 10, auch für `entscheidungen`.
- Werkzeuge nach `unlock` (in dieser Version nur `calculator` sichtbar), im Spielstand gespeichert.
- `actSummary` nach Tag 10, der Schlussbildschirm „Ende des Prototyps“ nach Tag 4 entfällt.
- Übernahme von Spielständen aus 0.2 (SPEC Abschnitt 9), mit Test.

### 4. Oberfläche (`src/ui`)
- Prüfvermerk für `entscheidungen`: Zeilen mit Optionsschaltern oder Betragsfeld, `amount` als Betrag in der Zeile, wenn vorhanden.
- Markiermodus, Markierungen auf Papier und im Prüfvermerk, aufheben, Tastaturbedienung.
- Nachfrage-Auswahl vor dem Ergänzungsersuchen.
- Morgenzeitung, Anruf (mit Klingelton), Tischrechner.
- Kodex: Kennzeichnung der Hinweisregeln, Lesezeichen und Suche bei 54 Regeln.
- Kopf ohne Beruf (`ui.desk.akteNoJob`), Fächern von bis zu sechs Papieren.
- Tagesauswertung mit den neuen Angaben, Schlussbildschirm „Ende von Akt {act}“.

### 5. Tests
- Unit-Tests für Schema, Zusammenführen, jede neue Querprüfung (je ein kaputtes Beispiel), Bewertung, Betragseingabe, Rechner, Spielstand-Übernahme.
- e2e: Akt I richtig durchspielen ergibt null Fehler an allen zehn Tagen. Dazu je ein e2e-Test mit falschem Betrag, vergessener Markierung und falscher Nachfrage, die genau einen Fehler mit dem richtigen Text erzeugen.
- Bestehende Tests für Tag 4 als Leertag und „Ende des Prototyps“ anpassen oder ersetzen.
- Screenshots laut SPEC Abschnitt 10 und selbst prüfen.

## Nicht in diesem Auftrag

Pinnwand und Spuren (Darstellung), Lade und Notizbuch, Ereigniskarte und Merker des Metagames, Begründung beim Stempel, Bedingungen für Story-Ereignisse, Kalender, Three.js. Ereignisse vom Typ `unlock` mit `pinboard` oder `drawer` sowie `event` werden geladen und geprüft, aber nicht angezeigt. Story-Ereignisse vom Typ `note` mit `title` werden wie Zettel angezeigt, mit Überschrift.

## Abnahmekriterien

- [ ] Alle Abnahmekriterien aus `SPEC.md` 0.3.0, Abschnitt 11, sind erfüllt.
- [ ] Der Loader lädt die drei Dateien ohne Fehler und meldet bei jedem Testfehler die betroffene Stelle.
- [ ] Unit-Tests und e2e-Tests sind grün, der Build läuft, der Pages-Deploy nach dem Merge auf `main` ist erfolgreich.
- [ ] Die Screenshots aus SPEC Abschnitt 10 liegen im Bericht oder im Artefakt-Ordner des Workflows.
- [ ] `CHANGELOG.md` ist ergänzt.

## Bericht

Wie bisher: erledigt, offen, Abweichungen. Dazu:
- jeder Inhaltsfehler, der dir im JSON auffällt (Akte, Entscheidung, was nicht passt),
- jeder neu angelegte oder geänderte Schlüssel in `ui.json` mit Text,
- Entscheidungen, die die SPEC offen lässt und die du treffen musstest (zum Beispiel Darstellung der Markierungen),
- Quellen und Lizenzen neuer Schriften und Klänge.
