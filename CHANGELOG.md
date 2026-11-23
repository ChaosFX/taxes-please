# Änderungsprotokoll

Gemeinsame Dateien (`SPEC.md`, `content/*.json`) werden im Claude-Projekt und in diesem Repo parallel geführt. Jede Änderung steht hier mit Datum, Datei und Version.

## 23.11.2026

- `SPEC.md` 0.5.0: Pinnwand mit Fragen nach dem Vorbild des Case Boards in Alan Wake 2 (Abschnitte 3, 4, 5, 7.1, 7.6, 7.7, 9, 10, 11, 12). Fragen an der Wand, Hinweise in einer Hand, Zuordnen auf die passende Frage, Folgefragen über `after`. Hinweise kommen beim Ablegen von selbst (`auto`) oder mit der Nadel (`pin`), vorgegebene mit `given`. `traces` mit freien Fäden entfallen. Lade klemmt bis `unlock: drawer`, danach Zettel mit `keep: "drawer"`. Regel-IDs der Tagesauswertung springen in den Kodex. `provisional` an Story-Ereignissen und Fragen, Inhaltsbericht `npm run content:report`. Spielstand um `board`. `auftraege/06-pinnwand-fragen-lade.md` und `auftraege/06-prototyp-pinnwand.html` angelegt. Liegt auf dem Branch `auftrag-06-pinnwand`.
- `content/akt1.json` 0.3.4: `traces` durch `questions` ersetzt (q1 und q2 an Tag 7, q3 an Tag 10, alle `provisional`). `keep: "drawer"` an den beiden Zetteln von Sedlak an Tag 10.
- `content/ui.json` 0.5.0: neu `intro.unlockPinboard`, `intro.unlockDrawer`, `evaluation.ruleJump`, Bereiche `pinboard` und `drawer`, `aria.pinboard`, `aria.pinCard`, `aria.question`, `aria.questionAnswered`, `aria.hand`, `aria.pinnableLine`, `aria.pinnableStamp`, `aria.drawer`, `aria.copy`.
- `content/akt1.json` 0.3.3: Story-Durchgang Akt I, neun neue und vier geänderte Story-Ereignisse (Zuhause, Wallner, Gerri, Sedlak, Pernold), keine Änderung an Akten, Regeln oder Spuren. Nur vorhandene Typen. `SPEC.md` nennt jetzt `akt1.json` 0.3.3.
- `SPEC.md` 0.4.1 (Abschnitt 2): Testzuschnitt nach Bericht 05 festgeschrieben. Chromium und Firefox alle e2e-Tests, WebKit nur `@smoke` (2 Minuten, keine Wiederholung), `@long` nur bei Push auf `main`. Neue e2e-Tests kurz halten. Abweichung 2 aus Bericht 05 damit erledigt.

## 22.11.2026

- `SPEC.md` 0.4.0: Arbeitstisch zum Anfassen (Abschnitte 4, 6.1, 6.1a, 6.2, 7.1 bis 7.5, 9, 10, 11, 12): Eingang und Werkzeugleiste links, Akte als Mappe mit Tasche, Unterlagen fliegen beim Schließen zurück, Stempel nehmen und aufdrücken, Ablegen durch Ziehen, nur eine Akte am Tisch, Kodex am Tisch aufgeschlagen und Lesemodus mit K. Neuer Tischkalender mit `content/kalender.json`, `unlock: calendar`, `meta.kalenderStart`. „Papiere im Raster“ entfällt. `auftraege/05-arbeitstisch.md` und `auftraege/05-prototyp-arbeitstisch.html` angelegt.
- `content/akt1.json` 0.3.2: `meta.kalenderStart` „2026-04“, Tag 4 mit `unlock: calendar`.
- `content/ui.json` 0.4.0: neu `intro.unlockCalendar`, `desk.closeAkte`, `desk.pocket`, `desk.stampField`, `desk.oneAkteOnly`, `desk.closeFirst`, `desk.stampTaken`, `desk.alreadyStamped`, `desk.noOpenAkte`, `desk.putBack`, `codex.readMode`, Bereich `calendar`, `aria.calendar`, `aria.calendarDay`, `aria.calendarHoliday`, `aria.inbox`, `aria.folder`, `aria.folderStamped`; geändert `desk.stack` und `desk.emptyDesk`.
- `content/kalender.json` 0.1.0 neu: gesetzliche Feiertage nach § 7 Abs. 2 ARG (BGBl. I Nr. 22/2019, über linda geprüft, nicht direkt in RIS), Karfreitag und 24. Dezember bewusst nicht eingetragen.

## 21.11.2026

- `content/ui.json` 0.3.0 (Ausnahme in Auftrag 04): neue Schlüssel `codex.coverTitle`, `codex.coverSubtitle`, `codex.coverStand`, `codex.runningHeadLeft`, `codex.runningHeadRight`, `codex.deliveryHeading`, `codex.register`, `codex.tabRegister`, `codex.lockedSheet`, `codex.nextPage`, `codex.prevPage`, `codex.noHits`, `codex.searchClear`, `aria.codexPage`, `aria.codexBook`; `aria.calcDisplay` jetzt „Rechneranzeige“. Kein Schlüssel entfernt. Bitte im Chat prüfen.
- Auftrag 04 umgesetzt (Kodex als Buch): `core/codex.ts` mit Gliederung, Suche, römischen Seitenzahlen und Lesestand; Spielstand um `codex.lastRuleId` und `codex.seenDay` erweitert; zugeklapptes Buch auf dem Tisch, aufgeschlagenes Buch als Dialog mit Seitenumbruch, Griffregister, Lesezeichenband, Blättern und Suche; EB Garamond in `public/audio/QUELLEN.md`.
- `SPEC.md` 0.3.2: Kodex als Buch (Abschnitt 6), Entscheidungen aus Bericht 03 übernommen (Abschnitte 4, 5, 7), Spielstand um `codex.lastRuleId` und `codex.seenDay` erweitert, `aria.calcDisplay` künftig „Rechneranzeige“. `auftraege/04-kodex-als-buch.md` angelegt.

