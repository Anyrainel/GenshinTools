import type {
  InferOption,
  OptionDef,
  OptionEntry,
  OptionMap,
  TalentLevels,
} from "../types";
import type {
  ArtifactHalfSetBase,
  ArtifactSetBase,
  CharacterBase,
  WeaponBase,
} from "./implModel";
import type { TeamMeta } from "./teamMeta";

type CharacterCtor = new (
  charId: string,
  charLevel: number,
  constellation: number,
  teamMeta: TeamMeta,
  combatOpts?: OptionMap,
  talentLevels?: TalentLevels
) => CharacterBase;
const characterRegistry = new Map<string, CharacterCtor>();
/** @RegisterCharacter("hu_tao") or @RegisterCharacter("durin", durinOption) */
export function RegisterCharacter(charId: string, optionDef?: OptionDef) {
  return (target: CharacterCtor, _context: ClassDecoratorContext) => {
    characterRegistry.set(charId, target);
    if (optionDef) optionRegistry.set(charId, optionDef);
  };
}
export function createCharacter(
  charId: string,
  charLevel: number,
  constellation: number,
  teamMeta: TeamMeta,
  combatOpts: OptionMap = {},
  talentLevels?: TalentLevels
): CharacterBase {
  const Ctor = characterRegistry.get(charId);
  if (!Ctor) throw new Error(`No character registered for: ${charId}`);
  return new Ctor(
    charId,
    charLevel,
    constellation,
    teamMeta,
    combatOpts,
    talentLevels
  );
}

type WeaponCtor = new (
  weaponId: string,
  refinement: number,
  charId: string,
  teamMeta: TeamMeta,
  combatOpts?: OptionMap
) => WeaponBase;
const weaponRegistry = new Map<string, WeaponCtor>();
/** @RegisterWeapon("staff_of_homa") or @RegisterWeapon("the_widsith", widsithOption) */
export function RegisterWeapon(weaponId: string, optionDef?: OptionDef) {
  return (target: WeaponCtor, _context: ClassDecoratorContext) => {
    weaponRegistry.set(weaponId, target);
    if (optionDef) optionRegistry.set(weaponId, optionDef);
  };
}
export function createWeapon(
  weaponId: string,
  refinement: number,
  charId: string,
  teamMeta: TeamMeta,
  combatOpts: OptionMap = {}
): WeaponBase {
  const Ctor = weaponRegistry.get(weaponId);
  if (!Ctor) throw new Error(`No weapon registered for: ${weaponId}`);
  return new Ctor(weaponId, refinement, charId, teamMeta, combatOpts);
}

type ArtifactSetCtor = new (
  artifactSetId: string,
  charId: string,
  teamMeta: TeamMeta,
  combatOpts?: OptionMap
) => ArtifactSetBase;
const artifactSetRegistry = new Map<string, ArtifactSetCtor>();
/** @RegisterArtifactSet("crimson_witch_of_flames") or @RegisterArtifactSet("berserker", berserkerOption) */
export function RegisterArtifactSet(setId: string, optionDef?: OptionDef) {
  return (target: ArtifactSetCtor, _context: ClassDecoratorContext) => {
    artifactSetRegistry.set(setId, target);
    if (optionDef) optionRegistry.set(setId, optionDef);
  };
}
export function createArtifactSet(
  setId: string,
  charId: string,
  teamMeta: TeamMeta,
  combatOpts: OptionMap = {}
): ArtifactSetBase {
  const Ctor = artifactSetRegistry.get(setId);
  if (!Ctor) throw new Error(`No artifact set registered for: ${setId}`);
  return new Ctor(setId, charId, teamMeta, combatOpts);
}

type ArtifactHalfSetCtor = new (
  artifactHalfSetId: string,
  charId: string,
  teamMeta: TeamMeta
) => ArtifactHalfSetBase;
const artifactHalfSetRegistry = new Map<string, ArtifactHalfSetCtor>();
/** @RegisterArtifactHalfSet("1") — registers a 2pc ArtifactHalfSetBase (keyed by halfSetId) */
export function RegisterArtifactHalfSet(halfSetId: string) {
  return (target: ArtifactHalfSetCtor, _context: ClassDecoratorContext) => {
    artifactHalfSetRegistry.set(halfSetId, target);
  };
}
export function createArtifactHalfSet(
  halfSetId: string,
  charId: string,
  teamMeta: TeamMeta
): ArtifactHalfSetBase {
  const Ctor = artifactHalfSetRegistry.get(halfSetId);
  if (!Ctor)
    throw new Error(`No artifact half-set registered for: ${halfSetId}`);
  return new Ctor(halfSetId, charId, teamMeta);
}

const optionRegistry = new Map<string, OptionDef>();
export function getOptionDef(entityId: string): OptionDef | null {
  return optionRegistry.get(entityId) ?? null;
}

/**
 * Check whether a choice is enabled given the team context.
 * Choices without a `when` predicate are always enabled.
 */

export function isChoiceEnabled(
  choice: OptionEntry,
  teamMeta?: TeamMeta
): boolean {
  if (!choice.when || !teamMeta) return true;
  return choice.when(teamMeta);
}
/**
 * Return the value of the first enabled choice for a given OptionDef.
 * Every OptionDef must have at least one ungated choice, so this always
 * returns a valid value.
 */

export function getDefaultOptionValue(
  def: OptionDef,
  teamMeta?: TeamMeta
): string {
  const first = def.choices.find((c) => isChoiceEnabled(c, teamMeta));
  return first ? first.value : def.choices[0].value;
}
/**
 * Resolve a raw option string against a typed schema, returning the
 * narrowed value. Falls back to first enabled choice if raw value is
 * invalid or disabled.
 *
 * Usage inside a subclass:
 * ```
 * private readonly o = resolveOption(durinOption, this.option);
 * //                    ^ InferOption<typeof durinOption> = "dps" | "support"
 * ```
 */

export function resolveOption<const D extends OptionDef>(
  def: D,
  raw: string,
  teamMeta?: TeamMeta
): InferOption<D> {
  const validChoice = raw !== "" && def.choices.find((c) => c.value === raw);
  if (validChoice && isChoiceEnabled(validChoice, teamMeta)) {
    return raw as InferOption<D>;
  }
  return getDefaultOptionValue(def, teamMeta) as InferOption<D>;
}

export function resolveRegisteredOption(
  entityId: string,
  raw: string,
  teamMeta: TeamMeta
): string {
  const def = getOptionDef(entityId);
  return def ? resolveOption(def, raw, teamMeta) : raw;
}
