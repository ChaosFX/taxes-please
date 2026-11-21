# Taxes Please – Spezifikation Akt I (Tag 1 bis 10)

Stand: 21.11.2026 · Version 0.3.0 · passt zu `content/akt1-tag1-3.json` Version 0.2.0, `content/akt1-tag4-10.json` Version 0.1.0 und `content/ui.json` Version 0.2.0

Ein Lernspiel im Stil von Papers Please: Der Spieler sitzt als Sachbearbeiter Daniel Winkler in einem fiktiven Wiener Finanzamt, prüft Papierakten nach einem Steuerrechts-Kodex, der täglich wächst, und stempelt Entscheidungen. Ziel ist, österreichisches Steuerrecht für die Dienstprüfung zu lernen und anderen zu vermitteln.

Diese Version umfasst den ganzen Akt I: zehn Spieltage mit 48 Akten, 6 Folgeakten und 54 Kodexregeln (davon 5 Hinweise ohne eigenen Fall). Inhalt und Lösungen stehen in `content/akt1-tag1-3.json` (Tag 1 bis 3) und `content/akt1-tag4-10.json` (Tag 4 bis 10).

Änderungen gegenüber 0.2.2:
- Neuer Akten-Typ `entscheidungen` mit Auswahl- und Betragsentscheidungen, Widersprüchen, Nachfragen und Varianten (Abschnitt 3).
- Inhaltsdateien werden vollständig zusammengeführt, auch `texts` (Abschnitt 3).
- Neue Story-Ereignisse: Morgenzeitung, Anruf, Freischaltung, Abschluss eines Akts. Spuren für die Pinnwand und Ereigniskarten des Metagames werden geprüft, aber noch nicht dargestellt (Abschnitte 3 und 4).
- Tischrechner ab Tag 8, Widerspruch markieren, Nachfrage mit Auswahl (Abschnitt 4).
- Tag 4 ist ein normaler Spieltag. Der Schlussbildschirm kommt nach Tag 10 als „Ende von Akt I“ (Abschnitt 4).
- Bewertung für Beträge, Widersprüche und Nachfragen (Abschnitt 5).
- Kodex zeigt Hinweisregeln (Abschnitt 6).

## 1. Grundsätze

1. **Rechtliche Korrektheit vor Optik.** Die Spiellogik entscheidet ausschließlich anhand der Daten im JSON. Keine Steuerregel wird im Code nachgebaut oder geraten. Das gilt auch für Beträge: Das Spiel vergleicht die Eingabe mit `correct`, es rechnet nichts selbst nach.
2. **Alles, was gelesen oder angeklickt wird, ist HTML/CSS.** Akten, Kodex, Stempel, Zeitung, Rechner und Auswertung sind DOM-Elemente. Kein Text in Canvas oder WebGL.
3. **Logik und Darstellung sind getrennt.** `src/core` ist reines TypeScript ohne DOM-Zugriff und vollständig getestet. `src/ui` liest nur den Zustand aus `core` und ruft dessen Aktionen auf. Der Tischrechner rechnet in einer reinen Funktion in `core`.
4. **Inhalte sind Daten.** Neue Tage und Fälle entstehen durch neue JSON-Dateien, nicht durch Code. Das gilt für alle Texte, die ein Spieler liest oder die ein Screenreader vorliest: Spieltexte stehen in den Inhaltsdateien (`texts`, Akten, Tage, Regeln), Oberflächentexte in `content/ui.json`. Im Code stehen nur Schlüssel. **Ausnahme:** Meldungen des Loaders und andere Fehlermeldungen, die sich an Autoren der JSON-Dateien richten, bleiben im Code, weil sie auch lesbar sein müssen, wenn `ui.json` selbst fehlerhaft ist. Die Überschrift des Fehlerbildschirms kommt aus `ui.json`. Die Ausnahmen stehen in der begründeten Liste des Textliteral-Tests (Abschnitt 11).
5. **Fiktion.** Alle Personen und Firmen sind erfunden. Ein Startbildschirm weist darauf hin, dass Kodextexte vereinfacht sind und keine Rechtsauskunft darstellen.

