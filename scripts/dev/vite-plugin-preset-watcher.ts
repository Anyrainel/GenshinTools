import type { Plugin } from "vite";

/**
 * Watches `src/presets/` for JSON file additions and deletions.
 * import.meta.glob patterns are resolved at transform time, so new files
 * aren't picked up until modules are re-transformed. This plugin
 * invalidates glob-consuming modules and triggers a page reload when
 * the preset file list changes.
 */
export function presetWatcher(): Plugin {
  return {
    name: "preset-watcher",
    apply: "serve",
    configureServer(server) {
      const isPresetJson = (filePath: string) =>
        filePath.replace(/\\/g, "/").includes("src/presets/") &&
        filePath.endsWith(".json");

      const reload = (filePath: string) => {
        if (!isPresetJson(filePath)) return;

        // Invalidate loaded modules for this file so Vite re-transforms
        // them (re-expanding import.meta.glob) on next request.
        const modules = server.moduleGraph.getModulesByFile(filePath);
        if (modules) {
          for (const mod of modules) {
            server.moduleGraph.invalidateModule(mod);
          }
        }

        server.ws.send({ type: "full-reload" });
        server.config.logger.info(
          "[preset-watcher] preset file changed → full reload",
          { timestamp: true }
        );
      };

      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
    },
  };
}
