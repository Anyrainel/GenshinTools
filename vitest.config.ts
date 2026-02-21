import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react({ tsDecorators: true })],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/stores/**", "src/components/**"],
      exclude: [
        "src/components/ui/**", // shadcn primitives
        "src/data/**", // static game data / constants
        "src/presets/**", // bundled preset JSONs
        "src/lib/team-comp/impl/**", // per-character/weapon data definitions
        "src/lib/team-comp/registry.ts", // registration boilerplate
        "src/lib/tourConfig.ts", // UI tour definitions
        "**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
