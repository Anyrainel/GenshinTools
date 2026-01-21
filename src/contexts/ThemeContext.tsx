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

import { applyThemeVars } from "@/lib/theme-generator";

export type ThemeId =
  | "abyss"
  | "mondstadt"
  | "liyue"
  | "inazuma"
  | "sumeru"
  | "fontaine"
  | "natlan"
  | "snezhnaya"
  | "nodkrai";

export const THEME_IDS: ThemeId[] = [
  "abyss",
  "mondstadt",
  "liyue",
  "inazuma",
  "sumeru",
  "fontaine",
  "natlan",
  "snezhnaya",
  "nodkrai",
];

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "app_theme";
const DEFAULT_THEME: ThemeId = "abyss";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && THEME_IDS.includes(stored as ThemeId)) {
        return stored as ThemeId;
      }
    } catch {
      // Ignore localStorage errors
    }
    return DEFAULT_THEME;
  });

  // Apply theme CSS variables to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    applyThemeVars(theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (err) {
      console.error("Failed to save theme to localStorage:", err);
    }
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
