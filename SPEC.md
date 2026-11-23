# Taxes Please – Spezifikation Akt I (Tag 1 bis 10)

Stand: 23.11.2026 · Version 0.5.0 · passt zu `content/akt1.json` Version 0.3.4, `content/ui.json` Version 0.5.0 und `content/kalender.json` Version 0.1.0

Ein Lernspiel im Stil von Papers Please: Der Spieler sitzt als Sachbearbeiter Daniel Winkler in einem fiktiven Wiener Finanzamt, prüft Papierakten nach einem Steuerrechts-Kodex, der täglich wächst, und stempelt Entscheidungen. Ziel ist, österreichisches Steuerrecht für die Dienstprüfung zu lernen und anderen zu vermitteln.

Diese Version umfasst den ganzen Akt I: zehn Spieltage mit 48 Akten, 6 Folgeakten und 54 Kodexregeln (davon 5 Hinweise ohne eigenen Fall). Inhalt und Lösungen stehen in `content/akt1.json`, einer Datei für den ganzen Akt. Spätere Akte bekommen je eine eigene Datei (`akt2.json` usw.).

Änderungen gegenüber 0.4.1:
- Pinnwand ab Tag 7 (`unlock: pinboard`, Abschnitte 4 und 7.6, Auftrag 06): Fundstellen aus Akten werden als Karten angeheftet und mit Fäden verbunden. Ein Faden hält nur zwischen Fundstellen derselben Spur (`traces`). Ist eine Spur vollständig verbunden, erscheint ihr Zettel (`reward`) an der Pinnwand. Erledigte Akten liegen dort als Durchschlag.
- **Vorarbeit an Spuren** (`seed`, Abschnitt 3): Eine Spur kann schon angefangen an der Wand hängen, mit einer Karte einer Figur und angehefteten Fundstellen. Der Spieler ergänzt nur, was fehlt, ein Faden verbindet sich dann von selbst. So lässt sich die Schwierigkeit je Spur über die Daten einstellen: in Akt I viel Vorarbeit, später wenig oder keine.
- **Anheften mit einem Klick:** Jede Zeile hat beim Darüberfahren und bei Fokus eine Nadel, ein Kanzleistempel heftet sich per Klick an. Der Anheftmodus entfällt.
- **Vorläufige Story-Texte:** `provisional: true` ist an jedem Story-Ereignis, an `seed` und an `reward` erlaubt. Es hat im Spiel keine Wirkung. Ein Inhaltsbericht listet alle vorläufigen Texte, damit die Story weiterwachsen kann, ohne dass Code angefasst wird.
- Lade ab Tag 10 (`unlock: drawer`, Abschnitt 7.7): Zettel mit `keep: "drawer"` bleiben nach dem Tagesbeginn in der Lade und lassen sich jederzeit wieder lesen. Vorher klemmt die Lade.
- Regel-IDs in der Tagesauswertung öffnen den Lesemodus des Kodex an dieser Regel (Abschnitt 5).
- Spielstand um `pinboard` erweitert (Abschnitt 9).
- Spuren und Pinnwand erzeugen keine Fehler. Die Bewertung der Akten ändert sich nicht.

Änderungen gegenüber 0.3.2:
- Der Arbeitstisch wird zum Ablauf mit den Händen (Abschnitt 7.1 bis 7.5, Auftrag 05): links Eingang und Werkzeuge, in der Mitte die Unterlage, rechts Stempelhalter und Ausgangskorb. Die Akte ist eine Mappe, die man auf die Unterlage zieht und aufschlägt. Unterlagen werden herausgezogen und fliegen beim Schließen zurück. Stempel werden aufgenommen und aufgedrückt, die zugeklappte Akte wird in den Ausgangskorb gezogen. Es liegt immer nur eine Akte am Tisch.
- Der Kodex lässt sich auf die Unterlage ziehen und liegt dort aufgeschlagen neben der Akte. Das große Buch aus Auftrag 04 bleibt als Lesemodus (Taste K, Abschnitt 6).
- Neues Werkzeug Tischkalender ab Tag 4 (`unlock: calendar`) mit gesetzlichen Feiertagen aus der neuen Datei `content/kalender.json` (Abschnitte 3 und 7.5). `meta.kalenderStart` gibt den Monat an, mit dem der Kalender aufschlägt.
- Die Regel „Papiere im Raster, nicht übereinander“ entfällt. Der Spieler ordnet die Papiere selbst (Abschnitt 7).

Änderungen gegenüber 0.3.1:
- Der Kodex wird zu einem Buch: zugeklappt auf dem Tisch, aufgeschlagen als Doppelseite mit Inhaltsverzeichnis, Griffregister, Lesezeichenband, Blättern und Suche (Abschnitt 6, Auftrag 04). Neu im Spielstand: zuletzt gelesene Regel und gesehene Lieferung (Abschnitt 9).
- Entscheidungen aus Bericht 03 aufgenommen (Abschnitte 4, 5 und 7): Markierungen, Betrag 0, Rechner in Eingabereihenfolge, Fächern der Papiere, Pflichttexte nur bei Bedarf, Antwort der Nachfrage in der Auswertung.
- `aria.calcDisplay` heißt künftig „Rechneranzeige“ statt „Anzeige“.
- Der Schlussbildschirm hat vorerst nur „Zum Startbildschirm“. Das Weiterspielen mit Akt II kommt mit Akt II.

Änderungen gegenüber 0.3.0: Die beiden Inhaltsdateien von Akt I sind zu `content/akt1.json` zusammengeführt. `meta` hat zusätzlich `akt` (Nummer des Akts). Am Datenmodell und an den Abnahmekriterien ändert sich sonst nichts.

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
- GSAP für Animationen ist erlaubt (kostenlos unter der GSAP Standard License, alle Plugins einschließlich Flip), ebenso reine CSS-Transitions und die Web Animations API. Das Ziehen bleibt eigene Logik mit Pointer Events (Abschnitt 7). Kein Three.js; die Atmosphäre-Ebene (Abschnitt 8) bleibt als leeres Modul vorbereitet.
- Vitest für Unit-Tests von `core` und für die Inhaltsvalidierung.
- Playwright für Screenshots der Hauptansichten (siehe Abschnitt 10) und für die e2e-Tests.
- **Browser und Testzuschnitt in CI (seit 0.4.1):** Chromium und Firefox führen alle e2e-Tests aus. WebKit (Safari) führt nur die Tests mit dem Tag `@smoke` aus, mit 2 Minuten Zeitlimit und ohne Wiederholung. Lange Tests tragen `@long` (Durchspieltests mit Maus und mit Tastatur, Prüfung der Text-Herkunft) und laufen nur bei Push auf `main`, nicht bei Pull Requests oder manuellen Läufen. Der `@smoke`-Satz deckt mindestens ab: Start und Unterpfad, Akte ziehen, Unterlagen herausziehen, Stempeln mit Maus und Tastatur, Zeitung, Zoom, Touch und Kodex. Neue e2e-Tests werden kurz gehalten. Abnahmekriterien „in Chromium, Firefox und WebKit“ gelten in diesem Zuschnitt.
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

- Der Loader liest alle `content/*.json` außer `ui.json` und `kalender.json`, sortiert nach Dateinamen, und führt sie zu einem Inhalt zusammen.
- Je Akt gibt es eine Datei (`akt1.json`, später `akt2.json` usw.). `meta` hat `version`, `akt`, `veranlagungsjahr`, `hinweis` und optional `kalenderStart` (Monat im Format `JJJJ-MM`, mit dem der Tischkalender in diesem Akt aufschlägt; ohne Angabe Jänner des Jahres nach `veranlagungsjahr`).
- `meta` kommt aus der ersten Datei. Jede Datei hat ein eigenes `meta.version`, die Versionen aller Dateien werden im Fehlerfall mit ausgegeben.
- `rules`, `days` und `cases` werden aneinandergehängt. Doppelte Regel-IDs, Akten-IDs oder Tagesnummern sind ein Fehler.
- `texts` wird schlüsselweise zusammengeführt. `texts.optionLabels` ist die Vereinigung aller Dateien. Kommt ein Schlüssel (auch in `optionLabels`) in zwei Dateien mit verschiedenem Wert vor, ist das ein Fehler. Pflichtschlüssel (`stampLabels`, `unnecessaryDelay`, `warning`, `emptyDay`) müssen nach dem Zusammenführen vorhanden sein, egal in welcher Datei.

### `texts`

- `optionLabels`: Anzeigename je Option, die als Zeichenkette angegeben ist (Schlüssel = Optionswert). Jeder Schlüssel muss in mindestens einer Entscheidung vorkommen.
- `stampLabels`: Anzeigename je Stempel.
- `unnecessaryDelay`: Fehlertext „Ergänzungsersuchen bei vollständiger Akte“.
- `warning`: `minErrors`, `from`, `text` der Ermahnung.
- `emptyDay`: Text für einen Tag ohne Akten.
- `wrongInquiry`: Fehlertext für eine Nachfrage, die den offenen Punkt nicht klärt. Pflicht nur, wenn eine Akte eine `inquiry` hat.
- `missedDiscrepancy`: Fehlertext für einen nicht markierten Widerspruch. Pflicht nur, wenn eine Akte `discrepancies` hat.
- `falseDiscrepancy`: Fehlertext für eine Markierung, die kein Widerspruch ist. Pflicht nur, wenn eine Akte `discrepancies` hat.

