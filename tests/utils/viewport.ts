import { vi } from "vitest";

/**
 * Standard viewport sizes for testing responsive behavior.
 * Mobile breakpoint in useIsMobile is 768px.
 *
 * Device references (2024+):
 * - Desktop: 1920×1080 (most common, Steam/StatCounter data)
 * - Tablet: 820×1180 (iPad 10th gen portrait)
 * - Mobile: 390×844 (iPhone 14/15)
 */
export const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

/**
 * Set the viewport for tests.
 * Updates window.innerWidth/innerHeight and triggers matchMedia listeners.
 */
export function setViewport(viewportName: ViewportName) {
  const viewport = VIEWPORTS[viewportName];

  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: viewport.width,
  });

  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: viewport.height,
  });

  // Update matchMedia mock to return correct value based on viewport
  const MOBILE_BREAKPOINT = 768;
  const isMobile = viewport.width < MOBILE_BREAKPOINT;

  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: query.includes("max-width") ? isMobile : !isMobile,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  // Trigger resize event for components listening to it
  window.dispatchEvent(new Event("resize"));
}

/**
 * Reset viewport to desktop (default for tests).
 */
export function resetViewport() {
  setViewport("desktop");
}
