/* eslint-disable react-refresh/only-export-components */
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { i18nAppData } from "../data/i18n-app";
import { i18nBetaData } from "../data/i18n-beta";
import { i18nGameData } from "../data/i18n-game";
import { i18nUiData } from "../data/i18n-ui";
import type {
  CharacterEffect,
  CharacterKit,
  CharacterSkill,
  Language,
} from "../data/types";
import { betaEnabled } from "../lib/betaFlag";
import { loadCharacterKits } from "../lib/characterKitLoader";
import { fetchGzipJson } from "../lib/gzipJson";

// Per-language JSON shape for weapon/artifact game data
type WeaponGameEntry = {
  name: string;
  descHtmlTpl: string;
  refinements: string[][];
};
type ArtifactGameEntry = { name: string; effect2: string; effect4: string };
type WeaponGameData = Record<string, WeaponGameEntry>;
type ArtifactGameData = Record<string, ArtifactGameEntry>;

/** Format a weapon template by substituting placeholders with combined refinement values. */
function formatWeaponEffect(
  tpl: string,
  refinements: string[][],
  refinement?: number
): string {
  if (!tpl || refinements.length === 0) return tpl;
  // refinements: 5 lists (R1..R5), each with N values for {0}..{N-1}
  const paramCount = refinements[0].length;
  return tpl.replace(/\{(\d+)\}/g, (match, idx) => {
    const i = Number(idx);
    if (i >= paramCount) return match;
    if (refinement !== undefined && refinement >= 1 && refinement <= 5) {
      return refinements[refinement - 1][i];
    }
    // Combine all 5 refinement values: "20%/25%/30%/35%/40%"
    return refinements.map((r) => r[i]).join("/");
  });
}

// Lazy-loaded game data modules (weapon/artifact per-language JSONs)
const weaponModules = import.meta.glob<{ default: WeaponGameData }>(
  "../data/game/weapon_*.json",
  { eager: false }
);
const artifactModules = import.meta.glob<{ default: ArtifactGameData }>(
  "../data/game/artifact_*.json",
  { eager: false }
);
// Beta weapon/artifact data is gzipped so its contents aren't indexed by
// GitHub code search; resolved to a URL at build time and fetched+decompressed
// at runtime.
const betaWeaponModules = import.meta.glob<string>(
  "../data/game/weapon_beta_*.json.gz",
  { eager: false, query: "?url", import: "default" }
);
const betaArtifactModules = import.meta.glob<string>(
  "../data/game/artifact_beta_*.json.gz",
  { eager: false, query: "?url", import: "default" }
);

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: {
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
    ability: (key: string) => string;
    faction: (key: string) => string;
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
    lang: Language;
  };
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

