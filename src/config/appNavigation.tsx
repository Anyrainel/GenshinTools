import type { useLanguage } from "@/contexts/LanguageContext";
import type { LucideIcon } from "lucide-react";
import { Box, Filter, LayoutGrid, Settings, Users } from "lucide-react";

export interface NavTab {
  label: string;
  href: string;
  icon?: LucideIcon;
  value: string; // Used for matching active state if needed
  tourStepId?: string; // Tour step ID for onboarding spotlight
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavTab[];
}

export const getNavigationConfig = (
  t: ReturnType<typeof useLanguage>["t"]
): NavItem[] => [
  {
    label: t.ui("app.navAccountData"),
    href: "/account-data",
    children: [
      {
        label: t.ui("accountData.characters"),
        href: "/account-data?tab=characters",
        value: "characters",
        icon: Users,
        tourStepId: "ad-characters",
      },
      {
        label: t.ui("accountData.summary"),
        href: "/account-data?tab=summary",
        value: "summary",
        icon: LayoutGrid,
        tourStepId: "ad-summary",
      },
      {
        label: t.ui("accountData.inventory"),
        href: "/account-data?tab=inventory",
        value: "inventory",
        icon: Box,
      },
      {
        label: t.ui("accountData.statWeights"),
        href: "/account-data?tab=weights",
        value: "weights",
        icon: Settings,
        tourStepId: "ad-weights",
      },
    ],
  },
  {
    label: t.ui("app.navArtifactFilter"),
    href: "/artifact-filter",
    children: [
      {
        label: t.ui("navigation.configure"),
        href: "/artifact-filter?tab=configure",
        value: "configure",
        icon: Settings,
      },
      {
        label: t.ui("navigation.computeFilters"),
        href: "/artifact-filter?tab=filters",
        value: "filters",
        icon: Filter,
        tourStepId: "af-compute-tab",
      },
    ],
  },
  {
    label: t.ui("app.navTierList"),
    href: "/tier-list",
  },
  {
    label: t.ui("app.navWeaponBrowser"),
    href: "/weapon-browser",
  },
  {
    label: t.ui("app.navTeamBuilder"),
    href: "/team-builder",
  },
];
