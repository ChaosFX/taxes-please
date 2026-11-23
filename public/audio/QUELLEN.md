# Audioquellen

Alle Dateien stammen von [Freesound](https://freesound.org) und stehen unter
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (gemeinfrei, keine Namensnennung nötig).
Verwendet werden die öffentlichen MP3-Vorschauen, in Mono umgewandelt und teils gekürzt (ffmpeg).

| Datei | Quelle | Bearbeitung |
| --- | --- | --- |
| `stempel-1.mp3` | [Stamp](https://freesound.org/s/362622/) von kermite607 | Mono, 96 kbit/s |
| `stempel-2.mp3` | [Stamp](https://freesound.org/s/362623/) von kermite607 | Mono, 96 kbit/s |
| `stempel-3.mp3` | [Stamp](https://freesound.org/s/362624/) von kermite607 | Mono, 96 kbit/s |
| `papier-1.mp3` | [rustling paper.wav](https://freesound.org/s/181774/) von keweldog | Ausschnitt 0,95–2,40 s, Ein-/Ausblenden |
| `papier-2.mp3` | [rustling paper.wav](https://freesound.org/s/181774/) von keweldog | Ausschnitt 2,58–3,63 s, Ein-/Ausblenden |
| `ablage-1.mp3` | [01_pokladani_papiru_na_lavici.wav](https://freesound.org/s/379888/) von 13GPanska_Markova_Lucie | Ausschnitt 0,78–2,33 s, Hochpass 120 Hz, Ein-/Ausblenden, Pegel angeglichen |
| `ablage-2.mp3` | [PaperSlide.wav](https://freesound.org/s/464302/) von eyesonlegs | Ausschnitt 0–1,45 s, Hochpass 120 Hz, Ausblenden, Pegel angeglichen |
| `telefon.mp3` | [Old Rotary Phone Ringing - Western Electric Bell 500 phone](https://freesound.org/s/456433/) von mycompasstv | Ausschnitt 13,2–16,2 s (ein Klingeln), Ausblenden 0,6 s, Lautheit angeglichen (loudnorm −18 LUFS), Mono, 96 kbit/s |
| `buero.mp3` | [Empty Office Ambience](https://freesound.org/s/750799/) von simonjeffery13 | Mono, 64 kbit/s, 1,5 s Ein-/Ausblenden für die Schleife |
| `bleistift.mp3` | [Pencil Circle](https://freesound.org/s/860361/) von sokworks | Mono, −6 dB, Ausblenden ab 0,40 s, 96 kbit/s |

Lizenz jeweils am 20.11.2026 (`telefon.mp3`: 21.11.2026, `bleistift.mp3`: 23.11.2026) auf der Freesound-Seite geprüft.

## Musik

| Datei | Quelle | Bearbeitung |
| --- | --- | --- |
| `musik-akt1.mp3` | Eigenes 16-Bit-Arrangement von Walzer Nr. 1 aus „G'schichten aus dem Wienerwald“, op. 325, von Johann Strauß (Sohn), 1868, gemeinfrei. Melodie nach dem gemeinfreien [Klavierauszug auf Cantorion](https://cantorion.org/music/3404/), einzelne Takte ergänzt. | Komplett synthetisch erzeugt mit `tools/music/wienerwald16-loop.mjs` (`node tools/music/wienerwald16-loop.mjs out.wav`, dann `ffmpeg -i out.wav -b:a 128k musik-akt1.mp3`). Nahtlose Schleife, 48 Takte, 32 kHz. |

**Herkunft der Noten:** Die Melodie ist von Hand in eigene Notation übertragen (Tonhöhen und Dauern als Zahlen in `tools/music/wienerwald16-loop.mjs`), Begleitung, Harmonisierung, Klangfarben und Form sind eigenes Arrangement. Vorlage war der Klavierauszug auf Cantorion, laut Seite die Ausgabe A. Cranz, Hamburg, um 1895 (Platte 23356), dort als „Public domain“ gekennzeichnet. Es wurde keine Aufnahme und keine neuere Notenausgabe verwendet.

## Schriften

Alle Schriften sind lokal über npm (`@fontsource`) eingebunden und werden mit dem Build ausgeliefert, nichts wird von fremden Servern geladen.

| Schrift | Verwendung | Paket | Lizenz |
| --- | --- | --- | --- |
| Courier Prime | Papiere, Schreibmaschinenschrift | `@fontsource/courier-prime` | SIL Open Font License 1.1 |
| Old Standard TT (Alexey Kryukov, The Old Standard Project Authors) | Morgenzeitung: Kopf, Schlagzeile und Text in Antiqua-Anmutung | `@fontsource/old-standard-tt` 5.3.0 | SIL Open Font License 1.1 (Lizenztext in `node_modules/@fontsource/old-standard-tt/LICENSE`) |
| EB Garamond (Georg Duffner, Octavio Pardo, The EB Garamond Project Authors) | Kodex als Buch: Einband, Seiten, Inhaltsverzeichnis, Kapitälchen | `@fontsource/eb-garamond` 5.3.0 | SIL Open Font License 1.1 (Lizenztext in `node_modules/@fontsource/eb-garamond/LICENSE`) |