const LANGUAGE_STORAGE_KEY = "app_language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === "en" || stored === "zh") {
        return stored;
      }

      if (navigator.language.toLowerCase().startsWith("zh")) {
        // Auto-detect system language
        // Note: navigator.language can be "zh-CN", "zh-TW", etc.
        return "zh";
      }

      return "en";
    } catch {
      return "en";
    }
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (err) {
      console.error("Failed to save language to localStorage:", err);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prevLang) => {
      const newLang = prevLang === "en" ? "zh" : "en";
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      } catch (err) {
        console.error("Failed to save language to localStorage:", err);
      }
      return newLang;
    });
  }, []);

  // Preload character kit bundle for the current language.
  // Skipped under vitest: the async setState fires after render and pollutes
  // every component test with act(...) warnings. Tests don't rely on kit data.
  const isTestEnv = import.meta.env.MODE === "test";
  const [kitData, setKitData] = useState<Record<string, CharacterKit>>({});
  useEffect(() => {
    if (isTestEnv) return;
    loadCharacterKits(language).then(setKitData);
  }, [language]);

  // Preload weapon & artifact game data for the current language
  const [weaponData, setWeaponData] = useState<WeaponGameData>({});
  const [artifactData, setArtifactData] = useState<ArtifactGameData>({});
  useEffect(() => {
    if (isTestEnv) return;
    const weaponPath = `../data/game/weapon_${language}.json`;
    const artifactPath = `../data/game/artifact_${language}.json`;
    const weaponLoader = weaponModules[weaponPath];
    const artifactLoader = artifactModules[artifactPath];

    if (weaponLoader) {
      const betaWeaponPath = `../data/game/weapon_beta_${language}.json.gz`;
      const betaWeaponUrlLoader = betaEnabled()
        ? betaWeaponModules[betaWeaponPath]
        : null;

      if (betaWeaponUrlLoader) {
        Promise.all([
          weaponLoader(),
          betaWeaponUrlLoader().then((url) =>
            fetchGzipJson<WeaponGameData>(url)
          ),
        ]).then(([baseMod, betaData]) =>
          setWeaponData({ ...baseMod.default, ...betaData })
        );
      } else {
        weaponLoader().then((mod) => setWeaponData(mod.default));
      }
    }
    if (artifactLoader) {
      const betaArtifactPath = `../data/game/artifact_beta_${language}.json.gz`;
      const betaArtifactUrlLoader = betaEnabled()
        ? betaArtifactModules[betaArtifactPath]
        : null;

      if (betaArtifactUrlLoader) {
        Promise.all([
          artifactLoader(),
          betaArtifactUrlLoader().then((url) =>
            fetchGzipJson<ArtifactGameData>(url)
          ),
        ]).then(([baseMod, betaData]) =>
          setArtifactData({ ...baseMod.default, ...betaData })
        );
      } else {
        artifactLoader().then((mod) => setArtifactData(mod.default));
      }
    }
  }, [language]);

  const getCharacterKit = useCallback(
    (characterId: string): CharacterKit | null => kitData[characterId] ?? null,
    [kitData]
  );

  const getSkills = useCallback(
    (characterId: string): CharacterSkill[] | null =>
      kitData[characterId]?.skills ?? null,
    [kitData]
  );

  const getPassives = useCallback(
    (characterId: string): CharacterEffect[] | null =>
      kitData[characterId]?.passives ?? null,
    [kitData]
  );

  const getConstellations = useCallback(
    (characterId: string): CharacterEffect[] | null =>
      kitData[characterId]?.constellations ?? null,
    [kitData]
  );

  const getGlossary = useCallback(
    (characterId: string): CharacterEffect[] | null =>
      kitData[characterId]?.glossary ?? null,
    [kitData]
  );

  const getCharacterName = useCallback(
    (characterId: string): string => {
      const chars = i18nGameData.characters as Record<
        string,
        Record<string, string>
      >;
      const betaChars = i18nBetaData.characters as Record<
        string,
        Record<string, string>
      >;
      return (
        chars[characterId]?.[language] ||
        betaChars[characterId]?.[language] ||
        characterId
      );
    },
    [language]
  );

  const getArtifactSetName = useCallback(
    (setId: string): string => {
      const arts = i18nGameData.artifacts as Record<
        string,
        Record<string, string>
      >;
      const betaArts = i18nBetaData.artifacts as Record<
        string,
        Record<string, string>
      >;
      return arts[setId]?.[language] || betaArts[setId]?.[language] || setId;
    },
    [language]
  );

  const getArtifactSetEffects = useCallback(
    (setId: string): string[] => {
      const entry = artifactData[setId];
      if (!entry) return [];
      const effects: string[] = [];
      if (entry.effect2) effects.push(entry.effect2);
      if (entry.effect4) effects.push(entry.effect4);
      return effects;
    },
    [artifactData]
  );

  const getArtifactHalfSetName = useCallback(
    (id: string | number): string => {
      const halfSets = i18nGameData.artifactHalfSets as Record<
        string,
        Record<string, string>
      >;
      return halfSets?.[String(id)]?.[language] || `Half Set ${id}`;
    },
    [language]
  );

  const getRegionName = useCallback(
    (regionKey: string): string => {
      const regs = i18nAppData.regions as Record<
        string,
        Record<string, string>
      >;
      return regs[regionKey]?.[language] || regionKey;
    },
    [language]
  );

  const getStatName = useCallback(
    (statKey: string): string => {
      const stats = i18nAppData.stats as Record<string, Record<string, string>>;
      return stats[statKey]?.[language] || statKey;
    },
    [language]
  );

  const getEnvBuffName = useCallback(
    (buffId: string): string => {
      const buffs = i18nAppData.envBuffs as Record<
        string,
        Record<string, string>
      >;
      return buffs[buffId]?.[language] || buffId;
    },
    [language]
  );

  const getOriginLabel = useCallback(
    (origin: string): string => {
      if (language !== "zh") return origin;
      const m = origin.match(/^([CPR])(\d+)$/);
      if (m) {
        const origins = i18nAppData.origins as Record<
          string,
          Record<string, string>
        >;
        const label = origins[m[1]]?.[language] || m[1];
        if (m[1] === "C") return `${m[2]}${label}`;
        return `${label}${m[2]}`;
      }
      return origin;
    },
    [language]
  );

  const getElementResLabel = useCallback(
    (elementKey: string): string => {
      const labels = i18nAppData.elementRes as Record<
        string,
        Record<string, string>
      >;
      return labels[elementKey]?.[language] || elementKey;
    },
    [language]
  );

  const formatShortDate = useCallback(
    (date: Date): string => {
      return date.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
        month: "short",
        day: "numeric",
      });
    },
    [language]
  );

  const getStatShortName = useCallback(
    (statKey: string): string => {
      const stats = i18nAppData.statsShort as Record<
        string,
        Record<string, string>
      >;
      return stats[statKey]?.[language] || statKey;
    },
    [language]
  );

  const getStatMinName = useCallback(
    (statKey: string): string => {
      // @ts-ignore - statsMin exists in the object but might not be inferred yet if types are strict
      const statsMin = i18nAppData.statsMin as Record<
        string,
        Record<string, string>
      >;
      // Fallback to short name if min name not found
      return statsMin?.[statKey]?.[language] || getStatShortName(statKey);
    },
    [language, getStatShortName]
  );

  const getFormulaLabel = useCallback(
    (formulaKey: string): string => {
      // @ts-ignore - formulas exists in the object but might not be inferred yet
      const formulas = i18nAppData.formulas as Record<
        string,
        Record<string, string>
      >;
      return formulas?.[formulaKey]?.[language] || formulaKey;
    },
    [language]
  );

  const getMainStatName = useCallback(
    (statKey: string): string => {
      return getStatName(statKey);
    },
    [getStatName]
  );

  const getSubStatName = useCallback(
    (statKey: string): string => {
      return getStatName(statKey);
    },
    [getStatName]
  );

  const getElementName = useCallback(
    (element: string): string => {
      const elems = i18nAppData.elements as Record<
        string,
        Record<string, string>
      >;
      return elems[element]?.[language] || element;
    },
    [language]
  );

  const getReactionName = useCallback(
    (reactionKey: string): string => {
      // @ts-ignore - reactions exists in the object but might not be inferred yet if types are strict
      const rxns = i18nAppData.reactions as Record<
        string,
        Record<string, string>
      >;
      return rxns[reactionKey]?.[language] || reactionKey;
    },
    [language]
  );

  const getAbilityName = useCallback(
    (abilityKey: string): string => {
      const abs = i18nAppData.abilities as Record<
        string,
        Record<string, string>
      >;
      return abs[abilityKey]?.[language] || abilityKey;
    },
    [language]
  );

  const getFactionName = useCallback(
    (factionKey: string): string => {
      const facs = i18nAppData.factions as Record<
        string,
        Record<string, string>
      >;
      return facs[factionKey]?.[language] || factionKey;
    },
    [language]
  );

  const getResonanceName = useCallback(
    (resonanceKey: string): string => {
      const res = i18nAppData.resonances as Record<
        string,
        Record<string, string>
      >;
      return res[resonanceKey]?.[language] || resonanceKey;
    },
    [language]
  );

  const getWeaponTypeName = useCallback(
    (weaponType: string): string => {
      const weaps = i18nAppData.weapons as Record<
        string,
        Record<string, string>
      >;
      return weaps[weaponType]?.[language] || weaponType;
    },
    [language]
  );

  const getWeaponName = useCallback(
    (weaponId: string): string => {
      const weapons = i18nGameData.weapons as Record<
        string,
        Record<string, string>
      >;
      const betaWeapons = i18nBetaData.weapons as Record<
        string,
        Record<string, string>
      >;
      return (
        weapons[weaponId]?.[language] ||
        betaWeapons[weaponId]?.[language] ||
        weaponId
      );
    },
    [language]
  );

  const getWeaponEffect = useCallback(
    (weaponId: string, refinement?: number): string => {
      const entry = weaponData[weaponId];
      if (!entry?.descHtmlTpl) return "";
      return formatWeaponEffect(
        entry.descHtmlTpl,
        entry.refinements,
        refinement
      );
    },
    [weaponData]
  );

  const getSlotName = useCallback(
    (slotKey: string): string => {
      const slots = i18nAppData.slots as Record<string, Record<string, string>>;
      return slots[slotKey]?.[language] || slotKey;
    },
    [language]
  );

  const getStyleName = useCallback(
    (styleKey: string): string => {
      const styles = i18nAppData.styles as Record<
        string,
        Record<string, string>
      >;
      return styles[styleKey]?.[language] || styleKey;
    },
    [language]
  );

  const getRoleName = useCallback(
    (roleKey: string): string => {
      const roles = i18nAppData.roles as Record<string, Record<string, string>>;
      return roles[roleKey]?.[language] || roleKey;
    },
    [language]
  );

  const getTierName = useCallback(
    (tierKey: string): string => {
      const tiers = i18nAppData.tiers as Record<string, Record<string, string>>;
      return tiers[tierKey]?.[language] || tierKey;
    },
    [language]
  );

  const getHalfSetShortName = useCallback(
    (halfSetId: string): string => {
      const labels = i18nAppData.halfSetShort as Record<
        string,
        Record<string, string>
      >;
      return labels[halfSetId]?.[language] || halfSetId;
    },
    [language]
  );

  const formatReleaseDate = useCallback(
    (dateString: string | null): string => {
      if (!dateString) return "???";
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // getMonth() returns 0-11

      if (language === "zh") {
        return `${year}年${month}月`;
      }
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${monthNames[month - 1]} ${year}`;
    },
    [language]
  );

  const getUIMessage = useCallback(
    (path: string): string => {
      const keys = path.split(".");
      let current: Record<string, unknown> = i18nUiData;

      for (const key of keys) {
        if (current && typeof current === "object" && key in current) {
          current = current[key] as Record<string, unknown>;
        } else {
          return path; // Fallback to path if not found
        }
      }

      return (current as Record<string, string>)?.[language] || path;
    },
    [language]
  );

  const formatString = useCallback(
    (key: string, ...args: (string | number)[]): string => {
      const template = getUIMessage(key);
      return template.replace(/{(\d+)}/g, (match, number) => {
        return typeof args[number] !== "undefined"
          ? String(args[number])
          : match;
      });
    },
    [getUIMessage]
  );

  const resolveLabel = useCallback(
    (label: Record<string, string>): string => {
      if (!label) return "";
      return label[language] || label.en || Object.values(label)[0] || "";
    },
    [language]
  );

  // Memoize the t object to prevent recreation on every render
  const t = useMemo(
    () => ({
      character: getCharacterName,
      artifact: getArtifactSetName,
      artifactHalfSet: getArtifactHalfSetName,
      artifactEffects: getArtifactSetEffects,
      region: getRegionName,
      stat: getStatName,
      statShort: getStatShortName,
      statMin: getStatMinName,
      formula: getFormulaLabel,
      mainStat: getMainStatName,
      subStat: getSubStatName,
      element: getElementName,
      reaction: getReactionName,
      ability: getAbilityName,
      faction: getFactionName,
      resonance: getResonanceName,
      weaponType: getWeaponTypeName,
      weapon: getWeaponName,
      weaponEffect: getWeaponEffect,
      slot: getSlotName,
      style: getStyleName,
      role: getRoleName,
      tier: getTierName,
      halfSetShort: getHalfSetShortName,
      formatDate: formatReleaseDate,
      ui: getUIMessage,
      format: formatString,
      resolveLabel,
      characterKit: getCharacterKit,
      skills: getSkills,
      passives: getPassives,
      constellations: getConstellations,
      envBuff: getEnvBuffName,
      glossary: getGlossary,
      origin: getOriginLabel,
      elementRes: getElementResLabel,
      shortDate: formatShortDate,
      lang: language,
    }),
    [
      getCharacterName,
      getArtifactSetName,
      getArtifactHalfSetName,
      getArtifactSetEffects,
      getRegionName,
      getStatName,
      getStatShortName,
      getStatMinName,
      getFormulaLabel,
      getMainStatName,
      getSubStatName,
      getElementName,
      getReactionName,
      getAbilityName,
      getFactionName,
      getResonanceName,
      getWeaponTypeName,
      getWeaponName,
      getWeaponEffect,
      getSlotName,
      getStyleName,
      getRoleName,
      getTierName,
      getHalfSetShortName,
      formatReleaseDate,
      getUIMessage,
      formatString,
      resolveLabel,
      getCharacterKit,
      getSkills,
      getPassives,
      getConstellations,
      getEnvBuffName,
      getGlossary,
      getOriginLabel,
      getElementResLabel,
      formatShortDate,
      language,
    ]
  );

  // Memoize context value to prevent cascading re-renders
  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, setLanguage, toggleLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