## 2. Technischer Rahmen

- Vite mit TypeScript (strict), kein UI-Framework. Eine kleine eigene Render-Schicht genügt.
- GSAP für Animationen ist erlaubt, ebenso reine CSS-Transitions. Kein Three.js; die Atmosphäre-Ebene (Abschnitt 8) bleibt als leeres Modul vorbereitet.
- Vitest für Unit-Tests von `core` und für die Inhaltsvalidierung.
- Playwright für Screenshots der Hauptansichten (siehe Abschnitt 10) und für die e2e-Tests.
- Spielstand in `localStorage`, Zugriffe in `try/catch` gekapselt.
- Build als statische Seite, Veröffentlichung über GitHub Pages (Projektseite unter einem Unterpfad, daher relativer `base` in Vite).
- Sprache der Oberfläche: Deutsch (Österreich). Beträge im Format `1.200,00 €`.

### Ordnerstruktur

```
src/
  core/        Typen, Zustand, Regeln laden, Bewertung, Tagesablauf, Rechner, Speichern
  ui/          Schreibtisch, Papiere, Kodex, Stempel, Zeitung, Rechner, Auswertung, Startbildschirm
  ui/atmosphere/  vorbereitetes Modul für Licht und Partikel (Stub)
  audio/       Soundeffekte und Musik (Abschnitt 7)
content/       JSON-Inhalte (eine Datei pro Abschnitt) und ui.json
public/audio/  Klangdateien mit QUELLEN.md
tools/music/   Skripte, die die Musik synthetisch erzeugen
tests/         Vitest und Playwright
```

## 3. Datenmodell

Die Typen folgen exakt dem JSON in `content/`. Alles, was hier nicht als optional bezeichnet ist, ist Pflicht.

### Zusammenführen der Inhaltsdateien

- Der Loader liest alle `content/*.json` außer `ui.json`, sortiert nach Dateinamen, und führt sie zu einem Inhalt zusammen.
- `meta` kommt aus der ersten Datei. Jede Datei hat ein eigenes `meta.version`, die Versionen aller Dateien werden im Fehlerfall mit ausgegeben.
- `rules`, `days` und `cases` werden aneinandergehängt. Doppelte Regel-IDs, Akten-IDs oder Tagesnummern sind ein Fehler.
- `texts` wird schlüsselweise zusammengeführt. `texts.optionLabels` ist die Vereinigung aller Dateien. Kommt ein Schlüssel (auch in `optionLabels`) in zwei Dateien mit verschiedenem Wert vor, ist das ein Fehler. Pflichtschlüssel (`stampLabels`, `unnecessaryDelay`, `warning`, `emptyDay`) müssen nach dem Zusammenführen vorhanden sein, egal in welcher Datei.

### `texts`

- `optionLabels`: Anzeigename je Option, die als Zeichenkette angegeben ist (Schlüssel = Optionswert). Jeder Schlüssel muss in mindestens einer Entscheidung vorkommen.
- `stampLabels`: Anzeigename je Stempel.
- `unnecessaryDelay`: Fehlertext „Ergänzungsersuchen bei vollständiger Akte“.
- `warning`: `minErrors`, `from`, `text` der Ermahnung.
- `emptyDay`: Text für einen Tag ohne Akten.
- `wrongInquiry`: Fehlertext für eine Nachfrage, die den offenen Punkt nicht klärt.
- `missedDiscrepancy`: Fehlertext für einen nicht markierten Widerspruch.
- `falseDiscrepancy`: Fehlertext für eine Markierung, die kein Widerspruch ist.

### `Rule`

`id`, `day` (ab welchem Tag freigeschaltet), `title`, `text`, `source`, `sourceUrl`, optional `hint: true` für einen Kodex-Hinweis ohne eigenen Fall. Eine Hinweisregel darf trotzdem von Entscheidungen referenziert werden.

### `Day`

`day`, `intro`, `stamps` (verfügbare Stempel), `cases` (IDs in Reihenfolge, darf leer sein), `storyEvents` (Liste in Anzeigereihenfolge), optional `traces` (Spuren für die Pinnwand, siehe unten).

### Story-Ereignisse (`storyEvents`)