### `Rule`

`id`, `day` (ab welchem Tag freigeschaltet), `title`, `text`, `source`, `sourceUrl`, optional `hint: true` für einen Kodex-Hinweis ohne eigenen Fall. Eine Hinweisregel darf trotzdem von Entscheidungen referenziert werden.

### `Day`

`day`, `intro`, `stamps` (verfügbare Stempel), `cases` (IDs in Reihenfolge, darf leer sein), `storyEvents` (Liste in Anzeigereihenfolge), optional `traces` (Spuren für die Pinnwand, siehe unten).

### Story-Ereignisse (`storyEvents`)

Jedes Ereignis hat ein `type`. Die Felder je Typ:

| `type` | Felder | Darstellung |
| --- | --- | --- |
| `note` | `from`, `text`, optional `title`, optional `keep: "drawer"` | Zettel (wie bisher), `title` als Überschrift. Mit `keep: "drawer"` kommt der Zettel nach dem Anzeigen in die Lade (Abschnitt 7.7). |
| `dialog` | `from`, `text` | Sprechblase (wie bisher) |
| `newspaper` | `from` (Name der Zeitung), `headline`, `text` | Zeitungsblatt mit Kopf `from`, Schlagzeile und kurzem Text |
| `call` | `from`, `text` | Telefonhörer mit „Anruf von {from}“ und Text |
| `unlock` | `feature`: `calculator`, `calendar`, `pinboard` oder `drawer` | `calculator` schaltet ab diesem Tag den Tischrechner frei und zeigt `ui.intro.unlockCalculator`, `calendar` den Tischkalender mit `ui.intro.unlockCalendar`, `pinboard` die Pinnwand mit `ui.intro.unlockPinboard`, `drawer` die Lade mit `ui.intro.unlockDrawer`. |
| `event` | `id`, `text`, `options` (je `text`, `effects` mit `time`, `rating`, `gerri`, `home` als ganze Zahlen, `sets` als Liste von Merkern) | Ereigniskarte des Metagames. In dieser Version nur geprüft, nicht dargestellt. |
| `actSummary` | `act` (Zahl) | Nach der Tagesauswertung dieses Tages erscheint der Schlussbildschirm des Akts (Abschnitt 4). |

Ein unbekannter `type` ist ein Ladefehler. Jedes Story-Ereignis darf `provisional: true` tragen: Der Text ist eine Arbeitsfassung. Im Spiel hat das keine Wirkung, der Inhaltsbericht (Abschnitt 10) listet sie.

### Spuren (`traces`)

`id`, `label`, `links` (mindestens zwei, je `case` und entweder `document` mit `line` oder `field`), `reward` (`type: "note"`, `from`, `text`, optional `provisional: true`), optional `seed`. Eine Spur gehört zu dem Tag, unter dem sie steht. Dargestellt wird sie an der Pinnwand (Abschnitt 7.6).

`seed` (Vorarbeit): `from` (Figur, die die Karte geschrieben hat), `text` (Text der Karte), `links` (Liste von Indizes in `links`, mindestens einer, nicht alle), optional `provisional: true`. Zu Beginn des Tages der Spur hängen die Karte und die genannten Fundstellen an der Wand, untereinander mit Fäden verbunden, die Karte mit losem Faden. Heftet der Spieler eine weitere Fundstelle derselben Spur an, verbindet sich der Faden von selbst mit der zuletzt angehefteten Fundstelle der Vorarbeit. Ohne `seed` beginnt der Spieler die Spur selbst.

**Grundsatz:** Der Code kennt keine Figur, keine Firma und keinen Story-Text. Wer eine Karte schreibt, was darauf steht und wie viel Vorarbeit eine Spur hat, steht nur in den Daten.

Der Loader prüft:

- Jede verlinkte Akte, jedes Dokument (Titel) und jede Zeile (Label) existiert. Verlinkt werden nur die Unterlagen der Akte selbst, nicht die einer Folgeakte.
- `field` ist nur `representative`. Die Akte hat dann einen `representative` mit `stampVisible: true` und mindestens ein Dokument mit `stamp`, damit der Kanzleistempel zu sehen ist.
- Jede verlinkte Akte kommt spätestens am Tag der Spur in den Stapel.
- Spur-IDs sind über alle Tage eindeutig. Eine Fundstelle darf zu mehreren Spuren gehören.
- `seed.links` sind gültige, eindeutige Indizes in `links`, mindestens einer und weniger als alle. Die Akten der Vorarbeit kommen vor dem Tag der Spur in den Stapel, damit die Karte nur zeigt, was der Spieler schon gesehen hat.
- Ein Tag mit Spuren hat die Pinnwand an diesem oder einem früheren Tag freigeschaltet. Ein Zettel mit `keep: "drawer"` steht an einem Tag, an dem die Lade schon oder im selben Tag vorher freigeschaltet ist.

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

### Tischkalender (`content/kalender.json`)

- Eigene Datei mit eigener Versionsnummer (`meta.version`), wie `ui.json` unabhängig von den Akt-Dateien. `meta` hat zusätzlich `quelle` und `hinweis` (nur für Autoren, wird nicht angezeigt).
- `holidays.fixed`: feste Feiertage, je `date` im Format `MM-TT` und `name`.
- `holidays.easter`: bewegliche Feiertage, je `offset` (Tage nach Ostersonntag, ganze Zahl) und `name`.
- Inhalt: die gesetzlichen Feiertage nach § 7 Abs. 2 ARG (Fassung BGBl. I Nr. 22/2019). Karfreitag und 24. Dezember stehen bewusst nicht drin: Sie sind keine gesetzlichen Feiertage, zählen aber für das Fristende nach § 108 BAO. Das soll der Spieler aus Regel R14 wissen, nicht vom Kalender ablesen.
- Das Datum des Ostersonntags rechnet `core` mit einer reinen Funktion (gregorianischer Kalender). Das ist Kalenderrechnung, keine Steuerregel. Welche Tage Feiertage sind, steht nur im JSON.
- Der Loader prüft die Datei mit einem Schema: gültige Monats- und Tageswerte, Namen nicht leer, keine doppelten Daten.

### Oberflächentexte (`content/ui.json`)

- Eigene Datei mit eigener Versionsnummer, unabhängig von den Akt-Dateien, weil die Texte an keinem Spieltag hängen.
- Aufbau: ein flaches, nach Bereichen gegliedertes Objekt, zum Beispiel `settings`, `desk`, `codex`, `calculator`, `evaluation`, `title`, `end`, `aria`. Jeder Eintrag ist ein String. Platzhalter stehen als `{name}`, zum Beispiel `„Tag {day}“`.
- Der Code greift über eine typisierte Funktion `t("bereich.schluessel", { name: wert })` zu. Der Schlüsselraum ist als Typ abgeleitet, ein unbekannter Schlüssel ist ein Kompilierfehler.
- Der Loader prüft `ui.json` mit einem Schema. Fehlt ein Schlüssel oder ist einer zu viel, bricht der Start mit einer klaren Fehlermeldung ab.
- Leerzeichen am Anfang oder Ende eines Textes gehören zur Darstellung und bleiben erhalten.
- `ui.json` enthält keine Rechtsaussagen. Kodextexte, Regeln und Erklärungen bleiben in den Inhaltsdateien.
- Das Betragsformat (`1.200,00 €`) und das Einlesen eingegebener Beträge bleiben im Code. Ebenso die Namen von Monaten und Wochentagen im Tischkalender: Sie kommen aus `Intl.DateTimeFormat` mit `de-AT` („Jänner“), nicht als Textliteral.

## 4. Spielablauf

