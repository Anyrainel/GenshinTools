import { describe, expect, it } from "vitest";
import { ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS } from "../src/artifactGenerationPreflight";
import { DERIVED_FORMULA_FIXTURE_COVERAGE_INPUT_PATHS } from "../src/derivedFormulaFixtureCoverage";
import { FURINA_NEUVILLETTE_FORMULA_DRAFT_INPUT_PATHS } from "../src/furinaNeuvilletteFormulaDraft";
import { KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS } from "../src/keqingIneffaFormulaDraft";
import { TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS } from "../src/teamRosterCandidateDomainExperiment";
import { TEAM_TEMPLATE_COVERAGE_INPUT_PATHS } from "../src/teamTemplateCoverage";

const SCHEMA_PATH = "scripts/guide-factory/src/schemas.ts";
const INVESTMENT_HELPER_PATH =
  "scripts/guide-factory/src/teamMemberInvestment.ts";

describe("bounded-investment durable input authentication", () => {
  it("pins the schema and shared matcher into both formula fixtures", () => {
    for (const paths of [
      FURINA_NEUVILLETTE_FORMULA_DRAFT_INPUT_PATHS,
      KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS,
    ]) {
      expect(paths).toEqual(
        expect.arrayContaining([SCHEMA_PATH, INVESTMENT_HELPER_PATH]),
      );
    }
  });

  it("pins the shared matcher into every downstream report that executes it", () => {
    expect(ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS).toContain(
      INVESTMENT_HELPER_PATH,
    );
    expect(TEAM_TEMPLATE_COVERAGE_INPUT_PATHS).toEqual(
      expect.arrayContaining([SCHEMA_PATH, INVESTMENT_HELPER_PATH]),
    );
    expect(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS).toContain(
      INVESTMENT_HELPER_PATH,
    );
    expect(DERIVED_FORMULA_FIXTURE_COVERAGE_INPUT_PATHS).toEqual(
      expect.arrayContaining([SCHEMA_PATH, INVESTMENT_HELPER_PATH]),
    );
  });
});
