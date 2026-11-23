# Auftrag 06b: Feinschliff nach dem ersten Durchspielen

Stand: 23.11.2026 · Grundlage: `main` mit `SPEC.md` 0.5.2, `content/akt1.json` 0.3.6, `content/ui.json` 0.5.1, `content/kalender.json` 0.1.0

## Ziel

Dominik hat Akt I nach Auftrag 06 durchgespielt. Das Gefühl stimmt, aber der Tisch überfordert an einzelnen Tagen und einige Teile lesen oder bedienen sich schlecht. Dieser Auftrag verteilt die Werkzeuge über Akt I, vereinfacht das Markieren von Widersprüchen, macht die Belege lesbar, ergänzt den Rechner und gibt den Schaltflächen im Prüfvermerk ein befriedigendes Feedback.

Leitsatz (Dominik, 23.11.2026): **Bei der Story darf das Spiel an die Hand nehmen, bei den Fällen nie.** Werkzeuge dürfen einfacher werden und später kommen, aber nichts am Tisch darf anzeigen, wo in einer Akte das Problem steckt.

## Reihenfolge und Branch

1. Arbeite auf einem neuen Branch `auftrag-06b-feinschliff` von `main`.
2. Nach grüner Abnahme nach `main` mergen (CI in allen drei Browsern, auf `main` mit `@long`), Pages neu veröffentlichen.
3. **Danach** den Branch `auftrag-07-prolog-tagesablauf` auf das neue `main` rebasen. Die Änderungen dieses Auftrags an SPEC, `akt1.json` und `ui.json` müssen dort erhalten bleiben (Versionen dort dann SPEC 0.6.1, `akt1.json` 0.4.1, `ui.json` 0.6.1, mit CHANGELOG-Zeile). Konflikte im Bericht nennen. Auftrag 07 selbst nicht umsetzen.

## Ausnahme bei den Dateieigentümern

`SPEC.md` und `content/*.json` gehören laut `CLAUDE.md` dem Chat. Der Chat konnte in dieser Sitzung nicht pushen. Deshalb setzt Claude Code die unten **wörtlich vorgegebenen** Änderungen an SPEC und Inhalten in diesem Auftrag selbst um, mit CHANGELOG-Zeilen. Eigene Formulierungen in SPEC oder Inhalten nur, wo der Auftrag das ausdrücklich erlaubt, und im Bericht auflisten. Neue `ui.json`-Schlüssel darfst du anlegen, wenn die vorgeschlagenen nicht reichen, und listest sie im Bericht.

Versionen nach diesem Auftrag: SPEC 0.5.3, `akt1.json` 0.3.7, `ui.json` 0.5.2. SPEC-Kopf entsprechend.

## Aufgaben

### 1. Werkzeuge über Akt I verteilen

Regel (neu in SPEC 7, eigener Absatz „Freischaltung der Werkzeuge“): **Höchstens ein neues Werkzeug je Tag. Ein Werkzeug ist am Tisch erst sichtbar, wenn es freigeschaltet ist.** Ausnahmen sind der Griff der Lade, weil „die Lade klemmt“ ab Tag 1 zur Story gehört, und das Telefon, das nur klingelt und nichts bedienen lässt.

Ziel-Verteilung in Akt I:

| Tag | Neu |
| --- | --- |
| 1 | Mappe, Stempel „Bescheid“, Kodex |
| 2 | Morgenzeitung |
| 3 | Stempel „Ergänzungsersuchen“ |
| 4 | Tischkalender |
| 5 | Widerspruch markieren (Aufgabe 2) |
| 6 | Nachfrage mit Auswahl |
| 7 | Pinnwand, nur Fragen und Hand |
| 8 | Tischrechner mit Betragsfeldern |
| 9 | Anruf |
| 10 | Lade |
| ab erster `pin`-Frage (Akt II) | Nadel und Durchschläge (Aufgabe 5) |

