
I'm also thinking about a way to differentiate initialization parameters (team comp, build, constellation, refinement) and calculation parameters (artifact stat rolls). The buff construct should also be more flexible, to handle talents like "队伍中每有一名岩元素角色，提高10%防御力，每有一名水元素角色，提高20精通", "根据自身攻击力，提高队伍中附近的角色下落攻击伤害，提升值为攻击力的240%", or "根据全队角色精通值最高角色的精通，提升全队精通，提升值为最高值的25%，最大提升250".

Here are my specific designs:
```typescript
type BuffReceiverType = "self" | "onField" | "selfOnField" | "team";
type AbilityType = "normal" | "charge" | "plunge" | "skill" | "burst";
type StatKey = BaseStat | MainStat | SubStat | "normal%" | "charge%" | "plunge%" | "skill%" | "burst%" | "lunar%" | "dmg%" | ...; // Whole list TBD. 
type StatEntry {
    key: StatKey;
    value: number;
}

// StatSheet can represent static stats from a fully equipped character, or the sum of stats from a group of 5 artifacts, or their total stats after applying buffs
class StatSheet { 
    private stats: Partial<Record<StatKey, number>>;
    constructor(stats: StatEntry[]) {...}
    get(key: StatKey): number {...} // handles base * precent + flat logic for atk/hp/def
    merge(other: StatSheet): StatSheet {...}
    apply(buffs: StatBuff[]): StatSheet {...}
}

type BuffSource { // meant for display purposes, should not affect calculation
    type: "character" | "weapon" | "artifact";
    id: string;
    requirement?: string; // "C0", "R1", "2pc", "4pc" etc
    tags?: string[]; // "E", "Q", "Bloom", etc.
}
type BuffTarget {
    receiver: BuffReceiverType;
    abilityFilter?: AbilityType[];
    elementFilter?: Element[];
}
abstract class StatBuff {
    constructor (
        readonly source: BuffSource,
        readonly target: BuffTarget,
        readonly staticBuffs: StatEntry[],
    ) {}
    dynamicBuffs(selfStats: StatSheet, teamStats: StatSheet[]): StatEntry[] {
        return []; // to be overridden by subclasses as needed
    }
}

type DamageResult {
    components: Record<string, number>;
    finalDamage: number;
}
abstract class DamageFormula {
    constructor(
        public readonly skillDmgMultiplier: number,
        public readonly reactionType: ReactionType, // for multiplier lookup, e.g. MeltByPyro, MeltByCryo, etc.
        ... // other non-StatSheet components
    ) {}
    abstract calc(statSheet: StatSheet): DamageResult;
}
// Implement Factory classes for each reaction, e.g. DirectFormula, AmplifyFormula, TransformFormula, CatalyzeFormula, LunarChargeFormula, DirectLunarChargeFormula, etc.

interface IStatProvider {
    readonly stats: StatEntry[];
    readonly buffs: StatBuff[];
}
interface IDamageProvider {
    readonly formulaIds: Record<string, string[]>; // key: formula id, value: tags for display purposes
    getDamageResult(formulaId: string, selfStats: StatSheet, teamStats: StatSheet[]): DamageResult;
}
type Faction = "Hexerei" | "None"; // Hexerei is 魔导
type TeamComp { // look up from resources.ts and construct
    characters: string[];
    elements: Record<string, Element>;
    regions: Record<string, Region>;
    rarities: Record<string, Rarity>;
    factions: Record<string, Faction>; // Need to maintain a list of Hexerei characters, this is not in resources.ts
}
abstract class CharacterBase implements IStatProvider, IDamageProvider {
    constructor(
        readonly charId: string,
        readonly charLevel: number,
        readonly constellation: number,
        readonly teamComp: TeamComp,
    ) {}
    ...
} // Also maintain a registry for all CharacterBase subclasses
abstract class WeaponBase implements IStatProvider {
    constructor(
        readonly weaponId: string,
        readonly refinement: number,
        readonly teamComp: TeamComp,
    ) {}
    ...
} // Also maintain a registry for all WeaponBase subclasses
abstract class ArtifactSetBase implements IStatProvider {
    constructor(
        readonly artifactSetId: string,
        readonly teamComp: TeamComp,
    ) {}
    ... // only need to implement the 4pc bonus, let client reuse half set for 2pc bonus.
} // Also maintain a registry for all ArtifactSetBase subclasses
abstract class ArtifactHalfSetBase implements IStatProvider {
    constructor(
        readonly artifactHalfSetId: string,
        readonly teamComp: TeamComp,
    ) {}
    ...
} // Also maintain a registry for all ArtifactHalfSetBase subclasses
class TeamResonance implements IStatProvider { // either a single class to implement all resonance types, or make it abstract and extend per resonance type
    constructor(
        readonly teamComp: TeamComp,
    ) {...}
    ...
} // Maintain a registry if split implementation

class CharBuild {
    private innerStatSheet: StatSheet;
    public charBase: CharacterBase;
    public weaponBase: WeaponBase;
    public artifactSetBase: ArtifactSetBase;
    public artifactHalfSetBases: ArtifactHalfSetBase[]; // either 1 or 2
    constructor(
        public readonly charId: string,
        public readonly teamCharIds: string[], // other members
        public readonly charLevel: number,
        public readonly constellation: number,
        public readonly weaponId: string,
        public readonly refinement: number,
        public readonly artifactSetId: string,
        public readonly artifactHalfSetIds: string[],
    ){...}
    getStaticBuffs(): StatBuff[] {...}
    applyStaticBuffs(teamStaticBuffs: StatBuff[]): void {...} // only static buffs, impact innerStatSheet
    getPreStats(artifactStats: StatSheet): StatSheet {...} // merge with artifact stats on the fly, doesn't impact innerStatSheet
    getDynamicBuffs(selfPreStats: StatSheet, teamPreStats: StatSheet[]): StatBuff[] {...} // forwards 3 bases
    getPostStats(selfPreStats: StatSheet, teamDynamicBuffs: StatBuff[]): StatSheet {...} // forwards the apply method on StatSheet
    getFormulaIds(): Record<string, string[]> {...} // forwards charBase
    getDamageResult(formulaId: string, selfPostStats: StatSheet, teamPostStats: StatSheet[]): DamageResult {...} // forwards charBase
}

class TeamBuild {
    public teamResonance: TeamResonance;
    constructor(
        public readonly charBuilds: Record<string, CharBuild>,
    ){...} // figure out team resonance and apply static buffs across team during construct

    getTeamStats(artifactStats: Record<string, StatSheet>): Record<string, StatSheet> {...} // computes pre stats > dynamic buffs > post stats for the team
    getFormulaIds(): Record<string, Record<string, string[]>> {...} // key: charId, value: Record<formulaId, tags>
    getDamageResult(charId: string, formulaId: string, teamStats: Record<string, StatSheet>): DamageResult {...}
}
```