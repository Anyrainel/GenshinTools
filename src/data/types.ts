export type Language = 'en' | 'zh';

export type Rarity = 1 | 2 | 3 | 4 | 5;

export type Element = 'Pyro' | 'Hydro' | 'Electro' | 'Cryo' | 'Anemo' | 'Geo' | 'Dendro';
export const elements: Element[] = ['Pyro', 'Hydro', 'Electro', 'Cryo', 'Anemo', 'Geo', 'Dendro'];

export type WeaponType = 'Sword' | 'Claymore' | 'Polearm' | 'Catalyst' | 'Bow';
export const weaponTypes: WeaponType[] = ['Sword', 'Claymore', 'Polearm', 'Catalyst', 'Bow'];

export type Region = 'Mondstadt' | 'Liyue' | 'Inazuma' | 'Sumeru' | 'Fontaine' | 'Natlan' | 'Snezhnaya' | 'Nod-Krai' | 'None';
export const regions: Region[] = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Snezhnaya', 'Nod-Krai', 'None'];

export type MainStat = 'cr' | 'cd' | 'atk%' | 'hp%' | 'def%' | 'em' | 'er' | 'pyro%' | 'hydro%' | 'anemo%' | 'electro%' | 'dendro%' | 'cryo%' | 'geo%' | 'phys%' | 'heal%' | 'atk' | 'hp';
export type SubStat = 'cr' | 'cd' | 'atk%' | 'hp%' | 'def%' | 'er' | 'em' | 'atk' | 'hp' | 'def';
export type MainStatPlus = MainStat | 'elemental%' | 'cr/cd';
export const mainStatsPlus: MainStatPlus[] = [
  'cr', 'cd', 'atk%', 'hp%', 'def%', 'em', 'er', 'pyro%', 'hydro%', 'anemo%', 'electro%', 'dendro%', 'cryo%', 'geo%', 'phys%', 'heal%', 'atk', 'hp', 'elemental%', 'cr/cd'
] as const;

export type MainStatSlot = 'sands' | 'goblet' | 'circlet';
export const mainStatSlots: MainStatSlot[] = ['sands', 'goblet', 'circlet'];
export type Slot = MainStatSlot | 'flower' | 'plume';

export type Character = {
  id: string;
  element: Element;
  rarity: Rarity;
  weapon: WeaponType;
  region: Region;
  releaseDate: string; // Format: YYYY-MM-DD
  imageUrl: string; // Original image URL from wiki
  imagePath: string; // Local serving path
};

export type Weapon = {
  id: string;
  rarity: Rarity;
  type: WeaponType;
  secondaryStat: MainStat;
  imageUrl: string; // Original image URL from wiki
  imagePath: string; // Local serving path
};

export type ArtifactSet = {
  id: string;
  imageUrl: string; // Original image URL from wiki
  imagePath: string; // Local serving path
};

export type ArtifactHalfSet = {
  id: number;
  setIds: string[]; // All artifact set IDs that have this 2pc effect
  normalizedEffectTextEn: string; // Normalized English effect text
  normalizedEffectTextZh: string; // Normalized Chinese effect text
};

export type ElementResource = {
  name: Element;
  imageUrl: string; // Original image URL from wiki
  imagePath: string; // Local serving path
};

export type WeaponTypeResource = {
  name: WeaponType;
  imageUrl: string; // Original image URL from wiki
  imagePath: string; // Local serving path
};

export type Build = {
  id: string;
  characterId: string; // Back link to character
  name: string;
  visible: boolean;
  composition: '4pc' | '2pc+2pc';
  artifactSet?: string; // for 4pc
  halfSet1?: number; // for 2pc+2pc - ID of the first half set
  halfSet2?: number; // for 2pc+2pc - ID of the second half set
  sands: MainStat[];
  goblet: MainStat[];
  circlet: MainStat[];
  substats: SubStat[];
  kOverride?: number; // if different from M
};

export type ArtifactPattern = {
  mainStat: MainStatPlus;
  substats: SubStat[];
  set: string;
  slot: Slot;
  characters4pc?: string[];
  characters2pc?: string[];
};

export type BuildGroup = {
  characterId: string;
  builds: Build[];
  hidden?: boolean;
};

export type ComputeOptions = {
  // Skip CR+CD builds (assume in-game auto-lock)
  skipCritBuilds?: boolean;           // default: false
  // Simplify certain main stats
  expandElementalGoblet?: boolean;       // default: true
  expandCritCirclet?: boolean;        // default: true
  // Optional merge heuristics
  mergeSingleFlexVariants?: boolean;  // default: true
  findRigidCommonSubset?: boolean;    // default: true
};

export type BuildPayload = {
  author: string;
  description: string;
  version: number;
  data: BuildGroup[];
  computeOptions?: ComputeOptions;
};

export type CharacterBuilds = {
  characterId: string;
  buildIds: string[]; // Ordered list of build IDs for this character
};

export type CharacterMergeInfo = {
  characterId: string;
  hasPerfectMerge: boolean; // false if the character's build was always imperfectly merged (coverage)
  has4pcBuild: boolean; // false if this character only has 2pc+2pc build with this set
};

export type SlotConfig = {
  mainStats: MainStatPlus[];
  substats: SubStat[];
  mustPresent: SubStat[];
  minStatCount: number;
};

export type SetConfig = {
  flowerPlume: SlotConfig;
  sands: SlotConfig;
  goblet: SlotConfig;
  circlet: SlotConfig;
  servedCharacters: CharacterMergeInfo[];
};

export type ArtifactSetConfigs = {
  setId: string;
  configurations: SetConfig[];
};

export const tiers = ['S', 'A', 'B', 'C', 'D'];

export type TierAssignment = {
  [characterId: string]: {
    tier: string;
    position: number;
  };
};

export type TierCustomization = {
  [tier: string]: {
    displayName: string;
    hidden: boolean;
  };
};

export type TierListData = {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle?: string;
  language: 'en' | 'zh';
  author?: string; // Added for export metadata
  description?: string; // Added for export metadata
};

export type PresetOption = {
  path: string;
  label: string;
  author?: string;
  description?: string;
};