Umsetzung:
- **Pinnwand-Platz** am Tisch ist vor `unlock: pinboard` nicht zu sehen (heute steht er vermutlich ab Tag 1 da, bitte prüfen). Gleiches gilt für Kalender und Rechner, falls dort noch etwas vorher sichtbar ist.
- **Neue Freischaltung `marking`:** `unlock.feature` kennt zusätzlich `marking`. Vorher gibt es keinen Markier-Schalter und keinen Markier-Schritt. Spielstände ab Tag 5 ohne gespeicherte Freischaltung bekommen `marking` beim Laden.
- **Zeitung an Tag 2:** neues Story-Ereignis in `akt1.json`, als erstes Ereignis von Tag 2:
  ```json
  {
    "type": "newspaper",
    "from": "Donau-Kurier",
    "headline": "Die Heurigen am Stadtrand sperren auf",
    "text": "Mit den ersten warmen Tagen öffnen die Buschenschanken in Stammersdorf und Neustift. Die Wirte rechnen mit einem guten Frühjahr.",
    "provisional": true
  }
  ```
  Steht im Intro von Tag 4 noch, dass die Zeitung „zum ersten Mal“ daliegt, diesen Satzteil streichen (nur streichen, nichts Neues formulieren) und im Bericht den alten und neuen Wortlaut nennen.
- **Freischaltung Markieren an Tag 5:** in `akt1.json` als erstes Ereignis von Tag 5 `{ "type": "unlock", "feature": "marking" }`. Text in `ui.json`: `intro.unlockMarking` = „Ab heute können Sie beim Ergänzungsersuchen zwei Angaben gegenüberstellen, die nicht zusammenpassen.“
- Der Loader prüft: `marking` vor dem ersten Tag mit einer Akte mit `discrepancies` freigeschaltet. Sonst Ladefehler mit Akte und Tag.

### 2. Widerspruch markieren als Schritt beim Ergänzungsersuchen

Heute: Schalter „Widerspruch markieren“ im Prüfvermerk ab Tag 1 (SPEC 4, Punkt 4). Neu:
- **Kein Dauer-Schalter mehr.** Ab `marking` erscheint beim Aufnehmen des Stempels „Ergänzungsersuchen“ ein Bereich „Gegenüberstellung“ im Prüfvermerk, an derselben Stelle wie heute die Nachfrage-Auswahl. Er erscheint **bei jedem Ergänzungsersuchen**, egal ob die Akte `discrepancies` hat. Er verrät also nichts.
- Darin wählt der Spieler eine Zeile in einem Papier und eine Zeile in einem anderen Papier. Gegenüberstellen ist freiwillig: Er darf auch ohne Paar stempeln. Die Bewertung bleibt wie in SPEC 5 (nicht markierter Widerspruch und falsche Paarung je ein Fehler).
- Hat die Akte eine `inquiry`, stehen Gegenüberstellung und Nachfrage untereinander, zuerst die Gegenüberstellung. Gestempelt wird erst nach der Wahl der Nachfrage (wie heute).
- **Fehlertolerant:**
  - Die Reihenfolge der beiden Klicks ist egal, für Bildung **und** Bewertung des Paars.
  - Die erste gewählte Zeile bekommt sofort den roten Bleistiftrahmen und bleibt so, bis die zweite kommt.
  - Ein weiterer Klick im **selben** Papier verschiebt die erste Wahl dorthin (sichtbar). Ein Klick auf die gewählte Zeile hebt die Wahl auf.
  - Solange der Bereich offen ist, macht ein Klick auf eine Zeile nie etwas anderes (kein Stempeln, kein Ziehen-Start, keine Nadel).
- Legt der Spieler den Stempel zurück, bleiben gebildete Paare erhalten. Liste der Paare mit „aufheben“ wie bisher.
- Bitte zuerst den Fehler aus dem Durchspielen nachstellen: Dominiks Markierung zählte nicht, nachdem er die Belege „in anderer Reihenfolge“ angeklickt hatte. Ursache im Bericht nennen (Bewertung prüft die Reihenfolge, oder die Bedienung hat ein Paar verworfen).
- Texte: `desk.markHint` bleibt, neu `desk.markHeading` = „Gegenüberstellung“, `desk.markOptional` = „Sie können auch ohne Gegenüberstellung stempeln.“ `desk.markMode` wird nicht mehr gebraucht und darf entfernt werden.
- SPEC 4 (Punkt „Widerspruch markieren“) und 7 entsprechend neu fassen. Wortlaut darfst du hier selbst formulieren, im Bericht zitieren.