Jedes Ereignis hat ein `type`. Die Felder je Typ:

| `type` | Felder | Darstellung |
| --- | --- | --- |
| `note` | `from`, `text`, optional `title` | Zettel (wie bisher), `title` als Überschrift |
| `dialog` | `from`, `text` | Sprechblase (wie bisher) |
| `newspaper` | `from` (Name der Zeitung), `headline`, `text` | Zeitungsblatt mit Kopf `from`, Schlagzeile und kurzem Text |
| `call` | `from`, `text` | Telefonhörer mit „Anruf von {from}“ und Text |
| `unlock` | `feature`: `calculator`, `pinboard` oder `drawer` | `calculator` schaltet ab diesem Tag den Tischrechner frei und zeigt `ui.intro.unlockCalculator`. `pinboard` und `drawer` werden geprüft, aber in dieser Version nicht dargestellt. |
| `event` | `id`, `text`, `options` (je `text`, `effects` mit `time`, `rating`, `gerri`, `home` als ganze Zahlen, `sets` als Liste von Merkern), optional `provisional: true` | Ereigniskarte des Metagames. In dieser Version nur geprüft, nicht dargestellt. |
| `actSummary` | `act` (Zahl) | Nach der Tagesauswertung dieses Tages erscheint der Schlussbildschirm des Akts (Abschnitt 4). |

Ein unbekannter `type` ist ein Ladefehler.

### Spuren (`traces`, nur geprüft)

`id`, `label`, `links` (mindestens zwei, je `case` und entweder `document` mit `line` oder `field`), `reward` (`type: "note"`, `from`, `text`). Der Loader prüft, dass jede verlinkte Akte, jedes Dokument (Titel) und jede Zeile (Label) existiert und dass `field` ein vorhandenes Feld der Akte ist (zum Beispiel `representative`). Die Pinnwand selbst kommt in einem späteren Auftrag.

### `Case`

Gemeinsame Felder:

- `id`, `type`, optional `story: true`, optional `variantOf` (ID einer anderen Akte, nur Information, keine Wirkung im Spiel).
- `taxpayer`: `name`, optional `job`, optional `employer`. Ohne `job` zeigt der Kopf `ui.desk.akteNoJob`.
- optional `representative` mit `name` und `stampVisible`.
- `documents`: Liste von Papieren (`kind`: `erklaerung` oder `beleg`, `title`, `lines` als Label-Wert-Paare, optional `stamp`). Dokumenttitel sind je Akte eindeutig, Zeilen-Labels je Dokument eindeutig. Widersprüche und Spuren verweisen über Titel und Label.
- `correctStamp`: `bescheid` oder `ergaenzung`.
- optional `followUp`: Unterlagen, die an einem späteren Tag als neue Akte eintreffen, mit eigener Lösung. Bei `werbungskosten` mit `positions`, bei `entscheidungen` mit `decisions`, jeweils mit `documents` und `correctStamp`.

Typen:

- `werbungskosten`: `positions` mit `correct` aus `anerkennen`, `streichen` oder `offen` (wie bisher).
- `steuerpflicht`: `decision` mit `question`, `options`, `correct` (wie bisher).
- `entscheidungen` (neu): `decisions`, eine Liste von Entscheidungen. Jede hat `id`, `label`, `rules` (mindestens eine), `explanation`, optional `amount` (Betrag zur Anzeige in der Zeile) und eine der beiden Formen:
  - **Auswahl:** `options` (mindestens zwei) und `correct`. Eine Option ist entweder eine Zeichenkette (Anzeigename aus `texts.optionLabels`) oder ein Objekt `{ "value": …, "label": … }` (Anzeigename steht direkt dabei). `correct` ist ein Optionswert oder `offen`. `offen` heißt: keine Option ist richtig, der Punkt ist per Ergänzungsersuchen zu klären.
  - **Betrag:** `answerType: "amount"` und `correct` als Zahl in Euro (bis zu zwei Nachkommastellen). Der Spieler tippt den Betrag ein.
  - optional `discrepancies`: Liste von Widersprüchen, je `id`, `decision` (ID der betroffenen Entscheidung), `a` und `b` (je `document` und `line`, in verschiedenen Dokumenten der Akte), `explanation`.
  - optional `inquiry`: `decision` (ID einer Entscheidung mit `correct: "offen"`), `prompt`, `options` (je `id`, `label`, `answer`), `correct` (ID der richtigen Frage).

