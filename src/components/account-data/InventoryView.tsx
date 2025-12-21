import { AccountData } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { weaponsById } from "@/data/constants";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { ArtifactSlot } from "./ArtifactSlot";

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
          {unequippedArtifacts.map((a) => (
            <div key={a.id} className="w-full">
              <ArtifactSlot artifact={a} slot={a.slotKey} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
