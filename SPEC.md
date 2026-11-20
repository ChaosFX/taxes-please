# Taxes Please – Spezifikation Prototyp (Tag 1 bis 4)

Stand: 20.11.2026 · Version 0.2 · passt zu `content/akt1-tag1-3.json` Version 0.1.1

Ein Lernspiel im Stil von Papers Please: Der Spieler sitzt als Sachbearbeiter in einem fiktiven Wiener Finanzamt, prüft Papierakten nach einem Steuerrechts-Kodex, der täglich wächst, und stempelt Entscheidungen. Ziel ist, österreichisches Steuerrecht für die Dienstprüfung zu lernen und anderen zu vermitteln.

Dieser Prototyp umfasst drei Spieltage mit 11 Akten und 7 Kodexregeln sowie einen kurzen Tag 4 für die Folgeakte. Inhalt und Lösungen stehen in `content/akt1-tag1-3.json`. Die Rahmenhandlung liegt in einem separaten Dokument und ist für den Prototyp nur in Form der Story-Ereignisse im JSON relevant.

## 1. Grundsätze

1. **Rechtliche Korrektheit vor Optik.** Die Spiellogik entscheidet ausschließlich anhand der Daten im JSON. Keine Steuerregel wird im Code nachgebaut oder geraten.
2. **Alles, was gelesen oder angeklickt wird, ist HTML/CSS.** Akten, Kodex, Stempel und Auswertung sind DOM-Elemente. Kein Text in Canvas oder WebGL.
3. **Logik und Darstellung sind getrennt.** `src/core` ist reines TypeScript ohne DOM-Zugriff und vollständig getestet. `src/ui` liest nur den Zustand aus `core` und ruft dessen Aktionen auf.
4. **Inhalte sind Daten.** Neue Tage und Fälle entstehen durch neue JSON-Dateien, nicht durch Code. Das gilt auch für Spieltexte (Ermahnung, Anzeigenamen), siehe `texts`.
5. **Fiktion.** Alle Personen und Firmen sind erfunden. Ein Startbildschirm weist darauf hin, dass Kodextexte vereinfacht sind und keine Rechtsauskunft darstellen.

## 2. Technischer Rahmen

- Vite mit TypeScript (strict), kein UI-Framework. Eine kleine eigene Render-Schicht genügt.
- GSAP für Animationen ist erlaubt, ebenso reine CSS-Transitions. Kein Three.js im Prototyp; die Atmosphäre-Ebene (Abschnitt 8) bleibt als leeres Modul vorbereitet.
- Vitest für Unit-Tests von `core` und für die Inhaltsvalidierung.
- Playwright für Screenshots der Hauptansichten (siehe Abschnitt 10).
- Spielstand in `localStorage`, Zugriffe in `try/catch` gekapselt.
- Build als statische Seite, Veröffentlichung über GitHub Pages.
- Sprache der Oberfläche: Deutsch (Österreich). Beträge im Format `1.200,00 €`.

### Ordnerstruktur