1. **Startbildschirm:** Titel, Hinweis auf Fiktion und Vereinfachung, Buttons „Neues Spiel“ und „Fortsetzen“.
2. **Tagesbeginn:** Karte mit „Tag N“ und `intro`-Text. Ein Spieldatum gibt es nicht, der Tag heißt nur „Tag N“. Daten in Belegen und Fristfällen sind Inhalt der Papiere und haben keine Wirkung auf den Ablauf. Danach die Story-Ereignisse des Tages in ihrer Reihenfolge (Abschnitt 3).
3. **Schreibtisch:** Aufbau nach Abschnitt 7.1. Links der Eingang mit dem Aktenstapel und Zähler, darunter die Werkzeuge: Kodex (Abschnitt 6), ab `unlock: calendar` der Tischkalender, ab `unlock: calculator` der Tischrechner. In der Mitte die Unterlage, darunter der Griff der Lade. Rechts ab `unlock: pinboard` die Pinnwand, darunter Telefon, Stempelhalter und Ausgangskorb.
4. **Akte bearbeiten:**
   - Der Spieler zieht die oberste Akte aus dem Eingang auf die Unterlage (oder klickt sie an, oder Enter bei Fokus). Sie schlägt sich auf: innen links der Prüfvermerk, rechts die Unterlagen in der Tasche (Abschnitt 7.2). Es liegt immer nur eine Akte am Tisch.
   - Der Prüfvermerk listet je nach Typ die Positionen (anerkennen, streichen), die Frage mit Optionen oder die Entscheidungen. Bei `entscheidungen` hat jede Zeile entweder Schaltflächen für die Optionen oder ein Eingabefeld für den Betrag. Das Eingabefeld akzeptiert Eingaben wie `4236,7`, `4.236,70` und `4236.70` und zeigt den Betrag nach dem Verlassen des Felds im Format `4.236,70 €`.
   - Bei Entscheidungen oder Positionen mit `offen` ist keine Option richtig. Der Spieler lässt sie unentschieden und stempelt das Ergänzungsersuchen.
   - **Widerspruch markieren:** Ein Schalter „Widerspruch markieren“ im Prüfvermerk schaltet einen Markiermodus ein. Darin wählt der Spieler eine Zeile in einem herausgezogenen Papier und dann eine Zeile in einem anderen herausgezogenen Papier derselben Akte. Papiere in der Tasche sind im Markiermodus nicht anklickbar. Das Paar erscheint als Markierung im Prüfvermerk und auf beiden Papieren. Markierungen lassen sich aufheben. Der Markiermodus ist bei jeder Akte verfügbar, auch ohne `discrepancies`, damit er nichts verrät. Die Zeilen sind nur im Markiermodus anklickbar, damit das Ziehen der Papiere nicht gestört wird. Im Prüfvermerk steht eine Liste der Paare mit „aufheben“ je Paar und „Markierungen aufheben“ für alle. Auch per Tastatur bedienbar.
   - **Nachfrage:** Hat die Akte eine `inquiry` und nimmt der Spieler den Stempel „Ergänzungsersuchen“ auf, erscheint im Prüfvermerk über dem Stempelfeld die Auswahl der Fragen (`prompt`, `options[].label`). Das Stempelfeld nimmt den Stempel erst nach der Wahl an. Legt der Spieler den Stempel zurück, schließt sich die Auswahl wieder. Akten ohne `inquiry` stempeln wie bisher.
   - **Anheften (ab Pinnwand):** Jede Zeile eines herausgezogenen Papiers oder eines Durchschlags zeigt beim Darüberfahren und bei Fokus eine Nadel (`aria.pinnableLine`). Ein Klick oder Enter darauf heftet die Zeile als Karte an die Pinnwand. Ein Klick auf einen Kanzleistempel heftet den Vertreter an (`field: representative`). Jede Zeile lässt sich anheften, nicht nur Fundstellen von Spuren, damit die Nadel nichts verrät. Im Markiermodus und mit aufgenommenem Stempel gibt es keine Nadeln. Papiere in der Tasche haben keine Nadel.
   - Der Spieler nimmt einen der verfügbaren Stempel aus dem Halter und drückt ihn auf das Stempelfeld des Prüfvermerks (Abschnitt 7.3). Dann schließt er die Akte, die Unterlagen kommen dabei zurück in die Mappe, und zieht sie in den Ausgangskorb. Erst dann lässt sich die nächste Akte aus dem Eingang nehmen. Der Stempel ist endgültig, danach sind Prüfvermerk, Markierungen und Nachfrage gesperrt.
5. **Tagesende:** Wenn der Stapel leer ist, erscheint die Auswertung.
6. **Folgeakten:** Eine Akte mit `followUp` kommt am angegebenen Tag zusätzlich in den Stapel, aber nur wenn der Spieler das Ergänzungsersuchen gestempelt hat. Sie kommt immer mit den Unterlagen aus `followUp.documents`, auch wenn die Nachfrage falsch gewählt war (der Fehler ist dann schon gezählt). Hat der Spieler einen Bescheid erlassen, kommt sie nicht. Folgeakten liegen im Stapel vor den Akten des Tages.
7. **Leere Tage:** Ist der Stapel eines Tages leer, zeigt das Spiel `texts.emptyDay` und geht direkt zur Auswertung.
8. **Abschluss eines Akts:** Nach der Auswertung eines Tages mit `actSummary` erscheint der Schlussbildschirm `ui.end` („Ende von Akt {act}“) mit der Übersicht Tag und Fehler. Gibt es danach keinen weiteren Tag, bleibt das Spiel dort stehen. Der Schlussbildschirm „Ende des Prototyps“ nach Tag 4 entfällt.
9. **Pinnwand:** ab `unlock: pinboard` (Abschnitt 7.6). Sie läuft neben den Akten her und hat keinen Einfluss auf Stapel, Bewertung oder Tagesende.
10. **Lade:** ab `unlock: drawer` (Abschnitt 7.7).

## 5. Bewertung und Auswertung

- Jede falsch entschiedene Position, jede falsche Option, jeder falsche Betrag und jeder falsche Stempel zählt als ein Fehler.
- Eine Position oder Entscheidung, die nicht entschieden wurde, obwohl sie laut Daten nicht `offen` ist, zählt als falsch. Ein leeres Betragsfeld zählt als falsch. Ist der richtige Betrag 0, muss der Spieler 0 eintippen (zum Beispiel Akte 10-2, Entscheidung d3).
- Ein Betrag ist richtig, wenn er auf den Cent mit `correct` übereinstimmt. Verglichen wird in ganzen Cent, nicht mit Gleitkommazahlen.
- Eine Option bei einer Entscheidung mit `offen` zählt als falsch.
- Ein Ergänzungsersuchen bei einer Akte ohne `offen` zählt als Fehler mit dem Text `texts.unnecessaryDelay`.
- **Widersprüche** werden nur bewertet, wenn die Akte `discrepancies` hat und der Spieler das Ergänzungsersuchen stempelt. Jeder Widerspruch aus den Daten, der nicht als Paar markiert ist (Reihenfolge von `a` und `b` egal), zählt als ein Fehler mit `texts.missedDiscrepancy`. Jede markierte Paarung, die in den Daten nicht vorkommt, zählt als ein Fehler mit `texts.falseDiscrepancy`. Bei einem Bescheid werden Markierungen ignoriert (der falsche Stempel ist schon ein Fehler).
- **Nachfragen:** Eine gewählte Frage, die nicht `inquiry.correct` ist, zählt als ein Fehler mit `texts.wrongInquiry`.
- Die Tagesauswertung zeigt pro Akte: richtig oder falsch, die richtige Lösung (bei Beträgen den richtigen Betrag und den eingegebenen), die `explanation`, bei Widersprüchen deren `explanation`, bei Nachfragen die gewählte und die richtige Frage samt `answer` der gewählten Frage, und die verlinkten Kodexregeln mit Fundstelle.
- Ab `texts.warning.minErrors` Fehlern an einem Tag erscheint die Ermahnung (`from`, `text`). Das hat weiterhin keine Folgen.
- **Sprung in den Kodex:** Jede verlinkte Regel in der Tagesauswertung ist eine Schaltfläche (zugängliche Beschriftung `ui.evaluation.ruleJump`). Sie öffnet den Lesemodus (6.2) an dieser Regel und setzt `codex.lastRuleId`. Escape oder Schließen führt zurück in die Auswertung, der Fokus liegt wieder auf der Schaltfläche.
- **Pinnwand und Spuren** erzeugen keine Fehler und erscheinen nicht in der Fehlerzahl. Ein Faden, der nicht hält, zählt nur in `pinboard.misses` (Abschnitt 9) und hat in dieser Version keine Wirkung.
- Die Bewertung ist eine reine Funktion in `core` und vollständig getestet.

## 6. Kodex als Buch

Leitidee: Der Kodex ist eine Loseblattsammlung im Leinenband, wie sie in Amtsstuben steht. Jeden Tag kommt eine Ergänzungslieferung dazu, die in den Einband eingeordnet wird. Das Buch wird dadurch sichtbar dicker. Inhalt, Freischaltung, „neu“, Hinweis, Suche, „vereinfacht“ und Fundstelle bleiben wie bisher, nur Darstellung und Bedienung ändern sich.

### 6.1 Zugeklappt (auf dem Schreibtisch)

- Der Kodex liegt zugeklappt auf seinem Platz in der linken Werkzeugleiste (Abschnitt 7.1), um wenige Grad gedreht. Der Einband ist dunkelrotes Leinen mit Goldprägung: Titel „KODEX“ (`ui.codex.coverTitle`), darunter `ui.codex.coverSubtitle` und `ui.codex.coverStand` („Stand: Tag {day}“). Am Rücken sind Bünde angedeutet, am Schnitt sind die Blätter als feine Linien zu sehen.
- Die Dicke des Buchblocks wächst mit der Zahl der freigeschalteten Tage. Das ist ein reiner CSS-Wert aus der Anzahl, keine Bilddatei.
- Solange der Spieler die heutige Lieferung noch nicht aufgeschlagen hat, ragt ein Zettel „neu“ (`ui.codex.new`) aus dem Buch. Er verschwindet, sobald die erste Seite der heutigen Lieferung gesehen wurde.
- Klick, Enter, Leertaste oder Ziehen auf die Unterlage legen das Buch aufgeschlagen auf den Tisch (6.1a). Die Schaltfläche trägt `ui.codex.open`. Taste K öffnet von überall den Lesemodus (6.2).

