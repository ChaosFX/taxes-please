# Änderungsprotokoll

Gemeinsame Dateien (`SPEC.md`, `content/*.json`) werden im Claude-Projekt und in diesem Repo parallel geführt. Jede Änderung steht hier mit Datum, Datei und Version.

## 20.11.2026

- `SPEC.md` 0.2.2: Loader- und Fehlermeldungen für Inhaltsautoren bleiben im Code (Ausnahme der Textregel). Kein eigener Ton-an/aus-Schalter, Lautstärke 0 und Musik 0 bedeuten aus. Abnahmekriterien um e2e-Textprüfung, Platzhalter und zugängliche Beschriftung ergänzt.
- `content/ui.json` 0.1.0 angelegt (Auftrag 02): alle Oberflächentexte und aria-Labels wortgleich aus `src/ui` übernommen, 10 Bereiche, 76 Schlüssel. Eigentümer ab jetzt der Chat.
- `SPEC.md` 0.2.1: Oberflächentexte in neuer `content/ui.json` (0.1.0), Musik (Akt 1), Pfeiltasten und Escape-Zoom aufgenommen, `Settings.music` im Spielstand, Rand-Abnahmekriterium, GitHub Pages im Unterpfad. `auftraege/02-texte-und-veroeffentlichung.md` angelegt.

- `content/akt1-tag1-3.json` 0.1.1: neuer Block `texts` (Anzeigenamen, Ermahnung, „unnötige Verzögerung“, Leertag), Tag 4 als eigener Eintrag mit `cases: []`, Akte 2-2 Position „Tageszeitung“ verweist auf R3 und R5.
- `SPEC.md` 0.2: kein Datum im Spiel, nur „Tag N“. Tag 4 aus dem JSON mit Leertag-Text und Schlussbildschirm. Spieltexte nur aus dem JSON. Nicht entschiedene Position zählt als Fehler (außer `offen`), Stempel ist endgültig. Neue Abnahmekriterien für Tag 4 und Spieltexte.

- `CLAUDE.md` und `auftraege/` angelegt: Dateieigentümer, Abgleichregel mit dem Claude-Projekt, Ablage für Arbeitsaufträge.
