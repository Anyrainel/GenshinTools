import { ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { getNavigationConfig } from "@/components/layout/appNavigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface FeatureMatrixItem {
  label: string;
  description: string;
  href: string;
}

interface FeatureMatrixGroup {
  label: string;
  items: FeatureMatrixItem[];
}

function getFeatureMatrixGroups(
  t: ReturnType<typeof useLanguage>["t"]
): FeatureMatrixGroup[] {
  return [
    {
      label: t.ui("app.navAccountData"),
      items: [
        {
          label: t.ui("app.featureRosterProgress"),
          description: t.ui("app.featureRosterProgressDesc"),
          href: "/account-data/characters",
        },
        {
          label: t.ui("app.featureBrowseInventory"),
          description: t.ui("app.featureBrowseInventoryDesc"),
          href: "/account-data/inventory",
        },
        {
          label: t.ui("app.featureFindUpgrades"),
          description: t.ui("app.featureFindUpgradesDesc"),
          href: "/account-data/recommendations",
        },
        {
          label: t.ui("app.featureDiagnoseBuilds"),
          description: t.ui("app.featureDiagnoseBuildsDesc"),
          href: "/account-data/evaluation",
        },
        {
          label: t.ui("app.featureSpendResources"),
          description: t.ui("app.featureSpendResourcesDesc"),
          href: "/account-data/resources",
        },
        {
          label: t.ui("app.featureDecideLocks"),
          description: t.ui("app.featureDecideLocksDesc"),
          href: "/account-data/triage",
        },
      ],
    },
    {
      label: t.ui("app.navTeamComp"),
      items: [
        {
          label: t.ui("app.featureOptimizeDamage"),
          description: t.ui("app.featureOptimizeDamageDesc"),
          href: "/team-comp/damage",
        },
        {
          label: t.ui("app.featureManageFrozen"),
          description: t.ui("app.featureManageFrozenDesc"),
          href: "/team-comp/frozen",
        },
        {
          label: t.ui("app.featureCompareInvestment"),
          description: t.ui("app.featureCompareInvestmentDesc"),
          href: "/team-comp/investment",
        },
        {
          label: t.ui("app.featureChooseLoadout"),
          description: t.ui("app.featureChooseLoadoutDesc"),
          href: "/team-comp/weapon",
        },
      ],
    },
    {
      label: t.ui("app.navArtifactFilter"),
      items: [
        {
          label: t.ui("app.featureSetBuildTargets"),
          description: t.ui("app.featureSetBuildTargetsDesc"),
          href: "/artifact-filter/configure",
        },
        {
          label: t.ui("app.featureGenerateLockFilters"),
          description: t.ui("app.featureGenerateLockFiltersDesc"),
          href: "/artifact-filter/filters",
        },
        {
          label: t.ui("app.featureTuneWeights"),
          description: t.ui("app.featureTuneWeightsDesc"),
          href: "/artifact-filter/weights",
        },
      ],
    },
    {
      label: t.ui("app.navTierList"),
      items: [
        {
          label: t.ui("app.featureRankCharacters"),
          description: t.ui("app.featureRankCharactersDesc"),
          href: "/tier-list/characters",
        },
        {
          label: t.ui("app.featureMakeWeaponList"),
          description: t.ui("app.featureMakeWeaponListDesc"),
          href: "/tier-list/weapons",
        },
        {
          label: t.ui("app.featureMakeArtifactList"),
          description: t.ui("app.featureMakeArtifactListDesc"),
          href: "/tier-list/artifacts",
        },
      ],
    },
    {
      label: t.ui("app.navArchive"),
      items: [
        {
          label: t.ui("app.featureLookupKits"),
          description: t.ui("app.featureLookupKitsDesc"),
          href: "/archive/characters",
        },
        {
          label: t.ui("app.featureLookupWeapons"),
          description: t.ui("app.featureLookupWeaponsDesc"),
          href: "/archive/weapons",
        },
        {
          label: t.ui("app.featureReadSetEffects"),
          description: t.ui("app.featureReadSetEffectsDesc"),
          href: "/archive/artifacts",
        },
        {
          label: t.ui("app.featureCheckBosses"),
          description: t.ui("app.featureCheckBossesDesc"),
          href: "/archive/bosses",
        },
      ],
    },
  ];
}

export function FeatureMatrix() {
  const { t } = useLanguage();
  const groups = getFeatureMatrixGroups(t);
  const iconsByHref = new Map<string, LucideIcon>();

  for (const group of getNavigationConfig(t)) {
    for (const tab of group.children ?? []) {
      if (tab.icon) {
        iconsByHref.set(tab.href, tab.icon);
      }
    }
  }

  return (
    <section className="w-full pt-10 md:pt-16">
      <div className="flex flex-col gap-2 text-center mb-5">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {t.ui("app.featureMatrixTitle")}
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          {t.ui("app.featureMatrixDesc")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-x-6 gap-y-6">
        {groups.map((group) => (
          <div
            key={group.label}
            className="min-w-0 rounded-lg border border-border/20 bg-card/10 px-3 py-3"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-3">
              {group.label}
            </h3>
            <ul className="space-y-3">
              {group.items.map((item) => {
                const Icon = iconsByHref.get(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className="group/link block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="inline-flex items-center gap-1.5 border-b border-transparent text-sm font-semibold text-foreground group-hover/link:border-primary group-hover/link:text-primary">
                        {Icon && (
                          <Icon
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        {item.label}
                        <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover/link:translate-x-0.5" />
                      </span>
                      <span className="block mt-0.5 text-xs leading-snug text-muted-foreground">
                        {item.description}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