### 6.1a Am Tisch aufgeschlagen

- Wird der Kodex auf die Unterlage gezogen, klappt beim Loslassen der Einband auf und das Buch liegt als kleine Doppelseite an der Stelle, an der es abgelegt wurde (Effekte „voll“: Einband dreht sich um den Rücken, etwa 500 ms; „reduziert“: Überblendung bis 120 ms; „aus“: sofort). Wird es angeklickt statt gezogen, gleitet es an einen freien Platz der Unterlage.
- Größe am Tisch etwa ein Drittel des Lesemodus, sodass Akte und Buch nebeneinander Platz haben (Richtwert im Prototyp: zwei Seiten zu je 230 × 300 Pixel auf einer Unterlage von 760 × 700). Der Seitenumbruch (6.8) läuft für diese Größe eigens, die Leseposition bleibt über die Regel-ID dieselbe wie im Lesemodus.
- Am Tisch: Blättern (Eckenschaltflächen, Pfeiltasten bei Fokus), Sprung aus dem Inhaltsverzeichnis, Lesezeichenband, Fußnote mit „vereinfacht“ und Fundstelle. Suche und Griffregister gibt es nur im Lesemodus.
- Schaltflächen am Buch: `ui.codex.readMode` öffnet den Lesemodus an derselben Stelle, `ui.desk.putBack` klappt das Buch zu und legt es auf seinen Platz zurück. Zurückziehen auf die linke Leiste tut dasselbe.
- Das Buch am Tisch lässt sich wie ein Papier verschieben und liegt nach dem Anfassen oben. Es darf die Akte überdecken.
- Gesperrte Regeln stehen auch am Tisch nirgends im DOM (6.4).

### 6.2 Lesemodus

- Taste K oder `ui.codex.readMode` öffnet das Buch als große Doppelseite, zentriert über dem Tisch, höchstens 1120 × 760 Pixel und mit dem Fenster skaliert. Der Tisch dahinter ist abgedunkelt. Beim Aufschlagen klappt der Einband auf (Effekte „voll“, etwa 400 ms), bei „reduziert“ blendet das Buch ein, bei „aus“ steht es sofort da.
- Schließen mit Escape, Klick neben das Buch, Taste K oder der Schaltfläche `ui.codex.close`. Der Fokus kehrt dorthin zurück, wo er vorher war (Buch in der Leiste, Buch am Tisch oder Akte). Lag das Buch am Tisch, liegt es danach weiter dort, an der zuletzt gelesenen Stelle.
- Unter 900 Pixel Fensterbreite zeigt das Buch eine Einzelseite statt einer Doppelseite. Blättern geht dann auch per Wischen.
- Hinter dem Buch steht der Tisch. Zum Vergleichen mit der Akte öffnet und schließt man das Buch schnell mit K, die Seite bleibt erhalten (6.7).

### 6.3 Seitenaufbau

- **Papier:** gebrochenes Weiß, feiner und dünner als die Akten, in der Mitte ein Schattenverlauf für den Falz. Die Blätter der heutigen Lieferung sind etwas heller (frisch eingelegt) und haben am Außenrand einen schmalen roten Streifen.
- **Schrift:** Antiqua mit Serifen, lokal eingebunden (Vorschlag EB Garamond, SIL OFL, Lizenz in `QUELLEN.md`). Die Zeitung bleibt bei Old Standard TT. Blocksatz mit automatischer Silbentrennung (`lang="de-AT"`), Überschriften in Kapitälchen.
- **Kopfzeile:** links `ui.codex.runningHeadLeft` („Kodex“), rechts `ui.codex.runningHeadRight` („Lieferung Tag {day}“) für die Lieferung, zu der die Seite gehört. Seitenzahl unten außen. Das Vorspann-Register ist mit römischen Zahlen nummeriert, die Regelseiten mit arabischen.
- **Regel:** In der Randspalte steht die Regel-ID (zum Beispiel R12) wie eine Randzahl. Daneben der Titel fett, darunter der Text. Am Ende der Regel eine Fußnotenzeile mit `ui.codex.simplified` und der Fundstelle (Link zu `sourceUrl`), klein und kursiv. Links sind in Buchfarbe, nicht im Browser-Blau, und haben einen sichtbaren Fokus.
- **Neue Regeln:** Regeln der heutigen Lieferung tragen den kleinen Vermerk `ui.codex.new` am Rand.
- **Hinweisregeln** (`hint: true`) stehen in einem Kasten mit feinem Rahmen und grauem Grund. Über dem Kasten steht `ui.codex.hint`, dazu ein kleines Zeigefinger-Symbol als SVG.
- **Lieferungen:** Jede Lieferung beginnt auf einer neuen Seite mit Lieferungskopf (`ui.codex.deliveryHeading`, „Lieferung Tag {day}“) und einer feinen Zierlinie. Eine Regel wird nicht über zwei Seiten zerrissen. Ist eine Regel länger als eine Seite (zum Beispiel R9), darf sie umbrechen.

### 6.4 Gliederung des Buchs

1. **Inhaltsverzeichnis** (`ui.codex.register`), eine oder mehrere Seiten. Gruppiert nach Lieferung, je Regel eine Zeile: Regel-ID, Titel, Punktlinie, Seitenzahl. Klick springt zur Regel. Hinweisregeln tragen ein kleines Hinweis-Symbol.
2. **Lieferung Tag 1 bis zum aktuellen Tag**, jede Regel an der Stelle ihres Tags.
3. **Gesperrte Lieferungen:** Für jeden noch gesperrten Tag folgt danach eine leere, nur liniierte Seite mit dem Aufdruck `ui.codex.locked` („Gesperrt – ab Tag {day}“) und mit `ui.codex.lockedSheet`. Im Inhaltsverzeichnis stehen gesperrte Tage als eine Zeile `ui.codex.locked` ohne Regel-IDs und Titel.
4. **Freischaltung:** Regeln mit `day` kleiner oder gleich dem aktuellen Tag sind lesbar. Der Text, der Titel und die Fundstelle gesperrter Regeln stehen nirgends im DOM, auch nicht versteckt.

### 6.5 Griffregister, Lesezeichen und Blättern

- **Griffregister** am rechten Buchschnitt: ein Reiter „Inhalt“ (`ui.codex.tabRegister`) und je ein Reiter pro Tag des Akts (`ui.codex.day`). Freigeschaltete Reiter springen zur ersten Seite der Lieferung, der Reiter der Lieferung, in der gerade gelesen wird, ist hervorgehoben (`aria-current`). Gesperrte Reiter sind blass, tragen ein Schloss, sind nicht anklickbar (`aria-disabled`) und haben die Beschriftung `ui.codex.locked`. Der Reiter der heutigen Lieferung trägt „neu“, bis sie gesehen wurde.
- **Lesezeichenband:** Ein Band am Rücken liegt auf der zuletzt gelesenen Seite. Beim erneuten Öffnen öffnet das Buch dort (6.7).
- **Blättern:** Pfeil-Schaltflächen an den unteren Seitenecken (`ui.codex.nextPage`, `ui.codex.prevPage`), Pfeiltasten links und rechts, Bild auf und ab, Pos1 und Ende (zum Inhaltsverzeichnis und zur letzten lesbaren Seite), Klick auf die Seitenränder, Wischen auf Touch-Geräten. Es wird immer eine ganze Doppelseite (beziehungsweise Einzelseite) weitergeblättert.
- **Animation je Effekt-Einstellung:** „voll“: Umblättern in 3D um den Falz mit wanderndem Schatten, etwa 350 bis 450 ms. „reduziert“: Überblendung, höchstens 120 ms. „aus“: sofort. Es werden nur `transform` und `opacity` animiert.
- **Ton:** Beim Aufschlagen und Blättern das vorhandene Papierrascheln, beim Zuklappen der vorhandene Ablageton. Keine neuen Klangdateien.

### 6.6 Suche

- Ein Suchfeld oben am Buch (`ui.codex.searchPlaceholder`, zugängliche Beschriftung `aria.codexSearch`).
- Beim Tippen ersetzt die Trefferliste das Inhaltsverzeichnis auf der linken Seite (bei Einzelseite die aktuelle Seite). Jeder Treffer zeigt Regel-ID, Titel, Lieferung und einen kurzen Ausschnitt mit markierter Fundstelle. Die Anzahl steht in `ui.codex.hits`, ohne Treffer steht `ui.codex.noHits`.
- Klick auf einen Treffer blättert zur Regel. Die gefundenen Wörter sind dort wie mit einem Textmarker hinterlegt, solange die Suche besteht. `ui.codex.searchClear` löscht die Suche, danach steht wieder das Inhaltsverzeichnis da.
- Gesucht wird in Titel und Text der freigeschalteten Regeln. Die Suche findet Teilwörter, ignoriert Groß- und Kleinschreibung und faltet Umlaute und ß (Suche „abzugsfahig“ findet „abzugsfähig“, „strasse“ findet „Straße“). Die Eingabe einer Regel-ID wie „R12“ findet diese Regel.
- Die Suchlogik ist eine reine Funktion in `core` (Abschnitt 6.8).

