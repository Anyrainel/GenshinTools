import type { useLanguage } from "@/contexts/LanguageContext";
import type { LucideIcon } from "lucide-react";
import {
  Book,
  Box,
  Filter,
  LayoutGrid,
  Settings,
  Sword,
  Users,
} from "lucide-react";

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
        label: t.ui("accountData.recommendations"),
        href: "/account-data?tab=recommendations",
        value: "recommendations",
        icon: LayoutGrid,
        tourStepId: "ad-recommendations",
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
    children: [
      {
        label: t.ui("app.tierListTitle"),
        href: "/tier-list?tab=characters",
        value: "characters",
        icon: LayoutGrid,
      },
      {
        label: t.ui("app.weaponTierListTitle"),
        href: "/tier-list?tab=weapons",
        value: "weapons",
        icon: Sword,
      },
    ],
  },
  {
    label: t.ui("app.navArchive"),
    href: "/archive",
    children: [
      {
        label: t.ui("archive.characters"),
        href: "/archive?tab=characters",
        value: "characters",
        icon: Book,
      },
      {
        label: t.ui("archive.weapons"),
        href: "/archive?tab=weapons",
        value: "weapons",
        icon: Sword,
      },
      {
        label: t.ui("archive.artifacts"),
        href: "/archive?tab=artifacts",
        value: "artifacts",
        icon: Box,
      },
    ],
  },
  {
    label: t.ui("app.navTeamComp"),
    href: "/team-comp",
  },
];
