import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Book,
  Box,
  Crosshair,
  Crown,
  Diamond,
  Filter,
  FlaskConical,
  Gem,
  Lightbulb,
  Lock,
  Medal,
  Settings,
  Skull,
  Snowflake,
  Sword,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react";
import type { useLanguage } from "@/contexts/LanguageContext";

interface NavTab {
  label: string;
  href: string;
  icon?: LucideIcon;
  value: string; // Used for matching active state if needed
  tourStepId?: string; // Tour step ID for onboarding spotlight
}

interface NavItem {
  label: string;
  href: string;
  children?: NavTab[];
}

/**
 * Configuration for a tab in the AppBar.
 * Tabs are displayed inline on desktop and collapse into the hamburger menu on mobile.
 */
export interface TabConfig {
  value: string;
  label: string;
  icon?: LucideIcon;
  /** Tour step ID for onboarding spotlight */
  tourStepId?: string;
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
        href: "/account-data/characters",
        value: "characters",
        icon: Users,
        tourStepId: "ad-characters",
      },
      {
        label: t.ui("accountData.inventory"),
        href: "/account-data/inventory",
        value: "inventory",
        icon: Box,
      },
      {
        label: t.ui("accountData.recommendations"),
        href: "/account-data/recommendations",
        value: "recommendations",
        icon: Lightbulb,
        tourStepId: "ad-recommendations",
      },
      {
        label: t.ui("evaluation.tabLabel"),
        href: "/account-data/evaluation",
        value: "evaluation",
        icon: BarChart3,
        tourStepId: "ad-evaluation",
      },
      {
        label: t.ui("evaluation.resourcesTabLabel"),
        href: "/account-data/resources",
        value: "resources",
        icon: Gem,
      },
      {
        label: t.ui("triage.tabLabel"),
        href: "/account-data/triage",
        value: "triage",
        icon: Lock,
        tourStepId: "ad-triage",
      },
    ],
  },
  {
    label: t.ui("app.navTeamComp"),
    href: "/team-comp",
    children: [
      {
        label: t.ui("teamComp.tabDamage"),
        href: "/team-comp/damage",
        value: "damage",
        icon: Crosshair,
      },
      {
        label: t.ui("teamComp.tabFrozen"),
        href: "/team-comp/frozen",
        value: "frozen",
        icon: Snowflake,
      },
      {
        label: t.ui("teamComp.tabInvestment"),
        href: "/team-comp/investment",
        value: "investment",
        icon: TrendingUp,
      },
      {
        label: t.ui("teamComp.tabWeaponChoice"),
        href: "/team-comp/weapon",
        value: "weapon",
        icon: Medal,
      },
    ],
  },
  {
    label: t.ui("app.navArtifactFilter"),
    href: "/artifact-filter",
    children: [
      {
        label: t.ui("navigation.configure"),
        href: "/artifact-filter/configure",
        value: "configure",
        icon: Settings,
      },
      {
        label: t.ui("navigation.computeFilters"),
        href: "/artifact-filter/filters",
        value: "filters",
        icon: Filter,
        tourStepId: "af-compute-tab",
      },
      {
        label: t.ui("navigation.autoTune"),
        href: "/artifact-filter/weights",
        value: "weights",
        icon: FlaskConical,
        tourStepId: "af-weights-tab",
      },
    ],
  },
  {
    label: t.ui("app.navTierList"),
    href: "/tier-list",
    children: [
      {
        label: t.ui("app.tierListTitle"),
        href: "/tier-list/characters",
        value: "characters",
        icon: Crown,
      },
      {
        label: t.ui("app.weaponTierListTitle"),
        href: "/tier-list/weapons",
        value: "weapons",
        icon: Sword,
        tourStepId: "tl-weapons-tab",
      },
      {
        label: t.ui("app.artifactTierListTitle"),
        href: "/tier-list/artifacts",
        value: "artifacts",
        icon: Diamond,
      },
    ],
  },
  {
    label: t.ui("app.navArchive"),
    href: "/archive",
    children: [
      {
        label: t.ui("archive.characters"),
        href: "/archive/characters",
        value: "characters",
        icon: Book,
      },
      {
        label: t.ui("archive.weapons"),
        href: "/archive/weapons",
        value: "weapons",
        icon: Swords,
      },
      {
        label: t.ui("archive.artifacts"),
        href: "/archive/artifacts",
        value: "artifacts",
        icon: Diamond,
      },
      {
        label: t.ui("archive.bosses"),
        href: "/archive/bosses",
        value: "bosses",
        icon: Skull,
      },
    ],
  },
];

export function getTabsForRoute(
  t: ReturnType<typeof useLanguage>["t"],
  route: string
): TabConfig[] {
  const nav = getNavigationConfig(t);
  const item = nav.find((n) => n.href === route);
  return (item?.children ?? []).map(({ value, label, icon, tourStepId }) => ({
    value,
    label,
    icon,
    tourStepId,
  }));
}
