# Auftrag 01 – Optik und Gefühl

Bezug: `SPEC.md` Abschnitt 10 Schritt 3, Inhalt in Abschnitt 7. Stand der Vorgaben: SPEC 0.2.

## Ziel

Aus der schlichten, spielbaren Oberfläche wird der Wiener Schreibtisch aus Abschnitt 7: Papiere lassen sich ziehen, Stempel schlagen auf, alles bleibt per Tastatur bedienbar und ohne Effekte vollständig spielbar.

## Betroffene Dateien

`src/ui/` (vor allem `views.ts`, `style.css`), neue Module unter `src/ui/` nach Bedarf, `src/audio/` falls Sound umgesetzt wird, `tests/e2e/`. `src/core/` und `content/` bleiben unverändert.

## Reihenfolge

Arbeite in dieser Reihenfolge. Nach jedem Punkt Screenshots mit Playwright (SPEC 10.4) und selbst prüfen: Text lesbar, nichts überlappt, alle Bedienelemente sichtbar.

1. **Einstellungen:** Effekte „aus“, „reduziert“, „voll“. `prefers-reduced-motion` setzt „reduziert“. Die Einstellung wird gespeichert (SPEC 9).
2. **Papier und Tisch:** Holztisch, grüne Schreibunterlage, Papier in gebrochenem Weiß mit Schreibmaschinenschrift, feine Papierstruktur, Drehung von ein bis zwei Grad, Büroklammern bei Belegen, blasser Kanzleistempel unten links bei Dokumenten mit `stamp`.
3. **Ziehen:** Pointer Events für Maus und Touch. Beim Aufnehmen leicht vergrößern, weicherer und längerer Schatten, Neigung je nach Zugrichtung, kurze Ablege-Animation. Das zuletzt angefasste Papier liegt oben. Nur `transform` animieren. Bei „aus“ ohne Animation.
4. **Zoom:** Doppelklick auf ein Papier zoomt es lesbar heran, erneuter Doppelklick legt es zurück.
5. **Stempel:** Aufschlag mit kurzer Skalierungs-Animation und leichtem Wackeln der Arbeitsfläche. Der Abdruck bleibt auf dem Prüfvermerk sichtbar. Der Stempel bleibt endgültig (SPEC 4.4).
6. **Sound (optional, zuletzt):** Stempel, Papierrascheln, leises Büro-Ambiente. Lautstärke-Regler. Wenn keine Audiodateien mit freier Lizenz vorliegen, den Sound weglassen und im Bericht nennen, statt Platzhalter einzubauen.

## Abnahmekriterien

- [ ] Alle vier Tage sind weiter durchspielbar, auch mit Neuladen (bestehende e2e-Tests laufen grün).
- [ ] Papiere lassen sich mit Maus und Touch ziehen. Bei „Effekte aus“ gibt es keine Animation, das Ziehen funktioniert trotzdem.
- [ ] Alle Entscheidungen und Stempel sind weiter per Tastatur erreichbar, der Fokus ist sichtbar. Das Ziehen darf keine Pflicht sein, um eine Akte zu bearbeiten.
- [ ] Doppelklick-Zoom funktioniert und lässt sich mit der Tastatur auslösen.
- [ ] `prefers-reduced-motion` setzt automatisch „reduziert“.
- [ ] Der Kontrast von Text auf Papier und auf dem Tisch ist ausreichend lesbar, Screenshots belegen es.
- [ ] `npm test` und `npm run test:e2e` laufen grün, `npm run build` läuft.
- [ ] Kein neuer Spieltext im Code (Test `no-hardcoded-text` bleibt grün). Fehlt ein Text im JSON, melden.

## Nicht Teil dieses Auftrags

Three.js und die Atmosphäre-Ebene (bleibt Stub, SPEC 8), Pinnwand, Telefon, Zeitung, Rechner, weitere Tage und Akten, Änderungen an Spiellogik oder Inhalt.

## Bericht

Bitte pro Punkt 1 bis 6: erledigt, offen oder abweichend, plus die Screenshots. Hinweise auf Widersprüche in SPEC oder JSON einzeln auflisten, ohne sie im Code zu lösen.
