export interface IGOODSubstat {
  key: string;
  value: number;
}

export interface IGOODArtifact {
  setKey: string;
  slotKey: string;
  level: number;
  rarity: number;
  mainStatKey: string;
  location: string;
  lock: boolean;
  substats: IGOODSubstat[];
}

export interface IGOODWeapon {
  key: string;
  level: number;
  refinement: number;
  location: string;
  lock: boolean;
}

export interface IGOODCharacter {
  key: string;
  constellation: number;
  level?: number;
  ascension?: number;
  talent?: {
    auto: number;
    skill: number;
    burst: number;
  };
}

export interface GOODData {
  format: string;
  version: number;
  source: string;
  characters?: IGOODCharacter[];
  weapons?: IGOODWeapon[];
  artifacts?: IGOODArtifact[];
}