### 6.7 Merken der Seite

- Das Spiel merkt sich die zuletzt gelesene Regel (oder das Inhaltsverzeichnis) und den Tag, bis zu dem der Spieler die Lieferung gesehen hat (`codex.lastRuleId`, `codex.seenDay` im Spielstand, Abschnitt 9).
- Beim Öffnen am selben Tag öffnet das Buch an der gemerkten Stelle. Gibt es eine neue, ungesehene Lieferung, öffnet es stattdessen auf deren erster Seite.
- Gemerkt wird die Regel, nicht die Seitenzahl, weil sich Seitenzahlen mit der Fenstergröße ändern können.

### 6.8 Technische Umsetzung

- **core:** `src/core/codex.ts` mit reinen Funktionen: sichtbare Regeln für einen Tag, Gruppierung nach Lieferung, gesperrte Tage, `normalizeForSearch`, Suche mit Treffern und Ausschnitt, römische Zahlen. Kein DOM, vollständig getestet.
- **Seitenumbruch (ui):** Die Seiten entstehen durch CSS-Spalten, die auf die Seitengröße gesetzt und mit `translateX` weitergeschoben werden. Die Texte bleiben echtes HTML, daher sind Suche, Auswahl und Screenreader unverändert möglich. Der Umbruch wird neu berechnet beim Öffnen, bei Größenänderung, nach `document.fonts.ready` und wenn ein neuer Tag Regeln freischaltet. Nach einem Neuumbruch bleibt die Leseposition über die Regel-ID erhalten.
- **Nicht sichtbare Seiten** sind `inert`, damit der Fokus nie auf eine Seite fällt, die gerade nicht zu sehen ist, und Screenreader nur die sichtbare Seite lesen.
- **Rolle:** Das aufgeschlagene Buch ist ein `dialog` (`aria-modal`, Name `aria.codex`) mit Fokusfalle. Jede Seite ist eine Region mit Name `aria.codexPage` („Seite {n}“), eine gesperrte Seite trägt `aria.lockedPage`. Das Griffregister ist eine Navigation mit Name `aria.bookmarks`.
- **Texte:** Alle Beschriftungen stehen in `ui.json`. Die Regeltexte kommen aus den Inhaltsdateien.
- **Fallback:** Fällt die 3D-Animation aus oder werden die Effekte reduziert, funktioniert alles ohne Verlust (Überblendung oder sofortiger Wechsel).

## 7. Schreibtisch, Optik und Gefühl

Referenz ist der HTML-Prototyp aus der Konzeptphase: Holztisch, grüne Schreibunterlage, Papiere in leicht gebrochenem Weiß mit Schreibmaschinenschrift (Courier Prime, OFL, lokal eingebunden).

- **Ziehen:** Pointer Events für Maus und Touch. Beim Aufnehmen leicht vergrößern, Schatten weicher und länger, Neigung je nach Zugrichtung. Beim Loslassen kurze Ablege-Animation. Das zuletzt angefasste Papier liegt oben. Nur `transform` animieren. Ein Papier lässt sich nie so weit ablegen, dass ein Teil seiner Fläche, auch gedreht, vom Rand der Unterlage abgeschnitten wird.
- **Ziehen per Tastatur:** Ein fokussiertes Papier lässt sich mit den Pfeiltasten verschieben. Ziehen ist für keine Entscheidung nötig: Jeder Schritt des Ablaufs hat auch einen Weg per Klick und per Tastatur (Abschnitt 7.1 bis 7.5).
- **Papier:** feine Papierstruktur (SVG-Rauschfilter oder kleine Textur), zufällige Drehung von ein bis zwei Grad, Büroklammern bei Belegen.
- **Viele Papiere:** Akten haben bis zu sechs Papiere. In der Tasche der Mappe liegen sie leicht versetzt, sodass jeder Titel zu sehen ist. Herausgezogen ordnet der Spieler sie selbst, sie dürfen sich überdecken. Das zuletzt angefasste Papier liegt oben.
- **Stempel:** Aufschlag mit kurzer Skalierungs-Animation und leichtem Wackeln der Mappe (nur bei „voll“). Der Abdruck bleibt auf dem Stempelfeld des Prüfvermerks sichtbar, an der zugeklappten Mappe als kleiner Abdruck auf dem Deckel.
- **Kanzleistempel:** Dokumente mit `stamp` zeigen unten links einen blassen Kanzleistempel.
- **Morgenzeitung:** ein schmales Zeitungsblatt mit Kopfzeile in Antiqua-Anmutung (lokal eingebundene freie Schrift, Lizenz in `QUELLEN.md`), Schlagzeile groß, Text in Spalten. Es liegt beim Tagesbeginn auf dem Tisch und lässt sich wie ein Papier ziehen und zoomen, bis der Tag endet.
- **Anruf:** kurzes Klingeln (CC0, Quelle in `QUELLEN.md`), dann der Text als Sprechblase neben einem Telefon.
- **Tischrechner:** ein kleines Gerät mit Ziffern 0 bis 9, Komma, + − × ÷, = und C, per Maus und Tastatur bedienbar. Die Anzeige nutzt das österreichische Zahlenformat. Der Rechner rechnet in Eingabereihenfolge wie ein einfacher Tischrechner (2 + 3 × 4 = 20) und überträgt nichts automatisch in den Prüfvermerk. Division durch null zeigt `ui.calculator.error`.
- **Markierungen:** Markierte Zeilen bekommen einen roten Bleistiftrahmen mit kleiner roter Nummer, je Paar dieselbe.
- **Lesbarkeit:** Doppelklick auf ein Papier oder Enter beziehungsweise Leertaste bei Fokus zoomt es lesbar heran. Erneuter Doppelklick oder Escape legt es zurück.
- **Sound:** Stempel (3 Varianten), Papierrascheln (2), Ablage (2, auch beim Ausgangskorb), Telefonklingeln und leises Büro-Ambiente. Das Blättern im Kodex nutzt das Papierrascheln, das Zuklappen den Ablageton. Alle Klangdateien sind CC0, Quellen und Bearbeitungen stehen in `public/audio/QUELLEN.md`. Ton startet erst nach der ersten Nutzeraktion. Fällt der Ton aus, läuft das Spiel unverändert weiter.
- **Musik (Akt 1):** Ein eigenes, synthetisch erzeugtes 16-Bit-Arrangement des Walzers Nr. 1 aus „G'schichten aus dem Wienerwald“ von Johann Strauß (Sohn, gemeinfrei) als nahtlose Schleife. Das Arrangement entsteht aus eigener Notation mit `tools/music/wienerwald16-loop.mjs`, nicht aus einer Aufnahme oder einer geschützten Notenausgabe. Die Musik hat einen eigenen Lautstärkeregler (Standard 0,5, 0 ist aus), getrennt vom Regler für die Effekte. Bei 0 wird sie weder geladen noch dekodiert; wird sie dabei abgeschaltet, blendet sie in 80 ms aus, und beim Wiedereinschalten setzt sie an derselben Stelle fort. Für spätere Akte ist ein eigenes Stück je Akt vorgesehen. Jede Musikquelle steht in `QUELLEN.md`.
- **Einstellungen:** Effekte aus, reduziert oder voll. `prefers-reduced-motion` setzt automatisch „reduziert“. Dazu Lautstärke (Soundeffekte) und Musiklautstärke. Lautstärke 0 und Musik 0 bedeuten aus.
- **Bedienbarkeit ohne Maus:** Alle Entscheidungen, Betragsfelder, Markierungen, Nachfragen, der Rechner, der Kalender, die Stempel, das Öffnen, Schließen und Ablegen der Akte sind per Tastatur erreichbar. Fokus ist sichtbar.

### 7.1 Tischplan

