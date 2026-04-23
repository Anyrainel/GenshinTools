/**
 * Pure display helpers for buffs. t-dependent label logic lives alongside the
 * consuming components in @/components/team-comp/BuffLabels.
 */

import type { Element } from "@/data/enums";
import { envBuffsById } from "@/data/envBuffs";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  elementResourcesByName,
  weaponsById,
} from "@/data/gameResources";
import type { ResolvedBuff } from "../dmgcalc/types";

export function getSourceIcon(
  source: ResolvedBuff["source"]
): string | undefined {
  if (source.type === "character") return charactersById[source.id]?.imagePath;
  if (source.type === "weapon") return weaponsById[source.id]?.imagePath;
  if (source.type === "artifactSet")
    return artifactsById[source.id as string]?.imagePaths?.flower;
  if (source.type === "artifactHalfSet")
    return artifactsById[artifactHalfSetsById[source.id]?.setIds[0] ?? ""]
      ?.imagePaths?.flower;
  if (source.type === "teamResonance") {
    if (source.element) {
      return elementResourcesByName[source.element]?.imagePath;
    }
    if (source.id !== "unique" && source.id !== "gleam") {
      const el = source.id.charAt(0).toUpperCase() + source.id.slice(1);
      return elementResourcesByName[el as Element]?.imagePath;
    }
  }
  if (source.type === "extra") {
    return envBuffsById[source.id]?.imagePath;
  }
  return undefined;
}