Der Loader prüft wie bisher alle Querverweise und zusätzlich:

- Jede Regel einer Entscheidung ist spätestens am Tag der Akte freigeschaltet, bei Folgeakten spätestens am Tag des Eintreffens.
- Hat eine Akte eine Entscheidung mit `offen`, ist `correctStamp` `ergaenzung`, und umgekehrt hat eine Akte mit `ergaenzung` mindestens eine Entscheidung oder Position mit `offen`.
- `discrepancies` und `inquiry` zeigen auf existierende Entscheidungen, Dokumente und Zeilen. Eine Akte mit `inquiry` hat einen `followUp`.
- `variantOf` zeigt auf eine existierende Akte.
- Jeder Schlüssel in `texts.optionLabels` kommt in einer Entscheidung vor, und jede Option als Zeichenkette hat einen Schlüssel.

### Oberflächentexte (`content/ui.json`)

- Eigene Datei mit eigener Versionsnummer, unabhängig von den Akt-Dateien, weil die Texte an keinem Spieltag hängen.
- Aufbau: ein flaches, nach Bereichen gegliedertes Objekt, zum Beispiel `settings`, `desk`, `codex`, `calculator`, `evaluation`, `title`, `end`, `aria`. Jeder Eintrag ist ein String. Platzhalter stehen als `{name}`, zum Beispiel `„Tag {day}“`.
- Der Code greift über eine typisierte Funktion `t("bereich.schluessel", { name: wert })` zu. Der Schlüsselraum ist als Typ abgeleitet, ein unbekannter Schlüssel ist ein Kompilierfehler.
- Der Loader prüft `ui.json` mit einem Schema. Fehlt ein Schlüssel oder ist einer zu viel, bricht der Start mit einer klaren Fehlermeldung ab.
- Leerzeichen am Anfang oder Ende eines Textes gehören zur Darstellung und bleiben erhalten.
- `ui.json` enthält keine Rechtsaussagen. Kodextexte, Regeln und Erklärungen bleiben in den Inhaltsdateien.
- Das Betragsformat (`1.200,00 €`) und das Einlesen eingegebener Beträge bleiben im Code.

## 4. Spielablauf

1. **Startbildschirm:** Titel, Hinweis auf Fiktion und Vereinfachung, Buttons „Neues Spiel“ und „Fortsetzen“.
2. **Tagesbeginn:** Karte mit „Tag N“ und `intro`-Text. Ein Spieldatum gibt es nicht, der Tag heißt nur „Tag N“. Daten in Belegen und Fristfällen sind Inhalt der Papiere und haben keine Wirkung auf den Ablauf. Danach die Story-Ereignisse des Tages in ihrer Reihenfolge (Abschnitt 3).
3. **Schreibtisch:** Links der Kodex, in der Mitte die Arbeitsfläche, rechts Stempel und Ausgangskorb. Oben ein Akten-Stapel mit Zähler. Ab dem Tag mit `unlock: calculator` steht neben dem Kodex der Tischrechner.
4. **Akte bearbeiten:**
   - Klick auf den Stapel legt die nächste Akte auf den Tisch. Die Dokumente erscheinen als einzelne Papiere, die gezogen werden können.
   - Der Prüfvermerk listet je nach Typ die Positionen (anerkennen, streichen), die Frage mit Optionen oder die Entscheidungen. Bei `entscheidungen` hat jede Zeile entweder Schaltflächen für die Optionen oder ein Eingabefeld für den Betrag. Das Eingabefeld akzeptiert Eingaben wie `4236,7`, `4.236,70` und `4236.70` und zeigt den Betrag nach dem Verlassen des Felds im Format `4.236,70 €`.
   - Bei Entscheidungen oder Positionen mit `offen` ist keine Option richtig. Der Spieler lässt sie unentschieden und stempelt das Ergänzungsersuchen.
   - **Widerspruch markieren:** Ein Schalter „Widerspruch markieren“ im Prüfvermerk schaltet einen Markiermodus ein. Darin wählt der Spieler eine Zeile in einem Papier und dann eine Zeile in einem anderen Papier derselben Akte. Das Paar erscheint als Markierung im Prüfvermerk und auf beiden Papieren. Markierungen lassen sich aufheben. Der Markiermodus ist bei jeder Akte verfügbar, auch ohne `discrepancies`, damit er nichts verrät. Auch per Tastatur bedienbar.
   - **Nachfrage:** Hat die Akte eine `inquiry` und wählt der Spieler den Stempel „Ergänzungsersuchen“, erscheint vor dem Aufschlag die Auswahl der Fragen (`prompt`, `options[].label`). Erst nach der Wahl wird gestempelt. Akten ohne `inquiry` stempeln wie bisher.
   - Der Spieler stempelt die Akte mit einem der verfügbaren Stempel und legt sie in den Ausgangskorb. Erst dann kommt die nächste Akte. Der Stempel ist endgültig, danach sind Prüfvermerk, Markierungen und Nachfrage gesperrt.
