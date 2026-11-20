# Auftrag 02 – Texte auslagern, Rand, Veröffentlichung

Bezug: Bericht zu Auftrag 01 (main @ d481231). Stand der Vorgaben: `SPEC.md` 0.2.1, bereits im Repo (ersetzt 0.2, `CHANGELOG.md` ist nachgezogen).

## Ziel

Kein Text, den ein Spieler liest oder ein Screenreader vorliest, steht mehr im Code. Das gezogene Papier wird am Rand nicht abgeschnitten. Die Seite läuft auf GitHub Pages.

## Betroffene Dateien

`src/ui/`, `src/audio/`, neue Datei `content/ui.json` (Eigentümer ab jetzt der Chat, wie die anderen JSON-Dateien; Umzug der Texte erledigst du einmalig), `tests/`, `.github/workflows/`, `vite.config.ts`, `public/audio/QUELLEN.md`. `src/core/` bleibt unverändert, außer dem schon bestehenden Feld `music`.

## Entscheidungen zu deinen Rückfragen

1. **Oberflächentexte gelten als Text, der nicht im Code stehen darf.** Sie kommen in eine neue Datei `content/ui.json`, nicht in `akt1-tag1-3.json`, weil sie an keinem Spieltag hängen. Das Akt-JSON bleibt bei 0.1.1.
2. **`src/core`-Änderung (`Settings.music`, Standard 0,5) ist akzeptiert.**
3. **Musik für Akt 1 ist angenommen**, unter einer Bedingung: Das Arrangement entsteht aus eigener Notation und nicht aus einer Aufnahme oder einer geschützten Notenausgabe. Strauß ist gemeinfrei, eine Edition oder Aufnahme kann es nicht sein. Bestätige das in `public/audio/QUELLEN.md` mit einem Satz zur Herkunft der Noten. Wenn du das nicht sicher sagen kannst, melde es im Bericht.
4. **Pfeiltasten, Escape beim Zoom und der Ablage-Sound sind angenommen.** Alles steht in der SPEC.

## Aufgaben

### 1. `content/ui.json` und Zugriff über Schlüssel
- Lege `content/ui.json` an (`"version": "0.1.0"`), gegliedert nach Bereichen, zum Beispiel `settings`, `desk`, `codex`, `evaluation`, `title`, `end`, `aria`. Jeder Eintrag ist ein String, Platzhalter als `{name}`.
- Ziehe **alle** Texte aus `src/ui` und `src/audio` hinein, die ein Spieler liest oder ein Screenreader vorliest. Das sind mindestens die in deinem Bericht genannten (Einstellungen, Effekte, Ton, Lautstärke, Musik, aus/reduziert/voll, aria-Labels, Prüfvermerk, Position/Betrag/Entscheidung, „Erst stempeln, dann ablegen.“, „Der Tisch ist leer …“, Kodex öffnen/schließen, „Ende des Prototyps“, „Lösung und Begründung“), dazu alles, was beim Durchsehen von `src/` sonst auftaucht: Startbildschirm, Tagesbeginn, Kodex („neu“, „vereinfacht“, „ab Tag N“, Suche), Auswertung, Bestätigungsdialog bei „Neues Spiel“, Fehlermeldungen des Loaders, die der Spieler sieht.
- **Wortgleich übernehmen.** Du formulierst nichts um und verbesserst keinen Ton. Die Durchsicht der Texte mache ich danach im Chat.
- Typisierte Funktion `t("bereich.schluessel", { name: wert })`. Der Schlüsselraum ist aus dem Schema oder dem JSON-Typ abgeleitet, ein unbekannter Schlüssel ist ein Kompilierfehler. Der Loader prüft `ui.json` mit zod. Fehlt ein Schlüssel, bricht der Start mit klarer Meldung ab.
- Zahlen- und Betragsformat (`1.200,00 €`) bleibt Code, das ist keine Beschriftung.

### 2. Test verschärfen
- Ersetze `no-hardcoded-text` durch einen Test, der in `src/` deutsche Textliterale findet (Strings, Template-Literale, JSX-ähnliche Textknoten in `innerHTML` und Templates). Verwende den TypeScript-Compiler oder einen Parser, kein reines Regex-Raten.
- Kriterium: ein Literal gilt als Text, wenn es Leerzeichen oder Umlaute enthält, mit Großbuchstaben beginnt und nicht erkennbar technisch ist (CSS-Klasse, Selektor, Event-Name, Pfad, Schlüssel, MIME-Typ, localStorage-Schlüssel). Wähle die Heuristik so, dass sie nichts Echtes durchlässt, und halte die Ausnahmen in einer **kurzen Liste mit Begründung** direkt im Test.
- Zusätzlich: Jeder Schlüssel in `ui.json` wird im Code verwendet, und jeder im Code verwendete Schlüssel steht in `ui.json`.
- Beweise, dass der Test greift: Schreibe ihn zuerst, sieh ihn gegen den aktuellen Code rot werden und erst danach grün. Nenne im Bericht, wie viele Treffer er vor dem Umzug hatte.