### 3. Belege lesbar machen (SPEC 7, „Papier“)

- **Keine automatische Silbentrennung auf Papieren** (Erklärungen, Belege, Zeitung, Zettel). Linksbündig statt Blocksatz. Der Kodex behält Blocksatz und Silbentrennung.
- **Belegzeilen als zwei Spalten:** links das Label, das nur zwischen ganzen Wörtern umbricht, rechts der Wert. Beträge (`… €`) brechen nie um und stehen rechtsbündig untereinander, Ziffern mit `tabular-nums`. Lange Werte ohne Betrag (Adressen, Vermerke) dürfen umbrechen, aber nur zwischen Wörtern.
- **Schrift nur verkleinern, wenn es danach noch eng ist,** höchstens um etwa 8 %. Zum Lesen bleibt der Zoom.
- Ein Wort darf nur dann mitten im Wort umbrechen, wenn es allein breiter als die Spalte ist (`overflow-wrap: anywhere` als letzte Rettung). Im Bericht nennen, ob das in Akt I irgendwo vorkommt.
- Screenshots aller Papiere von 5-3, 7-3, 9-2 und 10-4 bei 1280 × 720, herausgezogen und gezoomt, selbst ansehen.

### 4. Tischrechner (SPEC 7, „Tischrechner“)

- **Backspace** löscht die letzte eingegebene Ziffer (oder das Komma) der aktuellen Zahl. Nach `=` oder einem Operator wirkt es nicht. Neue Taste am Gerät: `calculator.backspace` = „⌫“, `aria.calcBackspace` = „letzte Ziffer löschen“.
- **Tastatur, Haupttastatur und Numpad:** Ziffern, `+`, `-`, `*`, `/` (auch `NumpadAdd`, `NumpadSubtract`, `NumpadMultiply`, `NumpadDivide`), `Enter`, `NumpadEnter` und `=` rechnen, `,`, `.` und `NumpadDecimal` setzen das Komma, `Escape` und `Delete` entsprechen C, `Backspace` wie oben. Über `event.key` und `event.code` prüfen, damit es mit deutschem und englischem Layout und ausgeschaltetem Num-Lock-Sonderfall funktioniert.
- Der Rechner reagiert auf Tasten, wenn er offen ist und der Fokus nicht in einem Eingabefeld liegt (Betragsfeld, Kodex-Suche). Taste K und P bleiben dabei erhalten.
- Unit-Test je Taste in `core`, ein e2e-Test mit Numpad-Tasten.

### 5. Pinnwand: Nadel und Durchschläge erst mit der ersten `pin`-Frage (SPEC 7.6)

- Die Seitenleiste mit Durchschlägen und die Nadel an den Zeilen erscheinen erst, sobald an der Wand eine Frage hängt (offen oder beantwortet), die mindestens einen Hinweis mit `source: "pin"` hat. Danach bleiben sie. In Akt I erscheinen sie also nie.
- Auch dann liegen die Durchschläge zuerst als geschlossener Ordner „Durchschläge ({count})“ (`pinboard.carbonFolder`) und gehen erst auf Klick auf.
- Rein aus den Daten abgeleitet, kein eigener Schalter. Unit-Test mit einem kleinen Test-Inhalt, der eine `pin`-Frage hat.

### 6. Befriedigendes Feedback im Prüfvermerk (SPEC 7)

