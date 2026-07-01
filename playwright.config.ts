import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'qa/tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'qa/artifacts/playwright-results.json' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:8081',
    viewport: { width: 390, height: 844 },
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run web -- --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
