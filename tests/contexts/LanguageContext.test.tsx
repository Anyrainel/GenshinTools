import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
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
});

describe("LanguageContext", () => {
  describe("useLanguage outside provider", () => {
    it("throws error when used outside LanguageProvider", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useLanguage());
      }).toThrow("useLanguage must be used within a LanguageProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("initial state", () => {
    it("defaults to English", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      expect(result.current.language).toBe("en");
    });

    it("reads language from localStorage if valid", () => {
      localStorageMock.setItem("app_language", "zh");

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      expect(result.current.language).toBe("zh");
    });

    it("falls back to English if localStorage value is invalid", () => {
      localStorageMock.setItem("app_language", "invalid");

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      expect(result.current.language).toBe("en");
    });
  });

  describe("setLanguage", () => {
    it("updates language state", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      act(() => {
        result.current.setLanguage("zh");
      });

      expect(result.current.language).toBe("zh");
    });

    it("persists language to localStorage", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      act(() => {
        result.current.setLanguage("zh");
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "app_language",
        "zh"
      );
    });
  });

  describe("toggleLanguage", () => {
    it("toggles from en to zh", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      act(() => {
        result.current.toggleLanguage();
      });

      expect(result.current.language).toBe("zh");
    });

    it("toggles from zh to en", () => {
      localStorageMock.setItem("app_language", "zh");

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      act(() => {
        result.current.toggleLanguage();
      });

      expect(result.current.language).toBe("en");
    });

    it("persists toggled language to localStorage", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      act(() => {
        result.current.toggleLanguage();
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "app_language",
        "zh"
      );
    });
  });

  describe("translation helpers", () => {
    it("provides t.ui helper for UI messages", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      // Should return translated string or fallback to path
      const message = result.current.t.ui("app.import");
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);
    });

    it("t.ui falls back to path for unknown keys", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      const message = result.current.t.ui("nonexistent.path.here");
      expect(message).toBe("nonexistent.path.here");
    });

    it("provides t.stat helper for stat names", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      const statName = result.current.t.stat("cr");
      expect(typeof statName).toBe("string");
    });

    it("provides t.element helper for element names", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      const elementName = result.current.t.element("pyro");
      expect(typeof elementName).toBe("string");
    });

    it("provides t.format for parameterized strings", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      // t.format replaces {0}, {1}, etc. with provided args
      // Even if the key doesn't exist, it returns the path
      const formatted = result.current.t.format("test.key", "arg1", "arg2");
      expect(typeof formatted).toBe("string");
    });

    it("provides t.formatDate for localized dates", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      const date = result.current.t.formatDate("2024-03-15");
      expect(date).toContain("2024");
    });

    it("t.formatDate formats differently for zh", () => {
      localStorageMock.setItem("app_language", "zh");

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      const date = result.current.t.formatDate("2024-03-15");
      expect(date).toContain("年");
      expect(date).toContain("月");
    });

    it("exposes current language via t.lang", () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      expect(result.current.t.lang).toBe("en");

      act(() => {
        result.current.setLanguage("zh");
      });

      expect(result.current.t.lang).toBe("zh");
    });
  });
});
