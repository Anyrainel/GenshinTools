import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AnalyzerCharConfig } from "@/domain/combat/analyzer/types";
import type { TeamSlotConfig } from "@/domain/combat/damage/types";
import { charactersById, weaponsById } from "@/domain/reference/catalog";
import {
  characterStatsResource,
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
  weaponStatsResource,
} from "@/domain/reference/stats";
import { useResource } from "@/hooks/useResource";
import { CARD_CLS, CARD_HEADER_CLS, CARD_TITLE_CLS } from "./cardStyles";

interface AnalyzerConfigCardProps {
  charConfigs: AnalyzerCharConfig[];
  configs: TeamSlotConfig[];
  onUpdateWeapon: (
    id: string,
    star: "4" | "5",
    weaponId: string | null
  ) => void;
  onUpdateMax: (
    id: string,
    field: "maxConstellation" | "maxRefinement",
    value: number
  ) => void;
  renderChanges: (id: string) => ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function AnalyzerConfigCard({
  charConfigs,
  configs,
  onUpdateWeapon,
  onUpdateMax,
  renderChanges,
  footer,
  children,
}: AnalyzerConfigCardProps) {
  const { t } = useLanguage();
  const characterStats = useResource(characterStatsResource);
  const weaponStats = useResource(weaponStatsResource);
  return (
    <Card className={CARD_CLS}>
      <CardHeader className={CARD_HEADER_CLS}>
        <h3 className={CARD_TITLE_CLS}>{t.ui("teamComp.investmentRange")}</h3>
      </CardHeader>
      <CardContent className="p-3 [container-type:inline-size] [container-name:investment-config]">
        <div className="grid grid-cols-1 gap-4 [@container_investment-config_(min-width:28rem)]:grid-cols-2 [@container_investment-config_(min-width:56rem)]:grid-cols-4">
          {charConfigs.map((config) => {
            const base = configs.find((c) => c.charId === config.charId)!;
            const baseFive = weaponsById[base.weaponId]?.rarity === 5;
            return (
              <section key={config.charId} className="min-w-0 space-y-3">
                <h4 className="break-words text-sm font-semibold">
                  {t.character(config.charId)}
                </h4>
                {(["4", "5"] as const)
                  .filter((star) => (star === "5") !== baseFive)
                  .map((star) => {
                    const value =
                      star === "5"
                        ? config.weapon5Star?.id
                        : config.weapon4Star?.id;
                    return (
                      <div key={star} className="space-y-1">
                        <span className="text-xs">
                          {star === "5"
                            ? t.ui("teamComp.investmentFiveWeapon")
                            : t.ui("teamComp.investmentLowWeapon")}
                        </span>
                        <ItemPicker
                          type="weapon"
                          value={value ?? null}
                          className="h-8 w-full min-w-0 justify-between rounded-md border border-border bg-background px-2 text-xs hover:bg-accent"
                          triggerLabel={
                            star === "5"
                              ? t.ui("teamComp.investmentFiveWeapon")
                              : t.ui("teamComp.investmentLowWeapon")
                          }
                          triggerContent={
                            <>
                              <span className="truncate">
                                {value
                                  ? t.weapon(value)
                                  : t.ui("teamComp.investmentChooseWeapon")}
                              </span>
                              <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
                            </>
                          }
                          onChange={(id) => {
                            onUpdateWeapon(config.charId, star, id);
                          }}
                          onClear={() => {
                            onUpdateWeapon(config.charId, star, null);
                          }}
                          filter={(weapon) =>
                            (star === "5"
                              ? weapon.rarity === 5
                              : weapon.rarity === 3 || weapon.rarity === 4) &&
                            (!characterStats ||
                              !weaponStats ||
                              getWeaponDisplayMeta(
                                weapon,
                                weaponStats[weapon.id]
                              ).type ===
                                getCharacterDisplayMeta(
                                  charactersById[config.charId],
                                  characterStats[config.charId]
                                ).weaponType)
                          }
                        />
                      </div>
                    );
                  })}
                <div className="grid grid-cols-2 gap-2">
                  {config.rarity === 5 && (
                    <div className="space-y-1">
                      <span className="text-xs">
                        {t.ui("teamComp.investmentMaxConstellation")}
                      </span>
                      <Select
                        value={String(config.maxConstellation)}
                        onValueChange={(v) =>
                          onUpdateMax(
                            config.charId,
                            "maxConstellation",
                            Number(v)
                          )
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-full text-xs"
                          aria-label={t.ui(
                            "teamComp.investmentMaxConstellation"
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 7 }, (_, c) => (
                            <SelectItem
                              key={c}
                              value={String(c)}
                              disabled={c < config.startConstellation}
                            >
                              {t.format("common.constellationFormat", c)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {config.weapon5Star && (
                    <div className="space-y-1">
                      <span className="text-xs">
                        {t.ui("teamComp.investmentMaxRefinement")}
                      </span>
                      <Select
                        value={String(config.maxRefinement)}
                        onValueChange={(v) =>
                          onUpdateMax(config.charId, "maxRefinement", Number(v))
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-full text-xs"
                          aria-label={t.ui("teamComp.investmentMaxRefinement")}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 5 }, (_, i) => i + 1).map(
                            (r) => (
                              <SelectItem
                                key={r}
                                value={String(r)}
                                disabled={r < config.startRefinement}
                              >
                                {t.format("common.refinementFormat", r)}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {renderChanges(config.charId)}
              </section>
            );
          })}
        </div>
        {footer && (
          <div className="mt-3 flex flex-wrap items-center gap-2">{footer}</div>
        )}
        <div className="mt-3 space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}