5. **Tagesende:** Wenn der Stapel leer ist, erscheint die Auswertung.
6. **Folgeakten:** Eine Akte mit `followUp` kommt am angegebenen Tag zusätzlich in den Stapel, aber nur wenn der Spieler das Ergänzungsersuchen gestempelt hat. Sie kommt immer mit den Unterlagen aus `followUp.documents`, auch wenn die Nachfrage falsch gewählt war (der Fehler ist dann schon gezählt). Hat der Spieler einen Bescheid erlassen, kommt sie nicht. Folgeakten liegen im Stapel vor den Akten des Tages.
7. **Leere Tage:** Ist der Stapel eines Tages leer, zeigt das Spiel `texts.emptyDay` und geht direkt zur Auswertung.
8. **Abschluss eines Akts:** Nach der Auswertung eines Tages mit `actSummary` erscheint der Schlussbildschirm `ui.end` („Ende von Akt {act}“) mit der Übersicht Tag und Fehler. Gibt es danach keinen weiteren Tag, bleibt das Spiel dort stehen. Der Schlussbildschirm „Ende des Prototyps“ nach Tag 4 entfällt.

## 5. Bewertung und Auswertung

- Jede falsch entschiedene Position, jede falsche Option, jeder falsche Betrag und jeder falsche Stempel zählt als ein Fehler.
- Eine Position oder Entscheidung, die nicht entschieden wurde, obwohl sie laut Daten nicht `offen` ist, zählt als falsch. Ein leeres Betragsfeld zählt als falsch.
- Ein Betrag ist richtig, wenn er auf den Cent mit `correct` übereinstimmt. Verglichen wird in ganzen Cent, nicht mit Gleitkommazahlen.
- Eine Option bei einer Entscheidung mit `offen` zählt als falsch.
- Ein Ergänzungsersuchen bei einer Akte ohne `offen` zählt als Fehler mit dem Text `texts.unnecessaryDelay`.
- **Widersprüche** werden nur bewertet, wenn die Akte `discrepancies` hat und der Spieler das Ergänzungsersuchen stempelt. Jeder Widerspruch aus den Daten, der nicht als Paar markiert ist (Reihenfolge von `a` und `b` egal), zählt als ein Fehler mit `texts.missedDiscrepancy`. Jede markierte Paarung, die in den Daten nicht vorkommt, zählt als ein Fehler mit `texts.falseDiscrepancy`. Bei einem Bescheid werden Markierungen ignoriert (der falsche Stempel ist schon ein Fehler).
- **Nachfragen:** Eine gewählte Frage, die nicht `inquiry.correct` ist, zählt als ein Fehler mit `texts.wrongInquiry`.
- Die Tagesauswertung zeigt pro Akte: richtig oder falsch, die richtige Lösung (bei Beträgen den richtigen Betrag und den eingegebenen), die `explanation`, bei Widersprüchen deren `explanation`, bei Nachfragen die gewählte und die richtige Frage, und die verlinkten Kodexregeln mit Fundstelle.
- Ab `texts.warning.minErrors` Fehlern an einem Tag erscheint die Ermahnung (`from`, `text`). Das hat weiterhin keine Folgen.
- Die Bewertung ist eine reine Funktion in `core` und vollständig getestet.

