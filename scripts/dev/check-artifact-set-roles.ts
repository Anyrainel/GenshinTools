import { ARTIFACT_SET_ROLE_IDS } from "../../src/data/constants";
import { artifacts } from "../../src/data/resources";

const releasedIds = new Set(artifacts.map((artifact) => artifact.id));
const assignments = Object.entries(ARTIFACT_SET_ROLE_IDS).flatMap(
  ([role, setIds]) => setIds.map((setId) => ({ role, setId }))
);
const assignedIds = new Set(assignments.map(({ setId }) => setId));

const duplicateIds = assignments
  .filter(
    ({ setId }, index) =>
      assignments.findIndex((assignment) => assignment.setId === setId) !==
      index
  )
  .map(({ setId }) => setId);
const missingIds = [...releasedIds].filter((setId) => !assignedIds.has(setId));
const unknownIds = [...assignedIds].filter((setId) => !releasedIds.has(setId));

if (duplicateIds.length || missingIds.length || unknownIds.length) {
  console.error("Artifact set role coverage is invalid.");
  if (missingIds.length) {
    console.error(
      `Unassigned released sets: ${missingIds.sort().join(", ")}`
    );
  }
  if (duplicateIds.length) {
    console.error(`Sets with multiple roles: ${duplicateIds.sort().join(", ")}`);
  }
  if (unknownIds.length) {
    console.error(`Unknown assigned sets: ${unknownIds.sort().join(", ")}`);
  }
  process.exit(1);
}

console.log(
  `Artifact set roles complete: ${assignments.length} released sets assigned.`
);