- Der Tisch ist eine Bühne mit fester logischer Größe, die als Ganzes auf das Fenster skaliert wird (wie im Prototyp `auftraege/05-prototyp-arbeitstisch.html`). Bei 1280 × 720 passt der ganze Tisch ohne Scrollen ins Fenster. Wo die Schrift dadurch klein wird, hilft der Zoom (Doppelklick).
- **Links, Werkzeugleiste:** oben der Eingang (Aktenstapel mit Zähler `ui.desk.stack`), darunter die Plätze für Kodex, Kalender und Rechner. Ein Werkzeug, das noch nicht freigeschaltet ist, hat keinen Platz in der Leiste und keinen Eintrag im DOM.
- **Mitte, Unterlage:** die grüne Schreibunterlage. Hier liegen die offene Akte, herausgezogene Papiere, Kodex, Kalender, Rechner und die Morgenzeitung. Nichts lässt sich so ablegen, dass es über den Rand der Unterlage ragt.
- **Rechts:** oben das Telefon für Anrufe, darunter der Stempelhalter mit den Stempeln des Tages (`Day.stamps`), unten der Ausgangskorb (`ui.desk.outbox`) mit Zähler.
- **Ablageflächen als Daten:** Eingang, Werkzeugplätze, Unterlage, Stempelhalter, Ausgangskorb, Pinnwand (ab Tag 7) und Lade stehen in einer einzigen Tabelle im Code (Name, Lage, was dort angenommen wird).
- **Pinnwand und Lade am Tisch (ab 0.5.0):** Die Pinnwand hängt als Korkfläche oben in der rechten Leiste über dem Telefon. Stempelhalter und Ausgangskorb dürfen dafür niedriger werden. Die Lade hat einen Griff an der Vorderkante des Tisches unter der Unterlage. Die Unterlage darf dafür unten etwas kürzer werden. Weicht die Lage ab, weil sonst etwas nicht passt, im Bericht begründen.
- **Ziehen zwischen Flächen:** Beim Loslassen entscheidet die Fläche unter dem Zeiger. Nimmt sie das Objekt nicht an, gleitet es an seinen letzten gültigen Platz zurück, mit kurzer Meldung, wenn es einen Grund gibt (zum Beispiel `ui.desk.oneAkteOnly`). Meldungen stehen in einer Live-Region.

### 7.2 Akte als Mappe

- **Zugeklappt** ist die Akte ein Aktendeckel aus Karton mit Reiter (Aktenzahl) und Name des Pflichtigen. So liegt sie im Eingang und nach dem Schließen auf der Unterlage.
- **Öffnen:** Ziehen aus dem Eingang auf die Unterlage, Klick oder Enter. Liegt schon eine Akte am Tisch (offen oder zugeklappt), wird die neue nicht angenommen (`ui.desk.oneAkteOnly`). Folgeakten liegen im Eingang oben (wie bisher).
- **Aufgeschlagen:** Beim Öffnen dreht sich der Deckel nach links (Effekte „voll“ etwa 500 ms). Innen links liegt der Prüfvermerk mit allen Entscheidungen, Markierungen und dem Stempelfeld (`ui.desk.stampField`) unten. Innen rechts die Tasche mit den Unterlagen (`ui.desk.pocket`), leicht versetzt. Oben am Deckel eine Leiste mit Aktenkopf und der Schaltfläche `ui.desk.closeAkte`. An dieser Leiste lässt sich die offene Mappe verschieben.
- **Größe:** Die Mappe wächst in der Höhe mit dem Prüfvermerk bis zur Höhe der Unterlage. Ist der Prüfvermerk länger, scrollt er in sich. Das Stempelfeld bleibt dabei immer sichtbar.
- **Unterlagen herausziehen:** Ziehen aus der Tasche auf die Unterlage, oder Klick (Enter) auf ein Papier in der Tasche legt es an einen freien Platz neben der Mappe. Zurück kommt ein Papier, indem man es auf die Tasche zieht. Enter bei einem herausgezogenen Papier zoomt es wie bisher. Per Tastatur kommen die Papiere mit `ui.desk.closeAkte` alle auf einmal zurück.
- **Schließen:** `ui.desk.closeAkte` lässt alle herausgezogenen Papiere in die Tasche zurückfliegen (Effekte „voll“ etwa 300 ms, gestaffelt), dann klappt der Deckel zu. Die zugeklappte Akte bleibt an ihrer Stelle auf der Unterlage. Klick oder Enter auf die zugeklappte Akte schlägt sie wieder auf, solange sie nicht im Ausgangskorb liegt.
- **Ablegen:** Die zugeklappte, gestempelte Akte wird in den Ausgangskorb gezogen. Alternativ trägt sie die Schaltfläche `ui.desk.outboxButton`. Ohne Stempel wird sie nicht angenommen (`ui.desk.stampFirst`). Eine offene Akte wird nicht angenommen (`ui.desk.closeFirst`).

### 7.3 Stempel nehmen und aufdrücken

- Klick oder Enter auf einen Stempel im Halter nimmt ihn auf: Der Stempel folgt dem Zeiger, sein Platz im Halter ist leer, das Stempelfeld ist hervorgehoben, `ui.desk.stampTaken` erscheint in der Live-Region.
- Klick auf das Stempelfeld drückt ihn auf. Per Tastatur drückt Enter den aufgenommenen Stempel aufs Stempelfeld der offenen Akte.
- Escape, Rechtsklick, ein Klick neben das Stempelfeld oder ein zweiter Klick auf den Halter legen den Stempel zurück. Während ein Stempel aufgenommen ist, lässt sich nichts ziehen.
- Ohne offene Akte lässt sich kein Stempel aufnehmen (`ui.desk.noOpenAkte`), bei einer gestempelten Akte auch nicht (`ui.desk.alreadyStamped`).

### 7.4 Werkzeuge

- Kodex, Kalender und Rechner haben je einen festen Platz in der Leiste. Ziehen auf die Unterlage, Klick oder Enter legen das Werkzeug aufgeschlagen auf die Unterlage. Zurückziehen auf die Leiste oder die Schaltfläche `ui.desk.putBack` legt es zugeklappt an seinen Platz zurück.
- Auf der Unterlage lassen sich Werkzeuge wie Papiere verschieben, das zuletzt angefasste liegt oben.
- Der Rechner bleibt wie in Abschnitt 7 beschrieben, nur sein Platz ändert sich.
- Am Tagesende und beim Neuladen liegen alle Werkzeuge wieder zugeklappt auf ihrem Platz.

### 7.5 Tischkalender

- Ab dem Tag mit `unlock: calendar` liegt in der Leiste ein Tischkalender (zugeklappt: Block mit Ringbindung, Jahr und Monat).
- Aufgeschlagen ein Monatsblatt: Kopf mit Monat und Jahr (`ui.calendar.monthYear`, Namen über `Intl.DateTimeFormat` mit `de-AT`), Schaltflächen `ui.calendar.prevMonth` und `ui.calendar.nextMonth`, Wochen von Montag bis Sonntag. Samstage und Sonntage sind getönt, Sonntage und Feiertage aus `content/kalender.json` haben rote Ziffern. Der Name eines Feiertags steht in der zugänglichen Beschriftung (`aria.calendarHoliday`) und als Tooltip.
- Es gibt keine Markierung für „heute“, weil das Spiel kein Datum kennt (Abschnitt 4).
- Der Kalender schlägt mit `meta.kalenderStart` des aktuellen Akts auf. Blättern geht beliebig weit vor und zurück.
- **Tage zählen:** Ein Klick auf einen Tag setzt den Beginn (`ui.calendar.countStart`), ein Klick auf einen zweiten Tag das Ende. Dazwischen liegende Tage sind hinterlegt, darunter steht der Abstand in Kalendertagen (`ui.calendar.countResult`, bei 1 `ui.calendar.countResultOne`). Ein dritter Klick beginnt neu. Ohne Auswahl steht `ui.calendar.countHint` da. Der Kalender rechnet keine Fristen aus und überträgt nichts in den Prüfvermerk.
- Monatswechsel und Auswahl werden nicht gespeichert.

### 7.6 Pinnwand

Referenz für Ablauf und Gefühl ist der Prototyp `auftraege/06-prototyp-pinnwand.html`.

