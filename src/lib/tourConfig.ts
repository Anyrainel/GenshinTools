import type { Tour } from "@/components/ui/tour";
import type { useLanguage } from "@/contexts/LanguageContext";

/**
 * Tour definitions for onboarding experiences throughout the app.
 * Each tour targets elements using data-tour-step-id attributes.
 * Tours are localized using the translation helper from LanguageContext.
 */
export const getTours = (t: ReturnType<typeof useLanguage>["t"]): Tour[] => [
  {
    id: "artifact-filter",
    guideContent: t.ui("tour.guide.artifactFilter"),
    steps: [
      {
        id: "af-presets",
        title: t.ui("tour.artifactFilter.presetsTitle"),
        content: t.ui("tour.artifactFilter.presetsContent"),
        side: "bottom",
      },
      {
        id: "af-build-card",
        title: t.ui("tour.artifactFilter.buildCardTitle"),
        content: t.ui("tour.artifactFilter.buildCardContent"),
        side: "right",
      },
      {
        id: "af-compute-tab",
        title: t.ui("tour.artifactFilter.computeTabTitle"),
        content: t.ui("tour.artifactFilter.computeTabContent"),
        side: "bottom",
      },
    ],
  },
  {
    id: "tier-list",
    guideContent: t.ui("tour.guide.tierList"),
    steps: [
      {
        id: "tl-unassigned",
        title: t.ui("tour.tierList.unassignedTitle"),
        content: t.ui("tour.tierList.unassignedContent"),
        side: "bottom",
      },
      {
        id: "tl-tier-row",
        title: t.ui("tour.tierList.tierRowTitle"),
        content: t.ui("tour.tierList.tierRowContent"),
        side: "right",
      },
      {
        id: "tl-customize",
        title: t.ui("tour.tierList.customizeTitle"),
        content: t.ui("tour.tierList.customizeContent"),
        side: "left",
      },
      {
        id: "tl-export",
        title: t.ui("tour.tierList.exportTitle"),
        content: t.ui("tour.tierList.exportContent"),
        side: "left",
      },
    ],
  },
  {
    id: "account-data",
    guideContent: t.ui("tour.guide.accountData"),
    steps: [
      {
        id: "ad-import",
        title: t.ui("tour.accountData.importTitle"),
        content: t.ui("tour.accountData.importContent"),
        side: "bottom",
      },
      {
        id: "ad-characters",
        title: t.ui("tour.accountData.charactersTitle"),
        content: t.ui("tour.accountData.charactersContent"),
        side: "bottom",
      },
      {
        id: "ad-summary",
        title: t.ui("tour.accountData.summaryTitle"),
        content: t.ui("tour.accountData.summaryContent"),
        side: "bottom",
      },
      {
        id: "ad-weights",
        title: t.ui("tour.accountData.weightsTitle"),
        content: t.ui("tour.accountData.weightsContent"),
        side: "bottom",
      },
    ],
  },
];

/** localStorage keys for tracking tour completion */
export const TOUR_STORAGE_KEYS = {
  "artifact-filter": "tour-artifact-filter-completed",
  "tier-list": "tour-tier-list-completed",
  "account-data": "tour-account-data-completed",
} as const;

/** Check if a tour has been completed */
export function isTourCompleted(
  tourId: keyof typeof TOUR_STORAGE_KEYS
): boolean {
  return localStorage.getItem(TOUR_STORAGE_KEYS[tourId]) === "true";
}

/** Mark a tour as completed */
export function markTourCompleted(
  tourId: keyof typeof TOUR_STORAGE_KEYS
): void {
  localStorage.setItem(TOUR_STORAGE_KEYS[tourId], "true");
}

/** Reset a tour so it can be shown again */
export function resetTour(tourId: keyof typeof TOUR_STORAGE_KEYS): void {
  localStorage.removeItem(TOUR_STORAGE_KEYS[tourId]);
}