## 6. Kodex

- Ein Buch, das sich per Klick auf- und zuklappen lässt. Lesezeichen nach Tagen.
- Nur Regeln mit `day` kleiner oder gleich dem aktuellen Tag sind lesbar. Spätere Seiten sind als gesperrt sichtbar („ab Tag 5“), aber ohne Inhalt.
- Neue Regeln eines Tages sind als „neu“ markiert.
- Regeln mit `hint: true` tragen zusätzlich die Kennzeichnung `ui.codex.hint`.
- Volltextsuche über Titel und Text der freigeschalteten Regeln.
- Jede Regel zeigt den Hinweis „vereinfacht“ und die Fundstelle mit Link.
- Bei 54 Regeln bleibt der Kodex bedienbar: Lesezeichen springen zum Tag, die Suche findet auch Teilwörter.

## 7. Schreibtisch, Optik und Gefühl

Referenz ist der HTML-Prototyp aus der Konzeptphase: Holztisch, grüne Schreibunterlage, Papiere in leicht gebrochenem Weiß mit Schreibmaschinenschrift (Courier Prime, OFL, lokal eingebunden).

- **Ziehen:** Pointer Events für Maus und Touch. Beim Aufnehmen leicht vergrößern, Schatten weicher und länger, Neigung je nach Zugrichtung. Beim Loslassen kurze Ablege-Animation. Das zuletzt angefasste Papier liegt oben. Nur `transform` animieren. Ein Papier lässt sich nie so weit ablegen, dass ein Teil seiner Fläche, auch gedreht, vom Rand der Unterlage abgeschnitten wird.
- **Ziehen per Tastatur:** Ein fokussiertes Papier lässt sich mit den Pfeiltasten verschieben. Ziehen ist für keine Entscheidung nötig.
- **Papier:** feine Papierstruktur (SVG-Rauschfilter oder kleine Textur), zufällige Drehung von ein bis zwei Grad, Büroklammern bei Belegen.
- **Viele Papiere:** Akten haben bis zu sechs Papiere. Sie werden beim Auflegen leicht versetzt gefächert, sodass jeder Titel sichtbar bleibt.
- **Stempel:** Aufschlag mit kurzer Skalierungs-Animation und leichtem Wackeln der Arbeitsfläche (nur bei „voll“). Der Abdruck bleibt auf dem Prüfvermerk sichtbar.
- **Kanzleistempel:** Dokumente mit `stamp` zeigen unten links einen blassen Kanzleistempel.
- **Morgenzeitung:** ein schmales Zeitungsblatt mit Kopfzeile in Antiqua-Anmutung (lokal eingebundene freie Schrift, Lizenz in `QUELLEN.md`), Schlagzeile groß, Text in Spalten. Es liegt beim Tagesbeginn auf dem Tisch und lässt sich wie ein Papier ziehen und zoomen, bis der Tag endet.
- **Anruf:** kurzes Klingeln (CC0, Quelle in `QUELLEN.md`), dann der Text als Sprechblase neben einem Telefon.
- **Tischrechner:** ein kleines Gerät mit Ziffern 0 bis 9, Komma, + − × ÷, = und C, per Maus und Tastatur bedienbar. Die Anzeige nutzt das österreichische Zahlenformat. Der Rechner überträgt nichts automatisch in den Prüfvermerk. Division durch null zeigt `ui.calculator.error`.
- **Markierungen:** Markierte Zeilen bekommen einen roten Bleistiftrahmen, ein Paar wird mit derselben kleinen Nummer gekennzeichnet.
- **Lesbarkeit:** Doppelklick auf ein Papier oder Enter beziehungsweise Leertaste bei Fokus zoomt es lesbar heran. Erneuter Doppelklick oder Escape legt es zurück.
- **Sound:** Stempel (3 Varianten), Papierrascheln (2), Ablage (2, auch beim Ausgangskorb), Telefonklingeln und leises Büro-Ambiente. Alle Klangdateien sind CC0, Quellen und Bearbeitungen stehen in `public/audio/QUELLEN.md`. Ton startet erst nach der ersten Nutzeraktion. Fällt der Ton aus, läuft das Spiel unverändert weiter.
- **Musik (Akt 1):** Ein eigenes, synthetisch erzeugtes 16-Bit-Arrangement des Walzers Nr. 1 aus „G'schichten aus dem Wienerwald“ von Johann Strauß (Sohn, gemeinfrei) als nahtlose Schleife. Das Arrangement entsteht aus eigener Notation mit `tools/music/wienerwald16-loop.mjs`, nicht aus einer Aufnahme oder einer geschützten Notenausgabe. Die Musik hat einen eigenen Lautstärkeregler (Standard 0,5, 0 ist aus), getrennt vom Regler für die Effekte. Bei 0 wird sie weder geladen noch dekodiert; wird sie dabei abgeschaltet, blendet sie in 80 ms aus, und beim Wiedereinschalten setzt sie an derselben Stelle fort. Für spätere Akte ist ein eigenes Stück je Akt vorgesehen. Jede Musikquelle steht in `QUELLEN.md`.
- **Einstellungen:** Effekte aus, reduziert oder voll. `prefers-reduced-motion` setzt automatisch „reduziert“. Dazu Lautstärke (Soundeffekte) und Musiklautstärke. Lautstärke 0 und Musik 0 bedeuten aus.
- **Bedienbarkeit ohne Maus:** Alle Entscheidungen, Betragsfelder, Markierungen, Nachfragen, der Rechner und die Stempel sind per Tastatur erreichbar. Fokus ist sichtbar.

