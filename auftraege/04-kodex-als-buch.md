# Auftrag 04: Der Kodex als Buch

Stand: 21.11.2026 · gehört zu SPEC 0.3.2, Abschnitt 6 · baut auf Auftrag 03 auf (Akt I komplett, `akt1.json` 0.3.1, `ui.json` 0.2.1)

## Ziel

Der Kodex soll nicht wie ein Menü, sondern wie ein echtes Buch aussehen und sich so anfühlen: eine Loseblattsammlung im Leinenband, wie sie in Amtsstuben steht. Jeden Tag kommt eine Ergänzungslieferung dazu, das Buch wird sichtbar dicker. Zugeklappt liegt es links auf dem Tisch, aufgeschlagen ist es eine Doppelseite mit Inhaltsverzeichnis, Griffregister, Lesezeichenband, Blättern und Stichwortsuche.

Inhalt und Regeln ändern sich nicht. Es geht um Darstellung und Bedienung, mit einer kleinen Logik in `core` für Suche und Gliederung.

## Vorab lesen

- `spec/SPEC.md` Version 0.3.2, vor allem Abschnitt 6 (ganz), 7 (Optik, Sound), 9 (Spielstand), 11 (Abnahme).
- Der bisherige Kodex bleibt als Rückfall im Verlauf (Git), wird aber ersetzt, nicht nebenher gepflegt.

## Aufgaben in dieser Reihenfolge

### 1. core: `src/core/codex.ts`

Reine Funktionen ohne DOM, mit Unit-Tests:

- Sichtbare Regeln für einen Tag, Gruppierung nach Lieferung (Tag), Liste der noch gesperrten Tage.
- `normalizeForSearch(text)`: Kleinschreibung, Umlaute und ß falten (ä wird a, ö wird o, ü wird u, ß wird ss), Akzente entfernen.
- `searchRules(rules, day, query)`: Teilwortsuche in Titel und Text der freigeschalteten Regeln, Treffer mit Regel-ID, Titel, Tag, Ausschnitt (etwa 80 Zeichen um die erste Fundstelle) und Positionen der Fundstellen für das Markieren. Eine Eingabe wie „R12“ findet die Regel mit dieser ID. Leere Eingabe liefert keine Treffer. Gesperrte Regeln werden nie gefunden.
- `toRoman(n)` für die Seitenzahlen des Inhaltsverzeichnisses.
- Spielstand: `codex.lastRuleId` (Zeichenkette, leer für das Inhaltsverzeichnis) und `codex.seenDay` (Zahl) mit Standardwerten leer und 0. Ein älterer Spielstand ohne `codex` lädt weiter und bekommt die Standardwerte.
- Tests: Normalisierung (Umlaute, ß, Großschreibung), Teilwort, ID-Suche, gesperrte Regeln werden nicht gefunden, mehrere Treffer, Ausschnitt am Textanfang und -ende, römische Zahlen, Spielstand ohne `codex`.

### 2. Schrift und Material

- Antiqua mit Serifen, lokal eingebunden. Vorschlag: EB Garamond (SIL OFL) über `@fontsource`, so wie bei Old Standard TT. Quelle und Lizenz in `public/audio/QUELLEN.md` ergänzen (oder in einer eigenen Quellendatei für Schriften, falls es die schon gibt). Passt eine andere freie Antiqua deutlich besser, vorher im Bericht begründen.
- Keine Bilddateien für den Einband. Leinenstruktur, Goldprägung, Papier und Schatten kommen aus CSS und kleinen SVG-Filtern, wie schon bei den Papieren.

### 3. Zugeklappter Kodex (Abschnitt 6.1)

- Dunkelrotes Leinen, Goldprägung „KODEX“, Untertitel, „Stand: Tag N“, Bünde am Rücken, Schnitt mit feinen Linien, leicht gedreht.
- Dicke des Buchblocks wächst mit der Zahl der freigeschalteten Tage (reiner CSS-Wert).
- Zettel „neu“ am Schnitt, solange die heutige Lieferung nicht gesehen wurde (`codex.seenDay` kleiner als der aktuelle Tag).
- Öffnen mit Klick, Enter, Leertaste und Taste K. Taste K funktioniert nicht, wenn gerade ein Eingabefeld Fokus hat.

### 4. Aufgeschlagenes Buch (Abschnitte 6.2 bis 6.4)

