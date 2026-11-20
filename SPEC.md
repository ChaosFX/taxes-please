# Taxes Please – Spezifikation Prototyp (Tag 1 bis 4)

Stand: 20.11.2026 · Version 0.2.2 · passt zu `content/akt1-tag1-3.json` Version 0.1.1 und `content/ui.json` Version 0.1.0

Ein Lernspiel im Stil von Papers Please: Der Spieler sitzt als Sachbearbeiter in einem fiktiven Wiener Finanzamt, prüft Papierakten nach einem Steuerrechts-Kodex, der täglich wächst, und stempelt Entscheidungen. Ziel ist, österreichisches Steuerrecht für die Dienstprüfung zu lernen und anderen zu vermitteln.

Dieser Prototyp umfasst drei Spieltage mit 11 Akten und 7 Kodexregeln sowie einen kurzen Tag 4 für die Folgeakte. Inhalt und Lösungen stehen in `content/akt1-tag1-3.json`. Die Rahmenhandlung liegt in einem separaten Dokument und ist für den Prototyp nur in Form der Story-Ereignisse im JSON relevant.

Änderungen gegenüber 0.2.1: Loader- und Fehlermeldungen für Inhaltsautoren sind von der Textregel ausgenommen (Abschnitt 1 und 3). Es gibt keinen eigenen Ton-Schalter, Lautstärke 0 bedeutet aus (Abschnitt 7 und 9).

Änderungen gegenüber 0.2: Oberflächentexte liegen in `content/ui.json` (Abschnitt 3), Musik, Pfeiltasten und Escape-Zoom sind aufgenommen (Abschnitt 7), `Settings.music` ist Teil des Spielstands (Abschnitt 9), die Abnahmekriterien sind um Texte, Rand und GitHub Pages erweitert (Abschnitt 11).

## 1. Grundsätze

1. **Rechtliche Korrektheit vor Optik.** Die Spiellogik entscheidet ausschließlich anhand der Daten im JSON. Keine Steuerregel wird im Code nachgebaut oder geraten.
2. **Alles, was gelesen oder angeklickt wird, ist HTML/CSS.** Akten, Kodex, Stempel und Auswertung sind DOM-Elemente. Kein Text in Canvas oder WebGL.
3. **Logik und Darstellung sind getrennt.** `src/core` ist reines TypeScript ohne DOM-Zugriff und vollständig getestet. `src/ui` liest nur den Zustand aus `core` und ruft dessen Aktionen auf.
4. **Inhalte sind Daten.** Neue Tage und Fälle entstehen durch neue JSON-Dateien, nicht durch Code. Das gilt für alle Texte, die ein Spieler liest oder die ein Screenreader vorliest: Spieltexte (Ermahnung, Anzeigenamen) stehen in `texts` der Inhaltsdatei, Oberflächentexte (Beschriftungen, Hinweise, aria-Labels) in `content/ui.json`. Im Code stehen nur Schlüssel. **Ausnahme:** Meldungen des Loaders und andere Fehlermeldungen, die sich an Autoren der JSON-Dateien richten, bleiben im Code, weil sie auch lesbar sein müssen, wenn `ui.json` selbst fehlerhaft ist. Die Überschrift des Fehlerbildschirms kommt aus `ui.json`. Die Ausnahmen stehen in der begründeten Liste des Textliteral-Tests (Abschnitt 11).
5. **Fiktion.** Alle Personen und Firmen sind erfunden. Ein Startbildschirm weist darauf hin, dass Kodextexte vereinfacht sind und keine Rechtsauskunft darstellen.

## 2. Technischer Rahmen

- Vite mit TypeScript (strict), kein UI-Framework. Eine kleine eigene Render-Schicht genügt.
- GSAP für Animationen ist erlaubt, ebenso reine CSS-Transitions. Kein Three.js im Prototyp; die Atmosphäre-Ebene (Abschnitt 8) bleibt als leeres Modul vorbereitet.
- Vitest für Unit-Tests von `core` und für die Inhaltsvalidierung.
- Playwright für Screenshots der Hauptansichten (siehe Abschnitt 10) und für die e2e-Tests.
- Spielstand in `localStorage`, Zugriffe in `try/catch` gekapselt.
- Build als statische Seite, Veröffentlichung über GitHub Pages (Projektseite unter einem Unterpfad, daher relativer `base` in Vite).
- Sprache der Oberfläche: Deutsch (Österreich). Beträge im Format `1.200,00 €`.

