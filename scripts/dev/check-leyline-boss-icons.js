import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bossInfoPath = path.join(repoRoot, "src/data/game/leyline_boss_info.json");
const resourceMapPath = path.join(repoRoot, "src/data/resources_manual.ts");
const enemyAssetDir = path.join(repoRoot, "public/enemy");

const bossInfo = JSON.parse(readFileSync(bossInfoPath, "utf8"));
const resourceMapSource = readFileSync(resourceMapPath, "utf8");
const mapBody = resourceMapSource.match(
  /LEYLINE_BOSS_IMAGE_ENEMY_ID[^=]*=\s*\{([\s\S]*?)\n\};/
)?.[1];

if (!mapBody) {
  throw new Error(`Could not read the Ley Line boss icon map in ${resourceMapPath}`);
}

const imageIdByBossId = new Map();
for (const match of mapBody.matchAll(/^\s*(\d+):\s*"([^"]+)"/gm)) {
  imageIdByBossId.set(Number(match[1]), match[2]);
}

const scheduledBossIds = [
  ...new Set(bossInfo.schedules.flatMap((schedule) => schedule.boss_ids)),
].sort((a, b) => a - b);

const problems = [];
for (const bossId of scheduledBossIds) {
  const imageId = imageIdByBossId.get(bossId);
  if (!imageId) {
    problems.push(`Boss ${bossId} has no representative icon mapping`);
    continue;
  }

  const assetPath = path.join(enemyAssetDir, `${imageId}.webp`);
  if (!existsSync(assetPath) || statSync(assetPath).size === 0) {
    problems.push(`Boss ${bossId} maps to missing icon public/enemy/${imageId}.webp`);
  }
}

if (problems.length > 0) {
  console.error("Ley Line boss icon coverage check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`Ley Line boss icon coverage: ${scheduledBossIds.length}/${scheduledBossIds.length}`);