- Dialog mit Fokusfalle, abgedunkelter Tisch dahinter, Schließen mit Escape, Klick daneben, K und Schaltfläche. Danach Fokus zurück auf das zugeklappte Buch.
- Doppelseite, höchstens 1120 × 760 Pixel und mit dem Fenster skaliert. Unter 900 Pixel Breite Einzelseite.
- Seitenaufbau nach 6.3: Papier, Falzschatten, Kopfzeile links und rechts, Seitenzahl außen, Randziffer mit Regel-ID, Titel, Text im Blocksatz mit Silbentrennung, Fußnotenzeile mit „vereinfacht“ und Fundstelle als Link, Hinweisregeln im Kasten mit Zeigefinger, Vermerk „neu“ und roter Randstreifen für die heutige Lieferung.
- Gliederung nach 6.4: Inhaltsverzeichnis mit römischen Seitenzahlen, Lieferungen je Tag mit Lieferungskopf, danach je gesperrtem Tag eine leere, liniierte Seite mit Aufdruck „Gesperrt – ab Tag N“. Im Inhaltsverzeichnis stehen gesperrte Tage nur als eine Zeile ohne Regel-ID und Titel.
- **Wichtig:** Titel, Text und Fundstelle gesperrter Regeln stehen nirgends im DOM, auch nicht als verstecktes Element. Dafür gibt es einen Test (siehe Abnahme).

### 5. Seitenumbruch

- CSS-Spalten in Seitengröße, per `translateX` weitergeschoben. Regeln nicht zerreißen (`break-inside: avoid`), außer eine Regel ist höher als eine Seite (R9 kann das sein).
- Neu berechnen beim Öffnen, bei Größenänderung, nach `document.fonts.ready` und wenn ein neuer Tag Regeln freischaltet. Nach dem Neuumbruch bleibt die Leseposition über die Regel-ID erhalten.
- Nicht sichtbare Seiten sind `inert`. Der Fokus darf nie auf eine nicht sichtbare Seite fallen.
- Prüfen, dass auf keiner Seite etwas abgeschnitten wird: Bei jeder Regel muss Anfang und Ende in der Doppelseite sichtbar sein (Playwright prüft das über die Bounding Boxes).

### 6. Griffregister, Lesezeichen, Blättern, Suche (6.5 bis 6.7)

- Griffregister am rechten Schnitt: „Inhalt“ und je ein Reiter pro Tag des Akts. Gesperrte Reiter blass mit Schloss, `aria-disabled`, nicht anklickbar. Heutiger Reiter trägt „neu“, bis die Lieferung gesehen wurde.
- Lesezeichenband am Rücken auf der zuletzt gelesenen Seite.
- Blättern mit Eckenschaltflächen, Pfeiltasten, Bild auf und ab, Pos1, Ende, Seitenrändern und Wischen. Effekte „voll“: Umblättern in 3D, 350 bis 450 ms, mit wanderndem Schatten. „reduziert“: Überblendung bis 120 ms. „aus“: sofort. Nur `transform` und `opacity` animieren. `prefers-reduced-motion` gilt wie bisher.
- Ton: vorhandenes Papierrascheln beim Aufschlagen und Blättern, vorhandener Ablageton beim Zuklappen. Keine neuen Klangdateien.
- Suche: Suchfeld oben am Buch, Trefferliste ersetzt das Inhaltsverzeichnis, Klick blättert zur Regel und markiert die Fundstelle wie mit einem Textmarker, Löschen stellt das Inhaltsverzeichnis wieder her.
- Merken: Beim Schließen speichert das Spiel `codex.lastRuleId` und beim ersten Ansehen einer Seite der heutigen Lieferung `codex.seenDay`. Beim Öffnen am selben Tag öffnet das Buch an der gemerkten Stelle, bei einer ungesehenen Lieferung auf deren erster Seite.

### 7. Aufräumen und kleine Korrektur

- Der alte Kodex-Code (Seitenleiste, Lesezeichen, Liste) entfällt, nichts davon bleibt als toter Code.
- `ui.json`: `aria.calcDisplay` von „Anzeige“ auf „Rechneranzeige“ ändern. Das ist eine Textänderung, kein neuer Schlüssel.

## Neue Oberflächentexte (`ui.json`, Ausnahme für diesen Auftrag)

Chat ist sonst Eigentümer von `ui.json`. Weil das Schema ungenutzte oder fehlende Schlüssel ablehnt, legt Claude Code die Schlüssel in diesem Auftrag selbst an, trägt `meta.version` auf 0.3.0 ein, ergänzt eine CHANGELOG-Zeile und listet am Ende des Berichts jeden neuen oder geänderten Schlüssel mit Text. Ich prüfe sie danach im Chat. Vorhandene Schlüssel (`codex.open`, `close`, `day`, `locked`, `new`, `simplified`, `sourceSeparator`, `searchPlaceholder`, `hits`, `hint`, `aria.codex`, `codexSearch`, `bookmarks`, `lockedPage`) werden wiederverwendet. Ein Schlüssel, der danach nicht mehr gebraucht wird, wird entfernt.

Vorschläge, in der Wortwahl frei veränderbar, solange sie Bedeutung und Platzhalter behalten:

| Schlüssel | Text |
| --- | --- |
| `codex.coverTitle` | KODEX |
| `codex.coverSubtitle` | Loseblattausgabe, vereinfachte Fassung |
| `codex.coverStand` | Stand: Tag {day} |
| `codex.runningHeadLeft` | Kodex |
| `codex.runningHeadRight` | Lieferung Tag {day} |
| `codex.deliveryHeading` | Lieferung Tag {day} |
| `codex.register` | Inhaltsverzeichnis |
| `codex.tabRegister` | Inhalt |
| `codex.lockedSheet` | Noch nicht ausgegeben |
| `codex.nextPage` | Nächste Seite |
| `codex.prevPage` | Vorige Seite |
| `codex.noHits` | Kein Treffer |
| `codex.searchClear` | Suche löschen |
| `aria.codexPage` | Seite {n} |
| `aria.codexBook` | zugeklappter Kodex, Stand Tag {day} |

Römische und arabische Seitenzahlen sind Zahlen und kein Text. Sie dürfen im Code erzeugt werden, ebenso das Zierwerk als SVG ohne Textinhalt.

## Was nicht Teil dieses Auftrags ist

- Keine Änderung an `content/akt1.json`. Fällt in den Regeltexten etwas auf (zu lange Regel, Umbruchprobleme), im Bericht melden.
- Kein Three.js. Das Umblättern ist CSS (3D-Transforms), die Atmosphäre-Ebene bleibt ein Stub.
- Kein Sprung aus der Tagesauswertung in den Kodex (kommt später, steht in SPEC 12).
- Keine neuen Klangdateien.

## Abnahme

Alle Punkte aus SPEC 11, die den Kodex betreffen, und zusätzlich:

- [ ] Ein e2e-Test: An Tag 1 stehen Titel, Text und Fundstelle von R54 nirgends im DOM, der Reiter „Tag 10“ ist `aria-disabled`.
- [ ] Ein e2e-Test: Öffnen mit K, Blättern mit Pfeiltasten bis zu R9, Schließen mit Escape, Neuladen, erneutes Öffnen an derselben Stelle.
- [ ] Ein e2e-Test: Suche nach „abzugsfahig“ findet Regeln mit „abzugsfähig“, Suche nach „R12“ findet R12 (an Tag 4 oder später), Klick springt zur Regel und markiert die Fundstelle.
- [ ] Ein Test: Mit „Effekte aus“ gibt es beim Blättern keine Animation (kein laufendes `transition` oder `animation` auf den Seiten).
- [ ] Ein Test, der für jede freigeschaltete Regel an Tag 10 prüft, dass sie in irgendeiner Doppelseite vollständig sichtbar ist (bei 1280 × 720 und 1920 × 1080).
- [ ] Ein Test mit einem Spielstand ohne `codex`: lädt, öffnet auf der ersten Seite der heutigen Lieferung.
- [ ] Unit-Tests für `core/codex.ts` wie oben.
- [ ] `no-hardcoded-text` und der Schlüssel-Test sind grün, alle neuen Texte stehen in `ui.json`.
- [ ] Typprüfung, Unit-Tests, e2e und Build sind grün, Pages-Deploy läuft.

## Screenshots (selbst prüfen, dann im Bericht nennen)

1. Schreibtisch mit zugeklapptem Kodex an Tag 1 und an Tag 10 (Dickenunterschied sichtbar).
2. Aufgeschlagen: Inhaltsverzeichnis an Tag 10 mit gesperrten Tagen.
3. Aufgeschlagen: Doppelseite mit Hinweisregel (R28 oder R36).
4. Aufgeschlagen: Lieferung des heutigen Tags mit „neu“.
5. Aufgeschlagen: Suche mit Treffern und markiertem Wort im Text.
6. Gesperrte Seite.
7. Griffregister mit gesperrten Reitern.
8. Schmale Ansicht mit Einzelseite (390 × 844).
9. Mitten im Umblättern (nur bei „voll“, falls der Test es zuverlässig fangen kann).

Prüfen: Ist jeder Text lesbar? Wird nichts abgeschnitten? Überlappen sich Reiter, Seitenzahlen und Text? Sind alle Bedienelemente sichtbar und mit Tastatur erreichbar? Sieht es nach einem Buch aus und nicht nach einer Tabelle auf braunem Hintergrund?

## Bericht

Wie bei Auftrag 03: Was erledigt ist, Tests und Zahlen, Inhaltsfehler im JSON (nur melden), neue und geänderte `ui.json`-Schlüssel mit Text, Entscheidungen, die die SPEC offen ließ, Abweichungen, Quellen und Lizenzen, Screenshots, Offenes. Danach `CHANGELOG` ergänzen und `meta.version` von `ui.json` auf 0.3.0 setzen.

## Vorschlag für die CHANGELOG-Zeile (Chat)

`21.11.2026 · SPEC 0.3.2: Kodex als Buch (Abschnitt 6), Entscheidungen aus Bericht 03 übernommen, Spielstand um codex.lastRuleId und codex.seenDay erweitert. Auftrag 04 angelegt.`
