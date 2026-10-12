import type {
  CharacterEffect,
  CharacterKit,
  CharacterSkill,
} from "@/domain/models";

export interface I18n {
  character: (id: string) => string;
  artifact: (id: string) => string;
  artifactHalfSet: (id: string | number) => string;
  artifactEffects: (id: string) => string[];
  region: (key: string) => string;
  stat: (key: string) => string;
  statShort: (key: string) => string;
  statMin: (key: string) => string;
  formula: (key: string) => string;
  mainStat: (key: string) => string;
  subStat: (key: string) => string;
  element: (key: string) => string;
  reaction: (key: string) => string;
  receiver: (key: string) => string;
  ability: (key: string) => string;
  erAction: (key: string) => string;
  faction: (key: string) => string;
  characterUtility: (key: string) => string;
  resonance: (key: string) => string;
  weaponType: (type: string) => string;
  weapon: (id: string) => string;
  weaponEffect: (id: string, refinement?: number) => string;
  slot: (key: string) => string;
  style: (key: string) => string;
  role: (key: string) => string;
  tier: (key: string) => string;
  halfSetShort: (halfSetId: string) => string;
  formatDate: (dateString: string | null) => string;
  ui: (path: string) => string;
  format: (key: string, ...args: (string | number)[]) => string;
  resolveLabel: (label: Record<string, string>) => string;
  characterKit: (id: string) => CharacterKit | null;
  skills: (id: string) => CharacterSkill[] | null;
  passives: (id: string) => CharacterEffect[] | null;
  constellations: (id: string) => CharacterEffect[] | null;
  envBuff: (id: string) => string;
  glossary: (id: string) => CharacterEffect[] | null;
  origin: (key: string) => string;
  elementRes: (key: string) => string;
  shortDate: (date: Date) => string;
}
