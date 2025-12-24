import { AccountData } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { weaponsById, artifactsById } from "@/data/constants";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { StatDisplay } from "./StatDisplay";
import { cn, getAssetUrl } from "@/lib/utils";
import { THEME } from "@/lib/theme";

interface InventoryViewProps {
  data: AccountData;
}

export const InventoryView = ({ data }: InventoryViewProps) => {
  const { t } = useLanguage();
  const unequippedWeapons = (data.extraWeapons || []).slice().sort((a, b) => {
    const infoA = weaponsById[a.key];
    const infoB = weaponsById[b.key];
    // Sort by rarity desc, then key
    if (infoA && infoB && infoA.rarity !== infoB.rarity) {
      return infoB.rarity - infoA.rarity;
    }
    return a.key.localeCompare(b.key);
  });
  const unequippedArtifacts = data.extraArtifacts || [];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {t.ui("accountData.unequippedWeapons")} ({unequippedWeapons.length})
        </h3>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16 gap-2">
          {unequippedWeapons.map((w) => {
            const weaponInfo = weaponsById[w.key];
            const name = t.weaponName(w.key);
            return (
              <Tooltip key={w.id}>
                <TooltipTrigger asChild>
                  <Card className="overflow-hidden hover:border-primary/50 transition-colors cursor-help">
                    <ItemIcon
                      imagePath={weaponInfo?.imagePath || ""}
                      rarity={weaponInfo?.rarity || 1}
                      label={`R${w.refinement}`}
                      size="full"
                      className="aspect-square"
                      alt={name}
                    />
                    <div className="p-1 text-[10px] truncate text-center font-medium bg-card/80">
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
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">
          {t.ui("accountData.unequippedArtifacts")} (
          {unequippedArtifacts.length})
        </h3>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16 gap-2">
          {unequippedArtifacts.map((a) => {
            const artInfo = artifactsById[a.setKey];
            const name = t.artifact(a.setKey);

            return (
              <div key={a.id} className="w-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "aspect-square relative rounded border bg-card/50 overflow-hidden group cursor-help",
                        THEME.rarity.border[
                          a.rarity as keyof typeof THEME.rarity.border
                        ],
                      )}
                    >
                      {artInfo && (
                        <img
                          src={getAssetUrl(artInfo.imagePath)}
                          alt={name}
                          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                      <div className="absolute bottom-0 right-0 bg-black/60 px-1 text-[10px] text-white font-mono">
                        +{a.level}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="p-0 border-none bg-transparent"
                  >
                    <div className="w-48 bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-2 text-slate-100 shadow-xl">
                      <div className="border-b border-slate-700 pb-2">
                        <div
                          className={cn(
                            "font-bold text-sm",
                            THEME.rarity.text[
                              a.rarity as keyof typeof THEME.rarity.text
                            ],
                          )}
                        >
                          {name}
                        </div>
                        <div className="text-xs text-slate-400 capitalize">
                          {t.ui(`computeFilters.${a.slotKey}`)}
                        </div>
                      </div>
                      <StatDisplay artifact={a} />
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
