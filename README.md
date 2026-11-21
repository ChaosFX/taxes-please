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

Stand: Akt I (Tag 1 bis 10), SPEC 0.3.1, Auftrag 03.
