import { defineConfig } from '@playwright/test';
import { BASE_PATH } from './tests/e2e/base-path';

/**
 * All e2e tests run against the production build served under the GitHub Pages
 * sub-path (https://chaosfx.github.io/taxes-please/), so every test also checks
 * that fonts, audio and the bundled JSON are found there (SPEC 11).
 */

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://localhost:4173${BASE_PATH}`, viewport: { width: 1440, height: 900 } },
  webServer: {
    command: `npm run build && npx vite preview --port 4173 --strictPort --base ${BASE_PATH}`,
    url: `http://localhost:4173${BASE_PATH}`,
    reuseExistingServer: true,
  },
});