### Ordnerstruktur

```
src/
  core/        Typen, Zustand, Regeln laden, Bewertung, Tagesablauf, Speichern
  ui/          Schreibtisch, Papiere, Kodex, Stempel, Auswertung, Startbildschirm
  ui/atmosphere/  vorbereitetes Modul für Licht und Partikel (im Prototyp: Stub)
  audio/       Soundeffekte und Musik (Abschnitt 7)
content/       JSON-Inhalte (eine Datei pro Abschnitt) und ui.json
public/audio/  Klangdateien mit QUELLEN.md
tools/music/   Skripte, die die Musik synthetisch erzeugen
tests/         Vitest und Playwright
```

## 3. Datenmodell

Die Typen folgen exakt dem JSON in `content/akt1-tag1-3.json`.

- `texts`: Spieltexte, die nicht im Code stehen dürfen.
  - `optionLabels`: Anzeigename je Option einer `steuerpflicht`-Entscheidung (Schlüssel = Optionswert).
  - `stampLabels`: Anzeigename je Stempel.
  - `unnecessaryDelay`: Text für den Fehler „Ergänzungsersuchen bei vollständiger Akte“.
  - `warning`: `minErrors`, `from`, `text` der Ermahnung.
  - `emptyDay`: Text für einen Tag ohne Akten.
- `Rule`: `id`, `day` (ab welchem Tag freigeschaltet), `title`, `text`, `source`, `sourceUrl`.
- `Day`: `day`, `intro`, `stamps` (verfügbare Stempel), `cases` (IDs in Reihenfolge, darf leer sein), `storyEvents`.
- `Case`:
  - `type`: `werbungskosten` (Positionen einzeln entscheiden) oder `steuerpflicht` (eine Entscheidung mit Optionen).
  - `taxpayer`, optional `representative` mit sichtbarem Kanzleistempel.
  - `documents`: Liste von Papieren (`kind`: `erklaerung` oder `beleg`, `title`, `lines` als Label-Wert-Paare, optional `stamp`).
  - `positions` mit `correct` aus `anerkennen`, `streichen` oder `offen`, oder `decision` mit `options` und `correct`.
  - `correctStamp`: `bescheid` oder `ergaenzung`.
  - optional `followUp`: Unterlagen, die an einem späteren Tag als neue Akte eintreffen, mit eigener Lösung.
  - optional `story: true` für Story-Akten.

Ein Loader prüft das JSON beim Start mit einem Schema (zum Beispiel zod) und bricht mit einer klaren Fehlermeldung ab, wenn etwas fehlt. Das Schema prüft auch, dass jeder Schlüssel in `optionLabels` und `stampLabels` zu den vorkommenden Optionen und Stempeln passt.

### Oberflächentexte (`content/ui.json`)

- Eigene Datei mit eigener Versionsnummer, unabhängig von den Akt-Dateien, weil die Texte an keinem Spieltag hängen.
- Aufbau: ein flaches, nach Bereichen gegliedertes Objekt, zum Beispiel `settings`, `desk`, `codex`, `evaluation`, `title`, `end`, `aria`. Jeder Eintrag ist ein String. Platzhalter stehen als `{name}`, zum Beispiel `„Tag {day}“`.
- Der Code greift über eine typisierte Funktion `t("bereich.schluessel", { name: wert })` zu. Der Schlüsselraum ist als Typ abgeleitet, ein unbekannter Schlüssel ist ein Kompilierfehler.
- Der Loader prüft `ui.json` mit einem Schema. Fehlt ein Schlüssel oder ist einer zu viel, bricht der Start mit einer klaren Fehlermeldung ab.
- Leerzeichen am Anfang oder Ende eines Textes (zum Beispiel in Satzteilen der Auswertung) gehören zur Darstellung und bleiben erhalten.
- `ui.json` enthält keine Rechtsaussagen. Kodextexte, Regeln und Erklärungen bleiben in den Inhaltsdateien.
- Das Betragsformat (`1.200,00 €`) bleibt im Code.

