import { ArtifactDataHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById, weaponsById } from "@/data/constants";
import { getWeaponDisplayMeta } from "@/data/gameStatsLoader";
import type { AccountData, ArtifactData, WeaponData } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn, getAssetUrl } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface InventoryViewProps {
  data: AccountData;
}

export function InventoryView({ data }: InventoryViewProps) {
  const { t } = useLanguage();
  const { weaponStats } = useGameStats();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const iconSize = isMobile ? "lg" : "xl";

  // WEAPONS - sorted by rarity desc > weapon type (from stats when available)
  const allWeapons = (data.extraWeapons || []).slice().sort((a, b) => {
    const infoA = weaponsById[a.key];
    const infoB = weaponsById[b.key];
    const metaA = infoA
      ? getWeaponDisplayMeta(infoA, weaponStats?.[a.key])
      : null;
    const metaB = infoB
      ? getWeaponDisplayMeta(infoB, weaponStats?.[b.key])
      : null;
    if (metaA && metaB && metaA.rarity !== metaB.rarity) {
      return metaB.rarity - metaA.rarity;
    }
    if (
      metaA?.type != null &&
      metaB?.type != null &&
      metaA.type !== metaB.type
    ) {
      return metaA.type.localeCompare(metaB.type);
    }
    return a.key.localeCompare(b.key);
  });

  // Helper to group weapons
  const groupWeapons = (list: WeaponData[]) => {
    const grouped: Record<string, WeaponData & { count: number }> = {};
    for (const w of list) {
      const groupKey = `${w.key}-L${w.level}-R${w.refinement}`;
      if (!grouped[groupKey]) {
        grouped[groupKey] = { ...w, count: 0 };
      }
      grouped[groupKey].count += 1;
    }
    // Convert back to array and preserve sort order (roughly).
    // Since we iterate in sort order, Object.values might lose it but usually insertion order is kept in JS.
    // Better to map keys.
    // Actually, let's just use a Map to update counts or rebuild array.
    // Rebuilding array:
    const result: (WeaponData & { count: number })[] = [];
    const seen = new Set<string>();

    for (const w of list) {
      const groupKey = `${w.key}-L${w.level}-R${w.refinement}`;
      if (seen.has(groupKey)) continue;

      // Calculate total count for this key
      const count = list.filter(
        (item) =>
          item.key === w.key &&
          item.level === w.level &&
          item.refinement === w.refinement
      ).length;

      result.push({ ...w, count });
      seen.add(groupKey);
    }
    return result;
  };

  const maxLvlWeapons = groupWeapons(allWeapons.filter((w) => w.level === 90));
  const otherWeapons = groupWeapons(allWeapons.filter((w) => w.level < 90));

  // ARTIFACTS - sorted by set key > slot order
  const slotOrder: Record<string, number> = {
    flower: 0,
    plume: 1,
    sands: 2,
    goblet: 3,
    circlet: 4,
  };

  const sortedArtifacts = (data.extraArtifacts || []).slice().sort((a, b) => {
    // Sort by set key first
    if (a.setKey !== b.setKey) {
      return a.setKey.localeCompare(b.setKey);
    }
    // Then by slot order
    return (slotOrder[a.slotKey] ?? 5) - (slotOrder[b.slotKey] ?? 5);
  });

  // Helper to determine "Max Level" for artifacts
  const isMaxArtifact = (a: ArtifactData) => {
    return (
      (a.rarity === 5 && a.level === 20) || (a.rarity === 4 && a.level === 16)
    );
  };

  const maxLvlArtifacts = sortedArtifacts.filter(isMaxArtifact);
  const otherArtifacts = sortedArtifacts.filter((a) => !isMaxArtifact(a));

  return (
    <ScrollLayout className="space-y-4 pb-12 mt-2">
      <Section
        title={t.ui("accountData.maxLvlWeapons")}
        count={maxLvlWeapons.length}
        defaultOpen={true}
      >
        <WeaponGrid weapons={maxLvlWeapons} iconSize={iconSize} t={t} />
      </Section>

      <Section
        title={t.ui("accountData.otherWeapons")}
        count={otherWeapons.length}
        defaultOpen={false}
      >
        <WeaponGrid weapons={otherWeapons} iconSize={iconSize} t={t} />
      </Section>

      <Section
        title={t.ui("accountData.maxLvlArtifacts")}
        count={maxLvlArtifacts.length}
        defaultOpen={true}
      >
        <ArtifactGrid artifacts={maxLvlArtifacts} iconSize={iconSize} />
      </Section>

      <Section
        title={t.ui("accountData.otherArtifacts")}
        count={otherArtifacts.length}
        defaultOpen={false}
      >
        <ArtifactGrid artifacts={otherArtifacts} iconSize={iconSize} />
      </Section>
    </ScrollLayout>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------------------

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center w-full text-left gap-2 p-2 hover:bg-white/5 rounded-md transition-colors group select-none"
      >
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
        <h3 className="text-lg font-semibold text-foreground/90 group-hover:text-foreground">
          {title}{" "}
          <span className="text-muted-foreground ml-1 text-base font-normal">
            ({count})
          </span>
        </h3>
      </button>

      {isOpen && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

function WeaponGrid({
  weapons,
  iconSize,
  t,
}: {
  weapons: (WeaponData & { count: number })[];
  iconSize: "lg" | "xl";
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="flex flex-wrap gap-3 px-2">
      {weapons.map((w) => {
        const weaponInfo = weaponsById[w.key];
        const name = t.weaponName(w.key);
        return (
          <Tooltip key={w.id}>
            <TooltipTrigger asChild>
              <Card className="flex flex-col cursor-help bg-transparent border-0 shadow-none group">
                <div className="relative transition-transform group-hover:scale-105 duration-200">
                  <ItemIcon
                    imagePath={weaponInfo?.imagePath || ""}
                    rarity={weaponInfo?.rarity || 1}
                    badge={w.refinement}
                    lock={w.lock}
                    level={`Lv. ${w.level}`}
                    size={iconSize}
                  />
                  {w.count > 1 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/60 text-white font-bold text-lg px-2 py-0.5 rounded-full shadow-sm backdrop-blur-[2px]">
                        x{w.count}
                      </div>
                    </div>
                  )}
                </div>
                <div className="pt-1 text-xs text-center font-medium opacity-90 group-hover:opacity-100 group-hover:text-white transition-colors line-clamp-2 leading-tight">
                  {name}
                </div>
              </Card>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="p-0 border-none bg-transparent"
            >
              <WeaponTooltip weaponId={w.key} />
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function ArtifactGrid({
  artifacts,
  iconSize,
}: {
  artifacts: ArtifactData[];
  iconSize: "lg" | "xl";
}) {
  return (
    <div className="flex flex-wrap gap-3 px-2">
      {artifacts.map((a) => {
        const artInfo = artifactsById[a.setKey];
        const badge = a.astralMark ? "⭐" : undefined;

        return (
          <ArtifactDataHoverCard
            key={a.id}
            artifact={a}
            slot={a.slotKey}
            side="right"
          >
            <div className="relative rounded-md overflow-hidden group cursor-help transition-transform hover:scale-105 duration-200">
              <ItemIcon
                imagePath={artInfo?.imagePaths[a.slotKey] || ""}
                rarity={a.rarity}
                badge={badge}
                lock={a.lock}
                level={`+${a.level}`}
                size={iconSize}
              />
            </div>
          </ArtifactDataHoverCard>
        );
      })}
    </div>
  );
}
