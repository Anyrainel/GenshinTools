import path from "node:path";
import {
  buildDionaErCalibrationReport,
  DIONA_ER_ENGINE_INPUT_PATHS,
} from "./dionaErCalibration";
import { readJson, sha256File, writeJson } from "./io";
import {
  DIONA_ER_CALIBRATION_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

const [repositoryInput, engineInputs] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  Promise.all(
    DIONA_ER_ENGINE_INPUT_PATHS.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    }))
  ),
]);

const report = buildDionaErCalibrationReport(
  KnowledgeRepositorySchema.parse(repositoryInput),
  engineInputs
);
await writeJson(DIONA_ER_CALIBRATION_REPORT_PATH, report);

console.log(
  `Diona Favonius ER calibration: ${report.status}; ` +
    report.outputs
      .map(({ particleMode, diona }) => `${particleMode}=${diona.erPercent}%`)
      .join(", ")
);