- **Am Tisch:** Vor `unlock: pinboard` hat die Pinnwand keinen Platz und keinen Eintrag im DOM. Danach zeigt die Korkfläche in der rechten Leiste die Zahl der Karten (`ui.pinboard.cardCount`) und eine Marke `ui.pinboard.new`, solange eine neu gelöste Spur noch nicht angesehen wurde. Klick, Enter oder Taste P öffnen die Pinnwand-Ansicht. Eine Karte, die beim Anheften entsteht, fliegt kurz zur Korkfläche (Effekte „voll“, sonst sofort), `ui.pinboard.pinned` steht in der Live-Region, beim selbsttätigen Verbinden mit einer Vorarbeit `ui.pinboard.seedJoined`.
- **Pinnwand-Ansicht:** ein Dialog über dem Tisch wie der Lesemodus des Kodex. Links die Liste `ui.pinboard.archive` mit allen abgelegten Akten nach Tag (`ui.pinboard.archiveDay`), rechts die Korkwand. Schließen mit Escape, P oder `ui.pinboard.close`. Der Fokus kehrt zurück.
- **Durchschläge:** Jede Akte, die im Ausgangskorb liegt, hat einen Durchschlag (`ui.pinboard.copy`): Kopf der Akte, alle Unterlagen mit Kanzleistempel, ohne Prüfvermerk und ohne Lösung. Folgeakten haben einen eigenen Durchschlag mit ihren Unterlagen. Ein Durchschlag öffnet sich in der Pinnwand-Ansicht neben der Wand. Seine Zeilen haben Nadeln wie auf dem Tisch.
- **Karten:** zeigen Akte und Name (`ui.pinboard.cardTitle`), Dokument und Zeile (`ui.pinboard.cardLine`) und den Wert, beim Vertreter `ui.pinboard.cardStamp`. Eine Fundstelle hängt höchstens einmal (`ui.pinboard.alreadyPinned`). Höchstens 40 Karten (`ui.pinboard.full`). Karten lassen sich frei verschieben (Ziehen, Pfeiltasten, mit Umschalt in größeren Schritten), nicht über den Rand der Wand. `ui.pinboard.remove` nimmt eine Karte samt ihren Fäden ab.
- **Vorarbeit (`seed`):** Zu Beginn des Tages einer Spur mit `seed` hängt an der Wand eine Karte der Figur (`ui.pinboard.seedFrom`, Text aus `seed.text`) mit losem Faden, daneben die Fundstellen aus `seed.links` als Karten mit dem Vermerk `ui.pinboard.seedPinned`, untereinander verbunden. Zum Tagesbeginn erscheint die Karte außerdem als Zettel (`ui.pinboard.seedNotice`), damit der Spieler sie liest, ohne die Pinnwand zu öffnen. Karten der Vorarbeit lassen sich verschieben, aber nicht abnehmen. Jede Spur bekommt an der Wand eine eigene Zeile: links die Karte der Figur, rechts die Fundstellen, darunter nach dem Lösen der Zettel.
- **Fäden:** Eine Karte auf eine andere ziehen spannt einen Faden, die Zielkarte leuchtet beim Darüberziehen auf. Ohne Ziehen: `ui.pinboard.threadStart` (oder Taste F bei fokussierter Karte) startet einen Faden, die nächste angeklickte Karte (oder Enter auf ihr) ist das Ende. `ui.pinboard.threadTarget` steht dabei in der Live-Region, Escape bricht ab. Ein Faden hält, wenn beide Karten Fundstellen derselben Spur sind (`ui.pinboard.threadHeld`), egal an welchem Tag die Spur steht. Sonst fällt er herunter (Effekte „voll“: kurze Fallanimation), `ui.pinboard.noMatch` erscheint und `pinboard.misses` steigt um eins. Doppelte Fäden gibt es nicht. `ui.pinboard.threadRemove` löst die Fäden einer Karte.
- **Spur gelöst:** Eine Spur gilt als gelöst, wenn zu jedem ihrer Links eine Karte hängt, diese Karten durch gehaltene Fäden zusammenhängen und der aktuelle Tag mindestens der Tag der Spur ist. Dann erscheint ihr Zettel (`reward`) an der Wand unter den Karten der Spur mit der Überschrift `ui.pinboard.solved` (enthält `label`), dazu `ui.pinboard.solvedNotice`. Ist die Spur schon vor ihrem Tag verbunden, erscheint der Zettel zu Beginn ihres Tages nach den Story-Ereignissen. Eine gelöste Spur bleibt gelöst, auch wenn Karten oder Fäden später entfernt werden. Der Zettel bleibt an der Wand und lässt sich zoomen wie ein Papier.
- **Leere Wand:** `ui.pinboard.empty`. Keine erledigten Akten: `ui.pinboard.archiveEmpty`.
- **Logik in `core`:** Schlüssel einer Fundstelle, Spuren einer Fundstelle, Prüfung eines Fadens, gelöste Spuren zu Karten, Fäden und Tag, Liste der Durchschläge aus dem Spielstand. Alles reine Funktionen mit Tests.

### 7.7 Lade

- Der Griff der Lade ist von Tag 1 an zu sehen (Ausnahme zur Regel „kein Platz vor der Freischaltung“, weil die Lade ein Teil des Tisches ist). Vor `unlock: drawer` zeigt ein Klick `ui.drawer.stuck`, die Lade ruckelt kurz (nur bei „voll“).
- Ab `unlock: drawer` öffnen Klick oder Enter die Lade-Ansicht (`ui.drawer.title`), ein Dialog wie die Pinnwand. Darin liegen alle Zettel mit `keep: "drawer"` der Tage bis heute in der Reihenfolge, in der sie kamen. Sie lassen sich lesen und zoomen, aber nicht anheften. Leer: `ui.drawer.empty`. Schließen mit Escape oder `ui.drawer.close`.
- Ein Zettel mit `keep: "drawer"` erscheint beim Tagesbeginn wie jeder Zettel. Danach steht `ui.drawer.stored` in der Live-Region.
- Die Lade braucht keinen eigenen Spielstand: Ihr Inhalt ergibt sich aus dem Inhalt und dem aktuellen Tag.

## 8. Atmosphäre (vorbereitet)

`src/ui/atmosphere` exportiert `mount(container)` und `setQuality(level)`. Das ist weiterhin ein Stub. Später kommt hier eine Ebene über dem Tisch mit `pointer-events: none` dazu, zuerst in leichter Form (CSS-Lichtkegel, 2D-Staub), danach optional Three.js. Das Spiel muss ohne diese Ebene vollständig funktionieren.

## 9. Speichern

- Automatisches Speichern nach jeder gestempelten Akte und am Tagesende.
- Gespeichert werden: aktueller Tag, Ergebnisse je Akte (inklusive eingegebener Beträge, Markierungen und gewählter Nachfrage), Fehler je Tag, offene Folgeakten, freigeschaltete Werkzeuge, Einstellungen, Kodex-Lesestand (`codex.lastRuleId`: ID der zuletzt gelesenen Regel oder leer für das Inhaltsverzeichnis, und `codex.seenDay`: höchster Tag, dessen Lieferung der Spieler gesehen hat). Ein älterer Spielstand ohne `codex` bekommt `lastRuleId` leer und `seenDay` 0, der Rest bleibt erhalten.
- Die Einstellungen sind `effects` (aus, reduziert, voll), Lautstärke (0 = aus) und `music` (Musiklautstärke, Standard 0,5, 0 = aus). Ein älterer Spielstand ohne einzelne Felder bekommt für diese die Standardwerte aus `DEFAULT_SETTINGS`, ohne dass der übrige Spielstand verloren geht.
- **Spielstände aus Version 0.2:** Ein Spielstand, der an Tag 4 oder danach steht (Ende des Prototyps), wird so übernommen, dass der Spieler mit Tag 4 weiterspielt. Die Ergebnisse von Tag 1 bis 3 bleiben erhalten. Die Folgeakte von 3-4 kommt an Tag 4, wenn sie damals offen war. Ein Test deckt das ab.
- **Pinnwand (ab 0.5.0):** `pinboard` mit `cards` (je `id`, `ref` als `{ case, document, line }` oder `{ case, field }`, bei Unterlagen einer Folgeakte zusätzlich `followUp: true`, und Lage `x`, `y` auf der Wand), `threads` (Paare von Karten-IDs), `solved` (IDs gelöster Spuren), `seenSolved` (IDs, deren Zettel der Spieler gesehen hat) und `misses`. Ein Spielstand ohne `pinboard` bekommt eine leere Pinnwand, der Rest bleibt erhalten. Karten, deren Fundstelle es im Inhalt nicht mehr gibt, fallen beim Laden still weg.
- Nicht gespeichert werden die Lage von Papieren und Werkzeugen und eine offene, noch nicht gestempelte Akte. Nach dem Neuladen liegt diese Akte wieder zugeklappt oben im Eingang, ihre Entscheidungen sind leer.
- „Neues Spiel“ fragt vor dem Überschreiben nach.

## 10. Arbeitsweise für Claude Code

