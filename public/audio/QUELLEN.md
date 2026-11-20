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
| `buero.mp3` | [Empty Office Ambience](https://freesound.org/s/750799/) von simonjeffery13 | Mono, 64 kbit/s, 1,5 s Ein-/Ausblenden für die Schleife |

Lizenz jeweils am 20.11.2026 auf der Freesound-Seite geprüft.

## Musik

| Datei | Quelle | Bearbeitung |
| --- | --- | --- |
| `musik-akt1.mp3` | Eigenes 16-Bit-Arrangement von Walzer Nr. 1 aus „G'schichten aus dem Wienerwald“, op. 325, von Johann Strauß (Sohn), 1868, gemeinfrei. Melodie nach dem gemeinfreien [Klavierauszug auf Cantorion](https://cantorion.org/music/3404/), einzelne Takte ergänzt. | Komplett synthetisch erzeugt mit `tools/music/wienerwald16-loop.mjs` (`node tools/music/wienerwald16-loop.mjs out.wav`, dann `ffmpeg -i out.wav -b:a 128k musik-akt1.mp3`). Nahtlose Schleife, 48 Takte, 32 kHz. |

**Herkunft der Noten:** Die Melodie ist von Hand in eigene Notation übertragen (Tonhöhen und Dauern als Zahlen in `tools/music/wienerwald16-loop.mjs`), Begleitung, Harmonisierung, Klangfarben und Form sind eigenes Arrangement. Vorlage war der Klavierauszug auf Cantorion, laut Seite die Ausgabe A. Cranz, Hamburg, um 1895 (Platte 23356), dort als „Public domain“ gekennzeichnet. Es wurde keine Aufnahme und keine neuere Notenausgabe verwendet.
