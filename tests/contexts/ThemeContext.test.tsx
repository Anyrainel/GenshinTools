import { THEME_IDS, ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  // Reset document attribute
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeContext", () => {
  describe("useTheme outside provider", () => {
    it("throws error when used outside ThemeProvider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow("useTheme must be used within a ThemeProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("initial state", () => {
    it("defaults to abyss theme", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      expect(result.current.theme).toBe("abyss");
    });

    it("reads theme from localStorage if valid", () => {
      localStorageMock.setItem("app_theme", "liyue");

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      expect(result.current.theme).toBe("liyue");
    });

    it("falls back to default if localStorage value is invalid", () => {
      localStorageMock.setItem("app_theme", "invalid_theme");

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      expect(result.current.theme).toBe("abyss");
    });

    it("applies theme to document element", () => {
      localStorageMock.setItem("app_theme", "mondstadt");

      renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      expect(document.documentElement.getAttribute("data-theme")).toBe(
        "mondstadt"
      );
    });
  });

  describe("setTheme", () => {
    it("updates theme state", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      act(() => {
        result.current.setTheme("fontaine");
      });

      expect(result.current.theme).toBe("fontaine");
    });

    it("persists theme to localStorage", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      act(() => {
        result.current.setTheme("inazuma");
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "app_theme",
        "inazuma"
      );
    });

    it("updates document data-theme attribute", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      act(() => {
        result.current.setTheme("natlan");
      });

      expect(document.documentElement.getAttribute("data-theme")).toBe(
        "natlan"
      );
    });
  });

  describe("THEME_IDS", () => {
    it("exports all available theme IDs", () => {
      expect(THEME_IDS).toContain("abyss");
      expect(THEME_IDS).toContain("mondstadt");
      expect(THEME_IDS).toContain("liyue");
      expect(THEME_IDS).toContain("inazuma");
      expect(THEME_IDS).toContain("sumeru");
      expect(THEME_IDS).toContain("fontaine");
      expect(THEME_IDS).toContain("natlan");
      expect(THEME_IDS).toContain("snezhnaya");
      expect(THEME_IDS).toContain("nodkrai");
    });
  });
});
