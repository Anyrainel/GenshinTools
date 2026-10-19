import { defineConfig } from "@playwright/test";
import publicConfig from "./playwright.public.config";

export default defineConfig(publicConfig, {
  grep: /@visual/,
  grepInvert: [],
  timeout: 90_000,
  outputDir: "test-results/e2e-visual",
});
