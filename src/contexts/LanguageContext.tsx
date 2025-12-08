import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { Language } from '../data/types';
import { i18nGameData } from '../data/i18n-game';
import { i18nAppData } from '../data/i18n-app';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: {
    character: (id: string) => string;
    artifact: (id: string) => string;
    artifactEffects: (id: string) => string[];
    artifactFirstEffect: (id: string) => string;
    region: (key: string) => string;
    stat: (key: string) => string;
    statShort: (key: string) => string;
    mainStat: (key: string) => string;
    subStat: (key: string) => string;
    element: (key: string) => string;
    weapon: (key: string) => string;
    formatDate: (dateString: string) => string;
    ui: (path: string) => string;
    format: (key: string, ...args: (string | number)[]) => string;
    lang: Language;
  };
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'app_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return (stored === 'en' || stored === 'zh') ? stored : 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (err) {
      console.error('Failed to save language to localStorage:', err);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState(prevLang => {
      const newLang = prevLang === 'en' ? 'zh' : 'en';
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      } catch (err) {
        console.error('Failed to save language to localStorage:', err);
      }
      return newLang;
    });
  }, []);

  // Character helpers
  const getCharacterName = useCallback((characterId: string): string => {
    const chars = i18nGameData.characters as Record<string, Record<string, string>>;
    return chars[characterId]?.[language] || characterId;
  }, [language]);

  // Artifact helpers
  const getArtifactSetName = useCallback((setId: string): string => {
    const arts = i18nGameData.artifacts as Record<string, { name: Record<string, string>, effects: Record<string, string[]> }>;
    return arts[setId]?.name?.[language] || setId;
  }, [language]);

  const getArtifactSetEffects = useCallback((setId: string): string[] => {
    const arts = i18nGameData.artifacts as Record<string, { name: Record<string, string>, effects: Record<string, string[]> }>;
    return arts[setId]?.effects?.[language] || [];
  }, [language]);

  const getArtifactSetFirstEffect = useCallback((setId: string): string => {
    const effects = getArtifactSetEffects(setId);
    return effects[0] || '';
  }, [getArtifactSetEffects]);

  // Region helpers
  const getRegionName = useCallback((regionKey: string): string => {
    const regs = i18nAppData.regions as Record<string, Record<string, string>>;
    return regs[regionKey]?.[language] || regionKey;
  }, [language]);

  // Stat helpers (unified for both main and sub stats)
  const getStatName = useCallback((statKey: string): string => {
    const stats = i18nAppData.stats as Record<string, Record<string, string>>;
    return stats[statKey]?.[language] || statKey;
  }, [language]);

  const getStatShortName = useCallback((statKey: string): string => {
    const stats = i18nAppData.statsShort as Record<string, Record<string, string>>;
    return stats[statKey]?.[language] || statKey;
  }, [language]);

  const getMainStatName = useCallback((statKey: string): string => {
    return getStatName(statKey);
  }, [getStatName]);

  const getSubStatName = useCallback((statKey: string): string => {
    return getStatName(statKey);
  }, [getStatName]);

  // Element and weapon helpers
  const getElementName = useCallback((element: string): string => {
    const elems = i18nAppData.elements as Record<string, Record<string, string>>;
    return elems[element]?.[language] || element;
  }, [language]);

  const getWeaponName = useCallback((weapon: string): string => {
    const weaps = i18nAppData.weapons as Record<string, Record<string, string>>;
    return weaps[weapon]?.[language] || weapon;
  }, [language]);

  // Date formatting helpers
  const formatReleaseDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11

    if (language === 'zh') {
      return `${year}年${month}月`;
    } else {
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return `${monthNames[month - 1]} ${year}`;
    }
  }, [language]);

  // UI message helpers
  const getUIMessage = useCallback((path: string): string => {
    const keys = path.split('.');
    let current: Record<string, unknown> = i18nAppData.ui;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key] as Record<string, unknown>;
      } else {
        return path; // Fallback to path if not found
      }
    }

    return (current as Record<string, string>)?.[language] || path;
  }, [language]);

  // Format string helper
  const formatString = useCallback((key: string, ...args: (string | number)[]): string => {
    const template = getUIMessage(key);
    return template.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? String(args[number]) : match;
    });
  }, [getUIMessage]);

  // Memoize the t object to prevent recreation on every render
  const t = useMemo(() => ({
    character: getCharacterName,
    artifact: getArtifactSetName,
    artifactEffects: getArtifactSetEffects,
    artifactFirstEffect: getArtifactSetFirstEffect,
    region: getRegionName,
    stat: getStatName,
    statShort: getStatShortName,
    mainStat: getMainStatName,
    subStat: getSubStatName,
    element: getElementName,
    weapon: getWeaponName,
    formatDate: formatReleaseDate,
    ui: getUIMessage,
    format: formatString,
    lang: language,
  }), [
    getCharacterName,
    getArtifactSetName,
    getArtifactSetEffects,
    getArtifactSetFirstEffect,
    getRegionName,
    getStatName,
    getStatShortName,
    getMainStatName,
    getSubStatName,
    getElementName,
    getWeaponName,
    formatReleaseDate,
    getUIMessage,
    formatString,
    language,
  ]);

  // Memoize context value to prevent cascading re-renders
  const value = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage,
    toggleLanguage,
    t,
  }), [language, setLanguage, toggleLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
