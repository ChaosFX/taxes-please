import { defineConfig, devices } from '@playwright/test';
import { BASE_PATH } from './tests/e2e/base-path';

/**
 * All e2e tests run against the production build served under the GitHub Pages
 * sub-path (https://chaosfx.github.io/taxes-please/), so every test also checks
 * that fonts, audio and the bundled JSON are found there (SPEC 11).
 *
 * Browsers: Chromium (Chrome, Edge), Firefox and WebKit (Safari). WebKit does not
 * install on every Linux (e.g. Fedora); locally use `npm run test:e2e:local`, the
 * CI runs all three. Screenshots are taken with Chromium only.
 */

const viewport = { width: 1440, height: 900 };

export default defineConfig({
  testDir: 'tests/e2e',
  // CI runners are slower and share their CPU: one retry, reported as „flaky“.
  retries: process.env.CI ? 1 : 0,
  // Trace of the retry run lands in test-results/ and is uploaded by the CI on failure.
  use: { baseURL: `http://localhost:4173${BASE_PATH}`, viewport, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport }, testIgnore: /screenshots\.spec\.ts/ },
    // WebKit paints without GPU on Linux and at times stops painting on CI runners,
    // so it runs only the smoke set (tests tagged @smoke). A hang fails after two
    // minutes and is not retried.
    { name: 'webkit', grep: /@smoke/, timeout: 120_000, retries: 0, use: { ...devices['Desktop Safari'], viewport } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port 4173 --strictPort --base ${BASE_PATH}`,
    url: `http://localhost:4173${BASE_PATH}`,
    reuseExistingServer: true,
  },
});
