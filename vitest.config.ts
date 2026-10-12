import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react({ tsDecorators: true })],
  test: {
    environment: "jsdom",
    globals: true,
    dangerouslyIgnoreUnhandledErrors: false,
    testTimeout: 15000,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/worker/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: [
        "src/lib/**",
        "src/domain/**",
        "src/providers/**",
        "src/services/**",
        "src/stores/**",
        "src/components/**",
        "src/hooks/**",
      ],
      exclude: [
        "src/components/ui/**", // shadcn primitives — not unit tested
        "src/data/**", // static game data / constants
        "src/presets/**", // bundled preset JSONs
        "src/domain/combat/damage/impl/**", // per-character/weapon data definitions
        "src/domain/combat/damage/index.ts", // registration boilerplate
        "src/app/tourConfig.tsx", // UI tour definitions
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 58,
        functions: 52,
        branches: 43,
        statements: 58,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