### 3. Rand der Unterlage
- Ein gezogenes Papier darf nirgends abgeschnitten werden (Befund in `12-gezogen-gestempelt.png`). Begrenze die Ablageposition so, dass die gedrehte Hülle des Papiers (inklusive Drehung) vollständig in der Unterlage bleibt, auch beim Ziehen mit Pfeiltasten und beim Zoom-Zurücklegen. Ändere `overflow: hidden` nur, wenn das Begrenzen nicht reicht.
- Neuer e2e-Test: Papier an jede der vier Kanten und in jede Ecke ziehen (Maus) und mit Pfeiltasten dorthin schieben. Prüfe jeweils, dass die Bounding-Box vollständig innerhalb der Unterlage liegt.

### 4. Einstellungen und Spielstand
- Unit-Test: Ein Spielstand ohne `music` (altes Format) lädt, `music` bekommt 0,5, der übrige Spielstand bleibt unverändert. Dasselbe für jedes andere einzelne fehlende Einstellungsfeld.
- Musik ist beim ersten Start hörbar nur nach der ersten Nutzeraktion. Regler 0 schaltet die Musik komplett ab (kein Dekodieren im Hintergrund nötig, kein Knacken beim Umschalten).

### 5. GitHub Pages
- Prüfe, ob die Veröffentlichung läuft. Falls nicht: Workflow in `.github/workflows/` (Build mit `npm ci`, `npm test`, `npm run build`, Deploy mit den offiziellen Pages-Actions), Vite-`base` relativ, damit die Seite unter `https://chaosfx.github.io/taxes-please/` läuft.
- Prüfe den gebauten Stand lokal unter einem Unterpfad (zum Beispiel `vite preview --base`): Schrift, Audio, JSON-Dateien und Neuladen auf dem Spielbildschirm müssen funktionieren. Ein e2e-Test dafür ist willkommen.
- Wenn du die Pages-Einstellung im Repository nicht selbst setzen kannst, sag im Bericht genau, was Dominik anklicken muss.
- Ein Impressum oder Datenschutztext ist nicht Teil dieses Auftrags. Der Startbildschirm hat den Hinweis auf Fiktion und Vereinfachung, das genügt vorerst.

## Nicht in diesem Auftrag
Neue Spielinhalte, Änderungen an `akt1-tag1-3.json`, neue Mechaniken (Begründung beim Stempel kommt mit SPEC 0.3), weitere Musik, Atmosphäre-Ebene.

## Abnahmekriterien
- [ ] `content/ui.json` existiert, wird mit Schema geprüft, der Code greift nur über `t(...)` zu.
- [ ] Der neue Textliteral-Test schlug vor dem Umzug fehl und ist danach grün. Die Ausnahmenliste steht im Test und ist begründet.
- [ ] Kein sichtbarer oder vorgelesener Text im Code, geprüft auch von dir per Suche über `src/` (Ergebnis im Bericht).
- [ ] Alle Texte sind wortgleich zu vorher. Ein Screenshot-Vergleich von Startbildschirm, Schreibtisch, Kodex und Auswertung vor und nach dem Umzug zeigt keinen Unterschied.
- [ ] Kein Papier wird an einem Rand abgeschnitten, e2e-Test belegt es.
- [ ] Spielstand ohne `music` lädt mit Standardwert.
- [ ] `QUELLEN.md` nennt die Herkunft der Noten der Musik.
- [ ] Die Seite läuft unter dem Pages-Unterpfad (lokal geprüft, Deployment-Status im Bericht).
- [ ] `npm test`, `npm run test:e2e` und `npm run build` sind grün. `SPEC.md` im Repo ist 0.2.1, `CHANGELOG.md` ist nachgezogen.

## Bericht
Gleiche Form wie bei Auftrag 01: Tests, Aufgaben 1 bis 5 mit Status, Abnahmekriterien, Screenshots, Abweichungen (mit Fragen an den Chat), Widersprüche in SPEC und JSON. Zusätzlich: Liste aller Schlüssel in `ui.json` mit dem Text, damit ich sie im Chat auf Ton und Rechtschreibung durchsehen kann.
