import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4175";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "public-workflows.spec.ts",
    "tour.spec.ts",
    "analysis-layout.spec.ts",
  ],
  fullyParallel: true,
  grepInvert: /@visual/,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 30_000,
  outputDir: "test-results/e2e-public",
  reporter: "list",
  use: {
    baseURL,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4175 --strictPort",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 60_000,
      },
});