```
src/
  core/        Typen, Zustand, Regeln laden, Bewertung, Tagesablauf, Speichern
  ui/          Schreibtisch, Papiere, Kodex, Stempel, Auswertung, Startbildschirm
  ui/atmosphere/  vorbereitetes Modul für Licht und Partikel (im Prototyp: Stub)
  audio/       Soundeffekte (optional, siehe Abschnitt 7)
content/       JSON-Inhalte, eine Datei pro Abschnitt
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

Referenz ist der HTML-Prototyp aus der Konzeptphase: Holztisch, grüne Schreibunterlage, Papiere in leicht gebrochenem Weiß mit Schreibmaschinenschrift.

- **Ziehen:** Pointer Events für Maus und Touch. Beim Aufnehmen leicht vergrößern, Schatten weicher und länger, Neigung je nach Zugrichtung. Beim Loslassen kurze Ablege-Animation. Das zuletzt angefasste Papier liegt oben. Nur `transform` animieren.
- **Papier:** feine Papierstruktur (SVG-Rauschfilter oder kleine Textur), zufällige Drehung von ein bis zwei Grad, Büroklammern bei Belegen.
- **Stempel:** Aufschlag mit kurzer Skalierungs-Animation und leichtem Wackeln der Arbeitsfläche. Der Abdruck bleibt auf dem Prüfvermerk sichtbar.
- **Kanzleistempel:** Dokumente mit `stamp` zeigen unten links einen blassen Kanzleistempel. Das ist der Story-Hinweis von Tag 2.
- **Lesbarkeit:** Doppelklick auf ein Papier zoomt es lesbar heran, erneuter Doppelklick legt es zurück.
- **Sound (optional):** Stempel, Papierrascheln, leises Büro-Ambiente. Lautstärke-Regler, standardmäßig an.
- **Einstellungen:** Effekte aus, reduziert oder voll. `prefers-reduced-motion` setzt automatisch „reduziert“.
- **Bedienbarkeit ohne Maus:** Alle Entscheidungen und Stempel sind per Tastatur erreichbar. Fokus ist sichtbar.

## 8. Atmosphäre (vorbereitet, nicht im Prototyp)

`src/ui/atmosphere` exportiert `mount(container)` und `setQuality(level)`. Im Prototyp ist das ein Stub. Später kommt hier eine Ebene über dem Tisch mit `pointer-events: none` dazu, zuerst in leichter Form (CSS-Lichtkegel, 2D-Staub), danach optional Three.js. Das Spiel muss ohne diese Ebene vollständig funktionieren.

## 9. Speichern

- Automatisches Speichern nach jeder gestempelten Akte und am Tagesende.
- Gespeichert werden: aktueller Tag, Ergebnisse je Akte, Fehler je Tag, offene Folgeakten, Einstellungen.
- „Neues Spiel“ fragt vor dem Überschreiben nach.

## 10. Arbeitsweise für Claude Code

1. Zuerst `core` mit Typen, Loader, Schema-Validierung und Bewertung, inklusive Tests.
2. Dann eine schlichte, voll spielbare Oberfläche ohne Animationen.
3. Danach Optik und Gefühl nach Abschnitt 7.
4. Nach jedem Oberflächen-Schritt Screenshots mit Playwright erstellen (Startbildschirm, Schreibtisch mit offener Akte, Kodex offen, Tagesauswertung) und selbst prüfen: Ist der Text lesbar, überlappt nichts, sind alle Bedienelemente sichtbar?
5. Inhalte nie im Code ändern. Fällt ein Fehler im JSON auf, im Bericht melden statt stillschweigend anzupassen. Fehlt ein Spieltext im JSON, ebenfalls melden und nicht im Code erfinden.

## 11. Abnahmekriterien

- [ ] Die Tage 1 bis 3 sind von Anfang bis Ende spielbar, auch mit Neuladen zwischendurch.
- [ ] Wer alle Akten laut JSON richtig entscheidet, hat an allen Tagen null Fehler.
- [ ] Ein Test prüft für jede Akte, dass alle referenzierten Regeln spätestens am Tag der Akte freigeschaltet sind.
- [ ] Ein Test prüft, dass jede Position und jede Entscheidung eine `explanation` und mindestens eine Regel hat.
- [ ] Die Folgeakte von 3-4 erscheint an Tag 4 nur nach einem Ergänzungsersuchen. Tag 4 kommt aus dem JSON. Ohne Folgeakte erscheint `texts.emptyDay`.
- [ ] Im Code steht kein Spieltext, der nicht aus dem JSON kommt (Ermahnung, Optionsnamen, Stempelnamen, „unnötige Verzögerung“).
- [ ] Gesperrte Kodexseiten zeigen keinen Inhalt.
- [ ] Papiere lassen sich mit Maus und Touch ziehen, bei „Effekte aus“ ohne Animation.
- [ ] Alle Entscheidungen funktionieren auch mit der Tastatur.
- [ ] Der Build läuft auf GitHub Pages.

## 12. Nicht Teil des Prototyps

Pinnwand, Telefon, Morgenzeitung, Rechner, Fristen und Kalender (daher auch kein Datum im Spiel), Three.js-Atmosphäre, weitere Tage und Akte.