## 8. Atmosphäre (vorbereitet)

`src/ui/atmosphere` exportiert `mount(container)` und `setQuality(level)`. Das ist weiterhin ein Stub. Später kommt hier eine Ebene über dem Tisch mit `pointer-events: none` dazu, zuerst in leichter Form (CSS-Lichtkegel, 2D-Staub), danach optional Three.js. Das Spiel muss ohne diese Ebene vollständig funktionieren.

## 9. Speichern

- Automatisches Speichern nach jeder gestempelten Akte und am Tagesende.
- Gespeichert werden: aktueller Tag, Ergebnisse je Akte (inklusive eingegebener Beträge, Markierungen und gewählter Nachfrage), Fehler je Tag, offene Folgeakten, freigeschaltete Werkzeuge, Einstellungen.
- Die Einstellungen sind `effects` (aus, reduziert, voll), Lautstärke (0 = aus) und `music` (Musiklautstärke, Standard 0,5, 0 = aus). Ein älterer Spielstand ohne einzelne Felder bekommt für diese die Standardwerte aus `DEFAULT_SETTINGS`, ohne dass der übrige Spielstand verloren geht.
- **Spielstände aus Version 0.2:** Ein Spielstand, der an Tag 4 oder danach steht (Ende des Prototyps), wird so übernommen, dass der Spieler mit Tag 4 weiterspielt. Die Ergebnisse von Tag 1 bis 3 bleiben erhalten. Die Folgeakte von 3-4 kommt an Tag 4, wenn sie damals offen war. Ein Test deckt das ab.
- „Neues Spiel“ fragt vor dem Überschreiben nach.

## 10. Arbeitsweise für Claude Code

1. Zuerst `core`: Schema, Zusammenführen, Querprüfungen, Bewertung, Rechner, Spielstand-Übernahme, inklusive Tests.
2. Dann die Oberfläche für die neuen Teile ohne Animationen, danach Optik nach Abschnitt 7.
3. Nach jedem Oberflächen-Schritt Screenshots mit Playwright erstellen (Startbildschirm, Schreibtisch mit offener Akte vom Typ `entscheidungen` mit Betragsfeld, Markiermodus mit einem Paar, Nachfrage-Auswahl, Morgenzeitung, Rechner, Kodex offen mit Hinweisregel, Tagesauswertung mit Betrag und Widerspruch, Schlussbildschirm Akt I) und selbst prüfen: Ist der Text lesbar, überlappt nichts, sind alle Bedienelemente sichtbar?
4. Inhalte nie im Code ändern. Fällt ein Fehler im JSON auf, im Bericht melden statt stillschweigend anzupassen. Fehlt ein Spieltext im JSON, ebenfalls melden und nicht im Code erfinden. Für fehlende Oberflächentexte gilt die Regel des jeweiligen Auftrags.
5. Änderungen an `src/core`, die ein Auftrag nicht vorsieht, nur machen, wenn sie zwingend sind, und im Bericht begründen.

