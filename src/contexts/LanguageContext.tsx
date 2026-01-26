/* eslint-disable react-refresh/only-export-components */
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { i18nAppData } from "../data/i18n-app";
import { i18nGameData } from "../data/i18n-game";
import { i18nUiData } from "../data/i18n-ui";
import type { Language } from "../data/types";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: {
    character: (id: string) => string;
    artifact: (id: string) => string;
    artifactHalfSet: (id: number) => string;
    artifactEffects: (id: string) => string[];
    region: (key: string) => string;
    stat: (key: string) => string;
    statShort: (key: string) => string;
    statMin: (key: string) => string;
    mainStat: (key: string) => string;
    subStat: (key: string) => string;
    element: (key: string) => string;
    weaponType: (type: string) => string;
    weaponName: (id: string) => string;
    weaponEffect: (id: string) => string;
    formatDate: (dateString: string) => string;
    ui: (path: string) => string;
    format: (key: string, ...args: (string | number)[]) => string;
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

  const getCharacterName = useCallback(
    (characterId: string): string => {
      const chars = i18nGameData.characters as Record<
        string,
        Record<string, string>
      >;
      return chars[characterId]?.[language] || characterId;
    },
    [language]
  );

  const getArtifactSetName = useCallback(
    (setId: string): string => {
      const arts = i18nGameData.artifacts as Record<
        string,
        { name: Record<string, string>; effects: Record<string, string[]> }
      >;
      return arts[setId]?.name?.[language] || setId;
    },
    [language]
  );

  const getArtifactSetEffects = useCallback(
    (setId: string): string[] => {
      const arts = i18nGameData.artifacts as Record<
        string,
        { name: Record<string, string>; effects: Record<string, string[]> }
      >;
      return arts[setId]?.effects?.[language] || [];
    },
    [language]
  );

  const getArtifactHalfSetName = useCallback(
    (id: number): string => {
      const halfSets = i18nGameData.artifactHalfSets as Record<
        string,
        Record<string, string>
      >;
      return halfSets?.[id.toString()]?.[language] || `Half Set ${id}`;
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
      const weaponData = i18nGameData.weapons as Record<
        string,
        { name: Record<string, string> }
      >;
      return weaponData[weaponId]?.name?.[language] || weaponId;
    },
    [language]
  );

  const getWeaponEffect = useCallback(
    (weaponId: string): string => {
      const weaponData = i18nGameData.weapons as Record<
        string,
        { effect: Record<string, string> }
      >;
      return weaponData[weaponId]?.effect?.[language] || "";
    },
    [language]
  );

  const formatReleaseDate = useCallback(
    (dateString: string): string => {
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
      mainStat: getMainStatName,
      subStat: getSubStatName,
      element: getElementName,
      weaponType: getWeaponTypeName,
      weaponName: getWeaponName,
      weaponEffect: getWeaponEffect,
      formatDate: formatReleaseDate,
      ui: getUIMessage,
      format: formatString,
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
      getMainStatName,
      getSubStatName,
      getElementName,
      getWeaponTypeName,
      getWeaponName,
      getWeaponEffect,
      formatReleaseDate,
      getUIMessage,
      formatString,
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