## 4. Spielablauf

1. **Startbildschirm:** Titel, Hinweis auf Fiktion und Vereinfachung, Buttons „Neues Spiel“ und „Fortsetzen“.
2. **Tagesbeginn:** Karte mit „Tag N“ und `intro`-Text. Ein Datum im Spiel gibt es nicht (Fristen und Kalender sind nicht Teil des Prototyps). Danach Story-Ereignisse des Tages (Zettel, Dialog) als Papier oder Sprechblase.
3. **Schreibtisch:** Links der Kodex, in der Mitte die Arbeitsfläche, rechts Stempel und Ausgangskorb. Oben ein Akten-Stapel mit Zähler.
4. **Akte bearbeiten:**
   - Klick auf den Stapel legt die nächste Akte auf den Tisch. Die Dokumente erscheinen als einzelne Papiere, die gezogen werden können.
   - Ein Entscheidungsblatt („Prüfvermerk“) listet die Positionen mit je zwei Schaltern „anerkennen“ und „streichen“, bei `steuerpflicht` die Optionen (Anzeigenamen aus `texts.optionLabels`).
   - Bei Positionen, die laut Daten `offen` sind, ist keine der beiden Schaltflächen richtig. Der Spieler soll stattdessen das Ergänzungsersuchen stempeln. Die Bewertung behandelt eine nicht entschiedene Position in diesem Fall als korrekt.
   - Der Spieler stempelt die Akte mit einem der verfügbaren Stempel und legt sie in den Ausgangskorb. Erst dann kommt die nächste Akte.
   - Der Stempel ist endgültig. Nach dem Stempeln lässt sich der Prüfvermerk nicht mehr ändern.
5. **Tagesende:** Wenn der Stapel leer ist, erscheint die Auswertung.
6. **Folgeakten:** Eine Akte mit `followUp` kommt am angegebenen Tag zusätzlich in den Stapel, aber nur wenn der Spieler das Ergänzungsersuchen gestempelt hat. Hat er stattdessen einen Bescheid erlassen, kommt sie nicht (der Fehler wurde bereits gezählt).
7. **Tag 4:** Tag 4 steht als eigener Eintrag mit `cases: []` im JSON. Sein Stapel besteht nur aus den Folgeakten, die für ihn anstehen. Ist der Stapel leer, zeigt das Spiel `texts.emptyDay` und geht direkt zur Auswertung. Nach der Auswertung von Tag 4 erscheint ein Schlussbildschirm „Ende des Prototyps“.

## 5. Bewertung und Auswertung

- Jede falsch entschiedene Position, jede falsche Option und jeder falsche Stempel zählt als ein Fehler.
- Eine Position, die nicht entschieden wurde, obwohl sie laut Daten nicht `offen` ist, zählt als falsch entschieden.
- Ein Ergänzungsersuchen bei einer vollständigen Akte zählt als Fehler mit dem Text `texts.unnecessaryDelay`.
- Die Tagesauswertung zeigt pro Akte: richtig oder falsch, die richtige Lösung, die `explanation` und die verlinkten Kodexregeln mit Fundstelle.
- Ab `texts.warning.minErrors` Fehlern an einem Tag erscheint die Ermahnung (`from`, `text`). Im Prototyp hat das keine weiteren Folgen.
- Die Bewertung ist eine reine Funktion in `core` und vollständig getestet.

## 6. Kodex

- Ein Buch, das sich per Klick auf- und zuklappen lässt. Lesezeichen nach Tagen.
- Nur Regeln mit `day` kleiner oder gleich dem aktuellen Tag sind lesbar. Spätere Seiten sind als gesperrt sichtbar („ab Tag 5“), aber ohne Inhalt.
- Neue Regeln eines Tages sind als „neu“ markiert.
- Volltextsuche über Titel und Text der freigeschalteten Regeln.
- Jede Regel zeigt den Hinweis „vereinfacht“ und die Fundstelle mit Link.

## 7. Schreibtisch, Optik und Gefühl

