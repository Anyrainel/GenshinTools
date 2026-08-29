import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const factoryRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(factoryRoot, "../../src"),
    },
  },
  test: {
    environment: "node",
    include: ["scripts/guide-factory/tests/**/*.test.ts"],
    testTimeout: 15000,
  },
});