## 11. Abnahmekriterien

- [ ] Die Tage 1 bis 10 sind von Anfang bis Ende spielbar, auch mit Neuladen zwischendurch.
- [ ] Wer alle Akten laut JSON richtig entscheidet (inklusive richtiger Beträge, Markierungen und Nachfragen), hat an allen Tagen null Fehler. Ein e2e-Test spielt Akt I so durch.
- [ ] Ein Test prüft für jede Akte, dass alle referenzierten Regeln spätestens am Tag der Akte freigeschaltet sind, bei Folgeakten am Tag des Eintreffens.
- [ ] Ein Test prüft, dass jede Position und jede Entscheidung eine `explanation` und mindestens eine Regel hat.
- [ ] Alle Querprüfungen aus Abschnitt 3 sind als Loader-Tests mit je einem kaputten Beispiel abgedeckt (doppelte Texte mit verschiedenem Wert, unbekannte Zeile in `discrepancies`, unbekannter Story-Typ, `inquiry` ohne `followUp`, Regel zu früh referenziert).
- [ ] Die Folgeakten erscheinen nur nach einem Ergänzungsersuchen, auch nach falscher Nachfrage.
- [ ] Betragseingaben `4236,7`, `4.236,70`, `4236.70` und `4 236,70` werden als derselbe Betrag erkannt. Ein Unit-Test deckt Grenzfälle ab (leer, Buchstaben, negativ, mehr als zwei Nachkommastellen).
- [ ] Der Rechner liefert für eine Testliste von Rechnungen die richtigen Ergebnisse (Unit-Test), auch mit Komma.
- [ ] Widerspruch markieren und Nachfrage funktionieren mit Maus und Tastatur.
- [ ] Morgenzeitung, Anruf und Freischaltung des Rechners erscheinen an den Tagen laut JSON.
- [ ] Nach Tag 10 erscheint „Ende von Akt I“ mit der Übersicht aller zehn Tage.
- [ ] Ein Spielstand vom Ende des Prototyps (0.2) lädt und geht mit Tag 4 weiter.
- [ ] Im Code steht kein Text, den ein Spieler liest oder ein Screenreader vorliest. Der Textliteral-Test und der e2e-Test zur JSON-Herkunft decken auch Zeitung, Rechner, Markiermodus und Nachfrage ab.
- [ ] Jeder Schlüssel in `ui.json` wird im Code verwendet, jeder im Code verwendete Schlüssel steht in `ui.json`, und die Platzhalter passen.
- [ ] Der Startbildschirm zeigt den Hinweis auf Fiktion, Vereinfachung und fehlende Rechtsauskunft.
- [ ] Jedes Bedienelement hat eine zugängliche Beschriftung.
- [ ] Gesperrte Kodexseiten zeigen keinen Inhalt.
- [ ] Papiere lassen sich mit Maus und Touch ziehen, bei „Effekte aus“ ohne Animation, und werden an keinem Rand abgeschnitten.
- [ ] Der Build läuft auf GitHub Pages (Unterpfad, Neuladen und alle Assets werden gefunden).

## 12. Nicht Teil dieser Version

Pinnwand und Spuren (Darstellung), Lade mit Notizbuch, Metagame (Tagesbudget, Beurteilung, Vertrauen, Zuhause, Ereigniskarten), Begründung beim Stempel (Auswahl der Regel-ID), Bedingungen auf Merker oder frühere Entscheidungen, Fristen und Kalender im Spielablauf, Three.js-Atmosphäre, Akte ab Akt II, weitere Musikstücke.
