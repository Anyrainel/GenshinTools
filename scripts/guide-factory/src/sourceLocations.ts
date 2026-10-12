import path from "node:path";
import { REPOSITORY_ROOT } from "./paths";

// Historical checkpoint labels keep their original identities. When a tool
// hashes the live tree, read the current owner and retain the recorded label.
// Changed bytes still fail the checkpoint's existing authentication checks.
export function currentSourceLocation(filePath: string): string {
  const relative = path.relative(REPOSITORY_ROOT, filePath).replace(/\\/g, "/");
  const exact: Record<string, string> = {
    "src/data/betaState.ts": "src/stores/betaState.ts",
    "src/data/charInfo.ts": "src/data/characterInfo.ts",
    "src/data/constants.ts": "src/config/gameConstants.ts",
    "src/data/enums.ts": "src/domain/enums.ts",
    "src/data/types.ts": "src/domain/models.ts",
    "src/data/gameDataUtil.ts": "src/lib/resources/cache.ts",
    "src/data/gameResources.ts": "src/domain/reference/catalog.ts",
    "src/data/gameStatsLoader.ts": "src/providers/reference/statLoaders.ts",
    "src/data/utils.ts": "src/domain/build/statUtils.ts",
  };
  const prefixes = [
    ["src/lib/dmgcalc/", "src/domain/combat/damage/"],
    ["src/lib/artifact/", "src/domain/build/artifact/"],
    ["src/lib/team-comp/generator/", "src/domain/combat/generator/"],
    ["src/lib/team-comp/optimizer/", "src/domain/combat/optimizer/"],
    ["src/lib/team-comp/", "src/domain/team/"],
  ];
  const prefix = prefixes.find(([from]) => relative.startsWith(from));
  const owner = exact[relative] ?? (prefix ? prefix[1] + relative.slice(prefix[0].length) : relative);
  return path.resolve(REPOSITORY_ROOT, owner);
}