- **Bleistift-Kringel:** Die gewählte Option bekommt einen handgezeichneten Kringel als SVG, der sich bei „voll“ in etwa 200 ms einzeichnet (`stroke-dashoffset`), bei „reduziert“ einblendet, bei „aus“ sofort steht. Beim Umentscheiden verschwindet der alte Kringel mit einem kurzen Durchstreichen (bei „voll“) oder sofort.
- **Eindrücken:** Schaltflächen geben beim Drücken kurz nach (nur `transform`).
- **Ton:** ein kurzes Bleistift-Geräusch, CC0, mit Quelle in `public/audio/QUELLEN.md`. Gibt es kein passendes CC0-Geräusch, den Ton weglassen und im Bericht nennen, keine Platzhalter.
- Der Kringel ist auch der sichtbare Zustand für Screenreader-Nutzer gleichwertig: `aria-pressed` bleibt die Quelle, der Kringel ist Dekoration (`aria-hidden`).
- Betragsfelder bekommen beim Bestätigen (Verlassen des Felds mit gültigem Betrag) eine kurze Unterstreichung in Bleistift, ohne Ton.

## Abnahmekriterien

- [ ] Akt I ist mit Maus und mit Tastatur von Tag 1 bis 10 durchspielbar (bestehende `@long`-Durchspieltests grün, angepasst an den Markier-Schritt).
- [ ] Ein e2e-Test prüft je Tag 1 bis 10, welche Werkzeuge am Tisch sichtbar sind, gegen die Tabelle in Aufgabe 1.
- [ ] Vor Tag 5 gibt es keinen Markier-Schalter und keinen Gegenüberstellungs-Bereich. Ab Tag 5 erscheint der Bereich bei jedem Ergänzungsersuchen, auch bei Akten ohne `discrepancies`.
- [ ] Test „b vor a“: 5-3 mit umgekehrter Klickreihenfolge markiert, Ergänzungsersuchen gestempelt, Tagesauswertung ohne Widerspruchsfehler. Dazu ein Test für das Verschieben der ersten Wahl im selben Papier.
- [ ] Auf keinem Papier ist `hyphens: auto` wirksam (Test über den berechneten Stil), Beträge brechen nie um. Screenshots aus Aufgabe 3 selbst angesehen.
- [ ] Rechner: Backspace und alle Tasten aus Aufgabe 4 per Unit- und e2e-Test, kein Auslösen bei Fokus im Betragsfeld.
- [ ] In Akt I gibt es an keiner Zeile eine Nadel und keine Durchschläge (e2e an Tag 7 und 10). Unit-Test mit `pin`-Frage zeigt beides.
- [ ] Kringel bei „voll“, „reduziert“ und „aus“ wie beschrieben, `aria-pressed` unverändert korrekt.
- [ ] Spielstände von `main` vor diesem Auftrag laden ohne Fehler (Tag 3, Tag 6, Tag 9).
- [ ] `npm test`, `npm run build`, `npm run content:report` laufen. Text-Herkunftstest grün, keine Spieltexte im Code.
- [ ] Neue e2e-Tests kurz, mit vorbereitetem Spielstand. WebKit nur `@smoke` (höchstens zwei neue `@smoke`-Tests).
- [ ] CHANGELOG-Zeilen für SPEC 0.5.3, `akt1.json` 0.3.7, `ui.json` 0.5.2. Danach Rebase von `auftrag-07-prolog-tagesablauf` wie oben.

## Bericht

- Ursache des Markier-Fehlers.
- Wortlaut der neuen SPEC-Absätze (Freischaltung der Werkzeuge, Markieren, Papier, Rechner, Pinnwand).
- Alle angelegten, geänderten und entfernten `ui.json`-Schlüssel mit Text.
- Ob die Schrift verkleinert wurde und um wie viel, ob irgendwo mitten im Wort umgebrochen wird.
- Quelle des Bleistift-Tons oder dass er fehlt.
- Konflikte beim Rebase von Auftrag 07.

## Nicht Teil dieses Auftrags

Auftrag 07 (Vorspann, Ereignisse im Lauf des Tages, Zeitungsausschnitte), neue Akten oder Lösungen, Story-Texte außer der Zeitung an Tag 2, Metagame, Karteikasten.
