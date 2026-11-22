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
  use: { baseURL: `http://localhost:4173${BASE_PATH}`, viewport },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport }, testIgnore: /screenshots\.spec\.ts/ },
    // WebKit paints without GPU on Linux (box-shadows are expensive): every click
    // waits up to half a second for a frame, so tests get three times the default time.
    { name: 'webkit', timeout: 90_000, use: { ...devices['Desktop Safari'], viewport }, testIgnore: /screenshots\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port 4173 --strictPort --base ${BASE_PATH}`,
    url: `http://localhost:4173${BASE_PATH}`,
    reuseExistingServer: true,
  },
});
