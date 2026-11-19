import type { AccountData, ArtifactData } from "@/domain/models";
import {
  convertGOODToAccountData,
  type GOODData,
  type GOODImportOptions,
} from "@/providers/scanner/formats/goodConversion";
import { mergePartialAccountData } from "./mergeAccountData";

/** A continuous snapshot replaces supplied sections; it never appends a second inventory. */
export function prepareContinuousImport(
  good: GOODData,
  existing: AccountData,
  options: GOODImportOptions = { keepFourStarOfFiveStarSets: true }
) {
  const converted = convertGOODToAccountData(
    good,
    existing.characters,
    options
  );
  for (const raw of good.characters ?? []) {
    if (raw.talent !== undefined) continue;
    const key = convertGOODToAccountData({
      ...good,
      characters: [raw],
      weapons: undefined,
      artifacts: undefined,
    }).data.characters[0]?.key;
    const character = converted.data.characters.find((c) => c.key === key);
    const previous = existing.characters.find((c) => c.key === key);
    if (character && previous) character.talent = previous.talent;
  }
  const sections = {
    characters: Array.isArray(good.characters),
    weapons: Array.isArray(good.weapons),
    artifacts: Array.isArray(good.artifacts),
  };
  const rawByArtifact = new Map(
    [
      ...converted.data.characters.flatMap((c) => Object.values(c.artifacts)),
      ...converted.data.extraArtifacts,
    ]
      .filter((a): a is ArtifactData => !!a)
      .map((a) => [a, good.artifacts?.[Number(a.id.replace("artifact-", ""))]])
  );
  // Work on a clone: the partial-import helper reassigns preserved item IDs.
  const merged = mergePartialAccountData(
    structuredClone(existing),
    converted.data,
    sections
  );
  const collect = (data: AccountData) => [
    ...data.characters.flatMap((c) =>
      Object.values(c.artifacts).filter((a): a is ArtifactData => !!a)
    ),
    ...data.extraArtifacts,
  ];
  const identity = (a: ArtifactData) =>
    JSON.stringify([
      a.setKey,
      a.slotKey,
      a.level,
      a.rarity,
      a.mainStatKey,
      Object.entries(a.substats).sort(),
    ]);
  const oldByIdentity = new Map<string, ArtifactData[]>();
  for (const artifact of collect(existing)) {
    const key = identity(artifact);
    oldByIdentity.set(key, [...(oldByIdentity.get(key) ?? []), artifact]);
  }
  // Unmatched old IDs must be removed before sequential IDs can be reused.
  const artifactIdMap = new Map(
    collect(existing).map((artifact) => [artifact.id, ""])
  );
  for (const artifact of collect(merged.data)) {
    const previous = oldByIdentity.get(identity(artifact))?.shift();
    if (!previous) continue;
    artifactIdMap.set(previous.id, artifact.id);
    // Packet exports may omit locally known optional artifact metadata.
    const raw = rawByArtifact.get(artifact);
    if (raw) {
      if (raw.astralMark === undefined)
        artifact.astralMark = previous.astralMark;
      if (raw.elixirCrafted === undefined)
        artifact.elixirCrafted = previous.elixirCrafted;
      if (raw.totalRolls === undefined)
        artifact.totalRolls = previous.totalRolls;
      if (previous.substatRollCounts)
        artifact.substatRollCounts = {
          ...previous.substatRollCounts,
          ...artifact.substatRollCounts,
        };
      if (raw.unactivatedSubstats === undefined)
        artifact.unactivatedSubstats = previous.unactivatedSubstats;
      const initialValues = { ...artifact.initialValues };
      for (const [key, value] of Object.entries(previous.initialValues ?? {})) {
        if (initialValues[key as keyof typeof initialValues] === undefined)
          initialValues[key as keyof typeof initialValues] = value;
      }
      if (Object.keys(initialValues).length)
        artifact.initialValues = initialValues;
    }
  }
  return { ...converted, data: merged.data, artifactIdMap };
}
