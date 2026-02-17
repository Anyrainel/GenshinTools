import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { presetWatcher } from "./vite-plugin-preset-watcher";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "github" ? "/GenshinTools/" : "/",
  plugins: [react(), presetWatcher()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
}));
