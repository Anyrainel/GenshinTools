import type { TabConfig } from "@/components/layout/AppBar";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Book,
  Box,
  Crown,
  Diamond,
  Filter,
  Flame,
  FlaskConical,
  Lightbulb,
  Lock,
  Settings,
  Skull,
  Snowflake,
  Sword,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react";

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
        label: t.ui("accountData.inventory"),
        href: "/account-data?tab=inventory",
        value: "inventory",
        icon: Box,
      },
      {
        label: t.ui("accountData.recommendations"),
        href: "/account-data?tab=recommendations",
        value: "recommendations",
        icon: Lightbulb,
        tourStepId: "ad-recommendations",
      },
      {
        label: t.ui("evaluation.tabLabel"),
        href: "/account-data?tab=evaluation",
        value: "evaluation",
        icon: BarChart3,
        tourStepId: "ad-evaluation",
      },
      {
        label: t.ui("triage.tabLabel"),
        href: "/account-data?tab=triage",
        value: "triage",
        icon: Lock,
        tourStepId: "ad-triage",
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
      {
        label: t.ui("navigation.autoTune"),
        href: "/artifact-filter?tab=weights",
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
        href: "/tier-list?tab=characters",
        value: "characters",
        icon: Crown,
      },
      {
        label: t.ui("app.weaponTierListTitle"),
        href: "/tier-list?tab=weapons",
        value: "weapons",
        icon: Sword,
        tourStepId: "tl-weapons-tab",
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
        icon: Swords,
      },
      {
        label: t.ui("archive.artifacts"),
        href: "/archive?tab=artifacts",
        value: "artifacts",
        icon: Diamond,
      },
      {
        label: t.ui("archive.bosses"),
        href: "/archive?tab=bosses",
        value: "bosses",
        icon: Skull,
      },
    ],
  },
  {
    label: t.ui("app.navTeamComp"),
    href: "/team-comp",
    children: [
      {
        label: t.ui("common.damage"),
        href: "/team-comp?tab=damage",
        value: "damage",
        icon: Flame,
      },
      {
        label: t.ui("teamComp.tabFrozen"),
        href: "/team-comp?tab=frozen",
        value: "frozen",
        icon: Snowflake,
      },
      {
        label: t.ui("teamComp.tabInvestment"),
        href: "/team-comp?tab=investment",
        value: "investment",
        icon: TrendingUp,
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
