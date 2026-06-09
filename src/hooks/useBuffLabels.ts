import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactHalfSetsById } from "@/data/gameResources";
import type {
  BuffTarget,
  DisplayPart,
  FormulaTemplate,
  ResolvedBuff,
} from "@/lib/dmgcalc/types";

const TEMPLATE_KEYS: Record<FormulaTemplate, string> = {
  direct: "DirectDamage",
  amplify: "AmplifyingReaction",
  catalyze: "AdditiveReaction",
  transform: "TransformativeReaction",
  lunar: "LunarReaction",
  lunarDirect: "LunarDirect",
  stellar: "LunarReaction",
  stellarDirect: "LunarDirect",
};

/**
 * Returns a `(source) => string` resolver for buff source names. Composes
 * multiple t lookups across the discriminated source type.
 */
export function useBuffSourceName() {
  const { t } = useLanguage();
  return useCallback(
    (source: ResolvedBuff["source"]): string => {
      switch (source.type) {
        case "character":
          return t.character(source.id);
        case "weapon":
          return t.weapon(source.id);
        case "artifactSet":
          return t.artifact(source.id);
        case "artifactHalfSet": {
          const setId = artifactHalfSetsById[source.id]?.setIds[0];
          return setId ? t.artifact(setId) : source.id;
        }
        case "teamResonance":
          return t.resonance(source.id) || t.ui("teamComp.teamResonance");
        case "extra":
          return t.envBuff(source.id);
        default:
          return source.id;
      }
    },
    [t]
  );
}

/**
 * Returns a `(target) => string | null` resolver for a filter description
 * (abilities / elements / reactions / regions / factions, joined).
 * Callers own the wrapping (brackets, styling).
 */
export function useBuffFilterLabel() {
  const { t } = useLanguage();
  return useCallback(
    (target: BuffTarget): string | null => {
      const filter = target.filter;
      const groups: string[] = [];
      if (filter) {
        if (filter.abilities?.length)
          groups.push(filter.abilities.map((a) => t.ability(a)).join("/"));
        if (filter.elements?.length)
          groups.push(filter.elements.map((e) => t.element(e)).join("/"));
        if (filter.reactions?.length)
          groups.push(filter.reactions.map((r) => t.reaction(r)).join("/"));
      }
      if (target.regions?.length)
        groups.push(target.regions.map((r) => t.region(r)).join("/"));
      if (target.factions?.length)
        groups.push(target.factions.map((f) => t.faction(f)).join("/"));
      return groups.length > 0 ? groups.join("|") : null;
    },
    [t]
  );
}

/**
 * Returns a `(target) => string` resolver for the buff receiver label
 * (e.g. "Hu Tao (On-Field)" or "Team (Off-Field)"). When the target names
 * a specific character, appends an on/off-field suffix; otherwise falls
 * through to `t.receiver(key)`.
 */
export function useBuffReceiverLabel() {
  const { t } = useLanguage();
  return useCallback(
    (target: BuffTarget): string => {
      if (target.charId) {
        const name = t.character(target.charId);
        const r = target.receiver;
        if (r === "teamOnField" || r === "otherOnField")
          return `${name}${t.ui("teamComp.receiverCharOnField")}`;
        if (r === "teamOffField" || r === "otherOffField")
          return `${name}${t.ui("teamComp.receiverCharOffField")}`;
        return name;
      }
      return t.receiver(target.receiver);
    },
    [t]
  );
}

/**
 * Returns a `(part) => string` resolver for a formula part's template name
 * (e.g. "N1: Pyro Vaporize Dmg"). Composes t.ability / element / reaction /
 * formula.
 */
export function useTemplateName() {
  const { t } = useLanguage();
  return useCallback(
    (part: DisplayPart): string => {
      const abilityPrefix = part.tag?.ability
        ? `${t.ability(part.tag.ability)}: `
        : "";
      const elName = part.tag?.element ? `${t.element(part.tag.element)} ` : "";
      if (part.template === "direct") {
        return abilityPrefix + elName + t.formula("DirectDamage");
      }
      if (part.tag?.reaction && part.tag.reaction !== "none") {
        const rxn = t.reaction(part.tag.reaction);
        const suffix =
          part.template === "lunarDirect" ? "DirectSuffix" : "ReactionSuffix";
        return abilityPrefix + elName + rxn + t.formula(suffix);
      }
      return abilityPrefix + elName + t.formula(TEMPLATE_KEYS[part.template]);
    },
    [t]
  );
}