Referenz ist der HTML-Prototyp aus der Konzeptphase: Holztisch, grüne Schreibunterlage, Papiere in leicht gebrochenem Weiß mit Schreibmaschinenschrift (Courier Prime, OFL, lokal eingebunden).

- **Ziehen:** Pointer Events für Maus und Touch. Beim Aufnehmen leicht vergrößern, Schatten weicher und länger, Neigung je nach Zugrichtung. Beim Loslassen kurze Ablege-Animation. Das zuletzt angefasste Papier liegt oben. Nur `transform` animieren. Ein Papier lässt sich nie so weit ablegen, dass ein Teil seiner Fläche, auch gedreht, vom Rand der Unterlage abgeschnitten wird.
- **Ziehen per Tastatur:** Ein fokussiertes Papier lässt sich mit den Pfeiltasten verschieben. Ziehen ist für keine Entscheidung nötig.
- **Papier:** feine Papierstruktur (SVG-Rauschfilter oder kleine Textur), zufällige Drehung von ein bis zwei Grad, Büroklammern bei Belegen.
- **Stempel:** Aufschlag mit kurzer Skalierungs-Animation und leichtem Wackeln der Arbeitsfläche (nur bei „voll“). Der Abdruck bleibt auf dem Prüfvermerk sichtbar.
- **Kanzleistempel:** Dokumente mit `stamp` zeigen unten links einen blassen Kanzleistempel. Das ist der Story-Hinweis von Tag 2.
- **Lesbarkeit:** Doppelklick auf ein Papier oder Enter beziehungsweise Leertaste bei Fokus zoomt es lesbar heran. Erneuter Doppelklick oder Escape legt es zurück.
- **Sound:** Stempel (3 Varianten), Papierrascheln (2), Ablage (2, auch beim Ausgangskorb) und leises Büro-Ambiente. Alle Klangdateien sind CC0 (Freesound), Quellen und Bearbeitungen stehen in `public/audio/QUELLEN.md`. Ton startet erst nach der ersten Nutzeraktion. Fällt der Ton aus, läuft das Spiel unverändert weiter.
- **Musik (Akt 1):** Ein eigenes, synthetisch erzeugtes 16-Bit-Arrangement des Walzers Nr. 1 aus „G'schichten aus dem Wienerwald“ von Johann Strauß (Sohn, gemeinfrei) als nahtlose Schleife. Das Arrangement entsteht aus eigener Notation mit `tools/music/wienerwald16-loop.mjs`, nicht aus einer Aufnahme oder einer geschützten Notenausgabe. Die Musik hat einen eigenen Lautstärkeregler (Standard 0,5, 0 ist aus), getrennt vom Regler für die Effekte. Bei 0 wird sie weder geladen noch dekodiert; wird sie dabei abgeschaltet, blendet sie in 80 ms aus, und beim Wiedereinschalten setzt sie an derselben Stelle fort. Für spätere Akte ist ein eigenes Stück je Akt vorgesehen. Jede Musikquelle steht in `QUELLEN.md`.
- **Einstellungen:** Effekte aus, reduziert oder voll. `prefers-reduced-motion` setzt automatisch „reduziert“. Dazu Lautstärke (Soundeffekte) und Musiklautstärke. Einen eigenen Ton-an/aus-Schalter gibt es nicht: Lautstärke 0 und Musik 0 bedeuten aus.
- **Bedienbarkeit ohne Maus:** Alle Entscheidungen und Stempel sind per Tastatur erreichbar. Fokus ist sichtbar.

## 8. Atmosphäre (vorbereitet, nicht im Prototyp)

`src/ui/atmosphere` exportiert `mount(container)` und `setQuality(level)`. Im Prototyp ist das ein Stub. Später kommt hier eine Ebene über dem Tisch mit `pointer-events: none` dazu, zuerst in leichter Form (CSS-Lichtkegel, 2D-Staub), danach optional Three.js. Das Spiel muss ohne diese Ebene vollständig funktionieren.

## 9. Speichern

