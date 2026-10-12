import { ItemIcon } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/gameResources";
import {
  characterStatsResource,
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";
import type { AnalyzerCharConfig } from "@/lib/team-comp/analyzer/types";
import { CARD_CLS, CARD_HEADER_CLS, CARD_TITLE_CLS } from "./cardStyles";
import { TeamCharacterGrid } from "./TeamCharacterGrid";

interface AnalyzerConfigCardProps {
  charConfigs: AnalyzerCharConfig[];
  configs: TeamSlotConfig[];
  onUpdateWeapon: (
    charId: string,
    star: "4" | "5",
    weaponId: string | null
  ) => void;
  onUpdateMax: (
    charId: string,
    field: "maxConstellation" | "maxRefinement",
    value: number
  ) => void;
}

export function AnalyzerConfigCard({
  charConfigs,
  configs,
  onUpdateWeapon,
  onUpdateMax,
}: AnalyzerConfigCardProps) {
  const { t } = useLanguage();
  const characterStats = characterStatsResource.use();
  const weaponStats = weaponStatsResource.use();
  return (
    <Card className={CARD_CLS}>
      <CardHeader className={CARD_HEADER_CLS}>
        <h3 className={CARD_TITLE_CLS}>{t.ui("teamComp.investmentRange")}</h3>
      </CardHeader>
      <CardContent className="space-y-3 p-3">
        <p className="text-sm text-muted-foreground">
          {t.ui("teamComp.investmentRangeDesc")}
        </p>
        <TeamCharacterGrid>
          {charConfigs.map((config) => (
            <div
              key={config.charId}
              className="min-w-0 space-y-3 rounded-lg border border-border p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <ItemIcon characterId={config.charId} size="sm" />
                <span className="break-words font-semibold">
                  {t.character(config.charId)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {(["4", "5"] as const).map((star) => (
                  <div key={star} className="space-y-1 text-sm">
                    <p>{star === "4" ? "3/4★" : "5★"}</p>
                    {(weaponsById[
                      configs.find((base) => base.charId === config.charId)!
                        .weaponId
                    ]?.rarity ===
                      5) ===
                    (star === "5") ? (
                      <ItemIcon
                        weaponId={
                          configs.find((base) => base.charId === config.charId)!
                            .weaponId
                        }
                        size="sm"
                      />
                    ) : (
                      <ItemPicker
                        type="weapon"
                        value={
                          star === "4"
                            ? (config.weapon4Star?.id ?? null)
                            : (config.weapon5Star?.id ?? null)
                        }
                        onChange={(id) =>
                          onUpdateWeapon(config.charId, star, id as string)
                        }
                        onClear={() =>
                          onUpdateWeapon(config.charId, star, null)
                        }
                        filter={(weapon) =>
                          (star === "5"
                            ? weapon.rarity === 5
                            : weapon.rarity === 3 || weapon.rarity === 4) &&
                          (!weaponStats ||
                            !characterStats ||
                            getWeaponDisplayMeta(weapon, weaponStats[weapon.id])
                              .type ===
                              getCharacterDisplayMeta(
                                charactersById[config.charId],
                                characterStats[config.charId]
                              ).weaponType)
                        }
                        triggerSize="sm"
                        menuSize="sm"
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t.ui("teamComp.analyzerMinConfig")}:{" "}
                {t.format(
                  "common.constellationFormat",
                  config.startConstellation
                )}{" "}
                /{" "}
                {config.startRefinement > 0
                  ? t.format("common.refinementFormat", config.startRefinement)
                  : "3/4★"}
              </p>
              <div className="flex flex-wrap gap-2">
                {config.rarity === 5 && (
                  <label
                    htmlFor={`investment-max-c-${config.charId}`}
                    className="min-w-0 flex-1 text-sm"
                  >
                    {t.ui("teamComp.analyzerMaxConfig")}{" "}
                    {t.format(
                      "common.constellationFormat",
                      config.maxConstellation
                    )}
                    <Input
                      id={`investment-max-c-${config.charId}`}
                      type="number"
                      min={config.startConstellation}
                      max={6}
                      value={config.maxConstellation}
                      onChange={(event) =>
                        onUpdateMax(
                          config.charId,
                          "maxConstellation",
                          Math.max(
                            config.startConstellation,
                            Math.min(6, Number(event.target.value))
                          )
                        )
                      }
                    />
                  </label>
                )}
                {config.weapon5Star && (
                  <label
                    htmlFor={`investment-max-r-${config.charId}`}
                    className="min-w-0 flex-1 text-sm"
                  >
                    {t.ui("teamComp.analyzerMaxConfig")}{" "}
                    {t.format("common.refinementFormat", config.maxRefinement)}
                    <Input
                      id={`investment-max-r-${config.charId}`}
                      type="number"
                      min={config.startRefinement}
                      max={5}
                      value={config.maxRefinement}
                      onChange={(event) =>
                        onUpdateMax(
                          config.charId,
                          "maxRefinement",
                          Math.max(
                            config.startRefinement,
                            Math.min(5, Number(event.target.value))
                          )
                        )
                      }
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </TeamCharacterGrid>
      </CardContent>
    </Card>
  );
}