- Auftrag 03 umgesetzt (Akt I komplett): Schema, Zusammenführen und Querprüfungen für `entscheidungen`, Widersprüche, Nachfrage, Story-Ereignisse und Spuren; Bewertung von Beträgen, Widersprüchen und Nachfragen; Tischrechner; Folgeakten vor den Akten des Tages; Schlussbildschirm „Ende von Akt I“; Übernahme von Spielständen aus 0.2.
- `content/akt1.json` 0.3.1 (auf Anweisung im Auftrag 03): unbenutzten Schlüssel `texts.optionLabels.lf` („Land- und Forstwirtschaft“) entfernt. Keine Entscheidung verwendet ihn, laut SPEC 3 ist das ein Ladefehler.
- `content/ui.json` 0.2.1 (Ausnahme in Auftrag 03): neue Schlüssel `desk.markPair`, `desk.markSide`, `desk.markRemove`, `evaluation.errorAbout`, `evaluation.inquiryCorrect`, `evaluation.inquiryAnswer`, `calculator.add`, `calculator.subtract`, `calculator.multiply`, `calculator.divide`, `aria.calcDisplay`, `aria.calcAdd`, `aria.calcSubtract`, `aria.calcMultiply`, `aria.calcDivide`, `aria.calcDecimal`, `aria.calcClear`, `aria.calcEquals`, `aria.markRemove`. Bitte im Chat prüfen.
- `content/akt1.json` 0.3.0: `akt1-tag1-3.json` und `akt1-tag4-10.json` zu einer Datei für den ganzen Akt I zusammengeführt (54 Regeln, 48 Akten), `meta.akt` ergänzt. Die beiden alten Dateien sind entfernt. `SPEC.md` 0.3.1 und Auftrag 03 verweisen auf die neue Datei.
- `SPEC.md` 0.3.0: ganzer Akt I (Tag 1 bis 10). Neuer Akten-Typ `entscheidungen` (Auswahl, Betrag, `offen`), Widersprüche markieren, Nachfrage mit Auswahl, Varianten, Hinweisregeln, Story-Ereignisse `newspaper`, `call`, `unlock`, `actSummary`, dazu `traces` und `event` (nur geprüft). `texts` wird über alle Dateien zusammengeführt. Tischrechner, Schlussbildschirm „Ende von Akt I“, Übernahme alter Spielstände.
- `content/akt1-tag4-10.json` 0.1.0 angelegt: Tag 4 bis 10, 47 Regeln (R8 bis R54), 37 Akten, 5 Folgeakten.
- `content/akt1-tag1-3.json` 0.2.0: Leertag 4 entfernt, Tag 4 steht jetzt in `akt1-tag4-10.json`.
- `content/ui.json` 0.2.0: neue Schlüssel für Betragsfeld, Markiermodus, Nachfrage, Zeitung, Anruf, Rechner, Hinweisregeln, Auswertung und Kopf ohne Beruf. `end.heading` lautet „Ende von Akt {act}“.
- `auftraege/03-akt1-komplett.md` angelegt. Inhalte und SPEC 0.3.0 liegen bis zur Umsetzung auf dem Branch `inhalt/akt1-tag4-10`.

## 20.11.2026

- `SPEC.md` 0.2.2: Loader- und Fehlermeldungen für Inhaltsautoren bleiben im Code (Ausnahme der Textregel). Kein eigener Ton-an/aus-Schalter, Lautstärke 0 und Musik 0 bedeuten aus. Abnahmekriterien um e2e-Textprüfung, Platzhalter und zugängliche Beschriftung ergänzt.
- `content/ui.json` 0.1.0 angelegt (Auftrag 02): alle Oberflächentexte und aria-Labels wortgleich aus `src/ui` übernommen, 10 Bereiche, 76 Schlüssel. Eigentümer ab jetzt der Chat.
- `SPEC.md` 0.2.1: Oberflächentexte in neuer `content/ui.json` (0.1.0), Musik (Akt 1), Pfeiltasten und Escape-Zoom aufgenommen, `Settings.music` im Spielstand, Rand-Abnahmekriterium, GitHub Pages im Unterpfad. `auftraege/02-texte-und-veroeffentlichung.md` angelegt.

- `content/akt1-tag1-3.json` 0.1.1: neuer Block `texts` (Anzeigenamen, Ermahnung, „unnötige Verzögerung“, Leertag), Tag 4 als eigener Eintrag mit `cases: []`, Akte 2-2 Position „Tageszeitung“ verweist auf R3 und R5.
- `SPEC.md` 0.2: kein Datum im Spiel, nur „Tag N“. Tag 4 aus dem JSON mit Leertag-Text und Schlussbildschirm. Spieltexte nur aus dem JSON. Nicht entschiedene Position zählt als Fehler (außer `offen`), Stempel ist endgültig. Neue Abnahmekriterien für Tag 4 und Spieltexte.

- `CLAUDE.md` und `auftraege/` angelegt: Dateieigentümer, Abgleichregel mit dem Claude-Projekt, Ablage für Arbeitsaufträge.
