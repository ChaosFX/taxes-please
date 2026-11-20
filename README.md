# Taxes Please – Prototyp

Lernspiel zum österreichischen Steuerrecht. Spezifikation: [SPEC.md](SPEC.md). Inhalte: `content/*.json`.

```
npm install
npm run dev          # Entwicklungsserver
npm test             # Vitest: core + Inhaltsvalidierung
npm run test:e2e     # Playwright: Durchspielen, Tastatur, Kodex, Screenshots
npm run screenshots  # nur Screenshots nach screenshots/
npm run build        # statischer Build nach dist/ (GitHub Pages via .github/workflows/deploy.yml)
```

Stand: SPEC Abschnitt 10, Schritt 1 (core) und 2 (schlichte Oberfläche ohne Animationen).