- Automatisches Speichern nach jeder gestempelten Akte und am Tagesende.
- Gespeichert werden: aktueller Tag, Ergebnisse je Akte, Fehler je Tag, offene Folgeakten, Einstellungen.
- Die Einstellungen sind `effects` (aus, reduziert, voll), Lautstärke (0 = aus) und `music` (Musiklautstärke, Standard 0,5, 0 = aus). Ein älterer Spielstand ohne einzelne Felder bekommt für diese die Standardwerte aus `DEFAULT_SETTINGS`, ohne dass der übrige Spielstand verloren geht. Ein Test deckt das ab.
- „Neues Spiel“ fragt vor dem Überschreiben nach.

## 10. Arbeitsweise für Claude Code

1. Zuerst `core` mit Typen, Loader, Schema-Validierung und Bewertung, inklusive Tests.
2. Dann eine schlichte, voll spielbare Oberfläche ohne Animationen.
3. Danach Optik und Gefühl nach Abschnitt 7.
4. Nach jedem Oberflächen-Schritt Screenshots mit Playwright erstellen (Startbildschirm, Schreibtisch mit offener Akte, Kodex offen, Tagesauswertung) und selbst prüfen: Ist der Text lesbar, überlappt nichts, sind alle Bedienelemente sichtbar?
5. Inhalte nie im Code ändern. Fällt ein Fehler im JSON auf, im Bericht melden statt stillschweigend anzupassen. Fehlt ein Spieltext oder ein Oberflächentext im JSON, ebenfalls melden und nicht im Code erfinden.
6. Änderungen an `src/core`, die ein Auftrag nicht vorsieht, nur machen, wenn sie zwingend sind, und im Bericht begründen.

## 11. Abnahmekriterien

- [ ] Die Tage 1 bis 3 sind von Anfang bis Ende spielbar, auch mit Neuladen zwischendurch.
- [ ] Wer alle Akten laut JSON richtig entscheidet, hat an allen Tagen null Fehler.
- [ ] Ein Test prüft für jede Akte, dass alle referenzierten Regeln spätestens am Tag der Akte freigeschaltet sind.
- [ ] Ein Test prüft, dass jede Position und jede Entscheidung eine `explanation` und mindestens eine Regel hat.
- [ ] Die Folgeakte von 3-4 erscheint an Tag 4 nur nach einem Ergänzungsersuchen. Tag 4 kommt aus dem JSON. Ohne Folgeakte erscheint `texts.emptyDay`.
- [ ] Im Code steht kein Text, den ein Spieler liest oder ein Screenreader vorliest. Ein Test findet deutsche Textliterale in `src/` (Ausnahmen nur in einer kurzen, begründeten Liste: Loader- und Fehlermeldungen, Betragsformat) und schlägt bei jedem neuen fehl. Ein e2e-Test prüft zusätzlich, dass jeder sichtbare oder vorgelesene Text aus einer JSON-Datei stammt.
- [ ] Jeder Schlüssel in `ui.json` wird im Code verwendet, jeder im Code verwendete Schlüssel steht in `ui.json`, und die Platzhalter im Aufruf passen zu denen im Text.
- [ ] Der Startbildschirm zeigt den Hinweis auf Fiktion, Vereinfachung und fehlende Rechtsauskunft (Text aus einer JSON-Datei).
- [ ] Jedes Bedienelement hat eine zugängliche Beschriftung, auch ein reiner Icon-Knopf wie der für die Einstellungen.
- [ ] Gesperrte Kodexseiten zeigen keinen Inhalt.
- [ ] Papiere lassen sich mit Maus und Touch ziehen, bei „Effekte aus“ ohne Animation.
- [ ] Ein gezogenes Papier wird an keinem Rand der Unterlage abgeschnitten.
- [ ] Alle Entscheidungen funktionieren auch mit der Tastatur.
- [ ] Ein Spielstand ohne `music` lädt und bekommt den Standardwert.
- [ ] Der Build läuft auf GitHub Pages (Unterpfad, Neuladen und alle Assets, auch Schrift und Audio, werden gefunden).

## 12. Nicht Teil des Prototyps

Pinnwand, Telefon, Morgenzeitung, Rechner, Fristen und Kalender (daher auch kein Datum im Spiel), Three.js-Atmosphäre, weitere Tage und Akte, weitere Musikstücke.