1. Zuerst `core`: Schema, Zusammenführen, Querprüfungen, Bewertung, Rechner, Spielstand-Übernahme, inklusive Tests.
2. Dann die Oberfläche für die neuen Teile ohne Animationen, danach Optik nach Abschnitt 7.
3. Nach jedem Oberflächen-Schritt Screenshots mit Playwright erstellen (Startbildschirm, Schreibtisch mit offener Akte vom Typ `entscheidungen` mit Betragsfeld, Markiermodus mit einem Paar, Nachfrage-Auswahl, Morgenzeitung, Rechner, Kodex offen mit Hinweisregel, Tagesauswertung mit Betrag und Widerspruch, dazu für den Arbeitstisch: leerer Tisch an Tag 1, offene Mappe mit Unterlagen in der Tasche, offene Mappe mit drei herausgezogenen Papieren und Kodex am Tisch, aufgenommener Stempel über dem Stempelfeld, zugeklappte gestempelte Akte, Tisch an Tag 8 mit Kalender und Rechner aufgeschlagen, Kalender April 2026 mit Auswahl, Schlussbildschirm Akt I, dazu die Kodex-Ansichten aus Abschnitt 6: zugeklappt an Tag 1 und an Tag 10, aufgeschlagen mit Inhaltsverzeichnis, aufgeschlagen mit Hinweisregel, aufgeschlagen mit Suchtreffern und markiertem Wort, gesperrte Seite, schmale Ansicht mit Einzelseite) und selbst prüfen: Ist der Text lesbar, überlappt nichts, sind alle Bedienelemente sichtbar?
4. Inhalte nie im Code ändern. Fällt ein Fehler im JSON auf, im Bericht melden statt stillschweigend anzupassen. Fehlt ein Spieltext im JSON, ebenfalls melden und nicht im Code erfinden. Für fehlende Oberflächentexte gilt die Regel des jeweiligen Auftrags.
5. **Inhaltsbericht:** `npm run content:report` gibt für alle Inhaltsdateien eine Liste aus: Tage mit Akten, Regeln und Spuren, dazu alle Texte mit `provisional: true` mit Tag und Fundort. Er dient dem Chat beim Überarbeiten der Story und läuft ohne Browser.
6. Änderungen an `src/core`, die ein Auftrag nicht vorsieht, nur machen, wenn sie zwingend sind, und im Bericht begründen.

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
- [ ] Gesperrte Kodexseiten zeigen keinen Inhalt. Ein Test prüft an Tag 1, dass Titel, Text und Fundstelle einer Regel von Tag 10 nirgends im DOM stehen.
- [ ] Der Kodex ist zugeklappt ein Buch auf dem Tisch und lässt sich mit Klick, Enter, Leertaste und K öffnen und mit Escape, K und der Schaltfläche schließen. Der Fokus kehrt zurück.
- [ ] Aufgeschlagen zeigt er Inhaltsverzeichnis, Lieferungen je Tag, Griffregister mit gesperrten Reitern und Lesezeichenband. Jede freigeschaltete Regel ist in der Doppelseite vollständig lesbar und wird an keinem Rand abgeschnitten, bei 1280 × 720, 1920 × 1080 und in der schmalen Einzelseiten-Ansicht.
- [ ] Blättern geht mit Schaltflächen, Pfeiltasten, Bild auf und ab, Pos1, Ende und Wischen. Bei „Effekte aus“ gibt es keine Animation. Der Fokus fällt nie auf eine nicht sichtbare Seite.
- [ ] Die Suche findet Teilwörter, ignoriert Groß- und Kleinschreibung, Umlaute und ß, findet eine Regel-ID, zeigt die Trefferzahl, springt zur Regel und markiert dort die Fundstelle. Ein Unit-Test deckt die Suche in `core` ab.
- [ ] Der Kodex merkt sich die Leseposition über Neuladen. Ein Spielstand ohne `codex` lädt weiterhin. An einem neuen Tag öffnet das Buch auf der ersten Seite der neuen Lieferung.
- [ ] Der Kodex bleibt mit allen 54 Regeln bedienbar, auch mit Tastatur und Screenreader-Struktur (Dialog, Seiten, Griffregister).
- [ ] Papiere lassen sich mit Maus und Touch ziehen, bei „Effekte aus“ ohne Animation, und werden an keinem Rand abgeschnitten.
- [ ] Der Build läuft auf GitHub Pages (Unterpfad, Neuladen und alle Assets werden gefunden).
- [ ] Arbeitstisch: Der e2e-Durchspieltest von Akt I läuft über den neuen Ablauf (Akte aus dem Eingang ziehen, Unterlagen herausziehen, entscheiden, Stempel aufnehmen und aufdrücken, schließen, in den Ausgangskorb ziehen), einmal mit Maus-Ziehen und einmal nur mit Tastatur. Beide enden mit null Fehlern an allen Tagen.
- [ ] Es liegt nie mehr als eine Akte am Tisch. Eine zweite wird mit `ui.desk.oneAkteOnly` abgewiesen und gleitet in den Eingang zurück.
- [ ] Nach `ui.desk.closeAkte` liegen alle Papiere der Akte wieder in der Tasche, keines bleibt auf der Unterlage. Eine offene oder ungestempelte Akte nimmt der Ausgangskorb nicht an.
- [ ] Der Kodex lässt sich auf die Unterlage ziehen, schlägt dort auf, lässt sich verschieben, blättern und zurücklegen. `ui.codex.readMode` und K öffnen den Lesemodus an derselben Regel. An Tag 1 stehen auch am Tisch keine Inhalte gesperrter Regeln im DOM.
- [ ] Der Kalender erscheint ab Tag 4 und nicht vorher. Er schlägt im April 2026 auf. Unit-Test: Ostersonntag 2024 bis 2030 richtig, Feiertage 2026 laut `kalender.json` (unter anderem 6. April Ostermontag), Karfreitag 3. April 2026 und 24. Dezember sind keine Feiertage. e2e: Auswahl 21. März bis 3. April 2026 zeigt 13 Tage Abstand.
- [ ] Bei 1280 × 720, 1920 × 1080 und 1024 × 768 passt der ganze Tisch ins Fenster, nichts ist abgeschnitten, Akte, Kodex und Kalender lassen sich nebeneinander auf die Unterlage legen.
- [ ] Bei „Effekte aus“ gibt es beim Aufschlagen, Zurückfliegen, Stempeln und Ablegen keine Animation.

### Pinnwand, Spuren, Lade (ab 0.5.0)

- [ ] Die Pinnwand erscheint an Tag 7 und nicht vorher, die Lade klemmt bis Tag 10 (`ui.drawer.stuck`) und geht dann auf.
- [ ] Spur t1 mit Vorarbeit: An Tag 7 hängen Sedlaks Karte und die Rechnungsnummer aus 5-3. Ein Klick auf die Nadel an der Rechnungsnummer in 7-3 verbindet sie und löst die Spur. Spur t2: An Tag 10 hängen Sedlaks Karte und die Kanzleistempel aus 2-4 und 4-3, ein Klick auf den Stempel in 10-4 löst sie. Je ein kurzer e2e-Test, der mit einem Spielstand am jeweiligen Tag beginnt.
- [ ] Eine Spur ohne `seed` lässt sich auch ganz selbst lösen (Loader- und Unit-Test mit einer Test-Spur, Karten auf Karten ziehen).
- [ ] Ein Unit-Test zeigt, dass der Code keine Figur kennt: Eine Test-Inhaltsdatei mit anderer Figur in `seed.from` und anderen Texten wird ohne Codeänderung dargestellt.
- [ ] `npm run content:report` listet die vorläufigen Texte von Akt I.
- [ ] Ein Faden zwischen Fundstellen ohne gemeinsame Spur fällt herunter, erhöht `pinboard.misses` und ändert die Fehlerzahl nicht.
- [ ] Unit-Tests in `core`: Faden-Prüfung, gelöste Spuren (auch Spur mit drei Fundstellen, nur teilweise verbunden, vor ihrem Tag verbunden, nach Entfernen von Karten weiter gelöst), Durchschläge aus dem Spielstand inklusive Folgeakten.
- [ ] Loader-Tests mit je einem kaputten Beispiel: Spur verlinkt eine Akte, die erst nach dem Tag der Spur kommt; `field` ungleich `representative`; Vertreter ohne sichtbaren Stempel; doppelte Spur-ID; Spur vor `unlock: pinboard`; `keep: "drawer"` vor `unlock: drawer`; `keep` an einem anderen Typ als `note`.
- [ ] Anheften, Fäden, Verschieben, Abnehmen, Durchschlag öffnen und die Lade gehen auch nur mit der Tastatur. Im Markiermodus gibt es keine Nadeln.
- [ ] Die Pinnwand übersteht Neuladen (Karten, Lage, Fäden, gelöste Spuren). Ein Spielstand ohne `pinboard` lädt weiterhin.
- [ ] Die Zettel von Tag 10 mit `keep: "drawer"` liegen nach dem Tagesbeginn in der Lade und sind nach Neuladen noch dort.
- [ ] In der Tagesauswertung öffnet jede Regel-ID den Lesemodus an dieser Regel, Escape führt zurück, der Fokus liegt wieder auf der Regel.
- [ ] An Tag 7 stehen keine Inhalte von Akten im DOM, die erst später kommen (auch nicht in Durchschlägen oder Karten).
- [ ] Bei 1280 × 720, 1920 × 1080 und 1024 × 768 passen Pinnwand-Platz und Lade-Griff auf den Tisch, und Pinnwand-Ansicht und Lade-Ansicht sind vollständig sichtbar.
- [ ] Bei „Effekte aus“ gibt es beim Anheften, bei Fäden und beim Öffnen der Lade keine Animation.
- [ ] Loader-Test: `seed.links` mit ungültigem Index, mit allen Links, oder mit einer Akte, die erst am Tag der Spur kommt, ist ein Ladefehler.

## 12. Nicht Teil dieser Version

Weiterspielen am Schlussbildschirm (kommt mit Akt II), Kartei mit Suche über alle Akten (Prototyp vorhanden, kommt mit Akt II, wenn Spuren ohne Vorarbeit häufiger werden), eigener Aktenvermerk des Spielers an der Pinnwand, Wirkung von `pinboard.misses` (kommt mit dem Metagame), Metagame (Tagesbudget, Beurteilung, Vertrauen, Zuhause, Ereigniskarten), Begründung beim Stempel (Auswahl der Regel-ID), Bedingungen auf Merker oder frühere Entscheidungen, Fristen im Spielablauf (der Tischkalender ist nur ein Werkzeug), Three.js-Atmosphäre, Akte ab Akt II, weitere Musikstücke.
