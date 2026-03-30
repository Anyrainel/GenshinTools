import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { CharacterStats } from "@/lib/gameStatsLoader";
import { CHARACTER_LEVEL_TIERS } from "@/lib/gameStatsLoader";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team, WeaponChoiceCharConfig } from "@/stores/useTeamStore";
import { Minus, Plus, Settings2 } from "lucide-react";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

interface WeaponChoiceConfigCardProps {
  team: Team;
  configs: WeaponChoiceCharConfig[];
  onUpdateConfig: (
    charId: string,
    patch: Partial<WeaponChoiceCharConfig>
  ) => void;
  characterStats: Record<string, CharacterStats>;
  t: ReturnType<typeof useLanguage>["t"];
}

/** Compact ± integer control for constellation and talent levels. */
function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {label && (
        <span className="font-bold text-foreground/60 text-[10px] lg:text-xs mr-0.5 select-none">
          {label}
        </span>
      )}
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex items-center justify-center w-5 h-5 lg:w-6 lg:h-6 rounded bg-black/20 border border-border/30 text-foreground/70 hover:bg-black/30 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Minus className="w-3 h-3" />
      </button>
      <span className="font-bold text-xs lg:text-sm w-5 text-center select-none">
        {value}
      </span>
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex items-center justify-center w-5 h-5 lg:w-6 lg:h-6 rounded bg-black/20 border border-border/30 text-foreground/70 hover:bg-black/30 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

export function WeaponChoiceConfigCard({
  team,
  configs,
  onUpdateConfig,
  characterStats,
  t,
}: WeaponChoiceConfigCardProps) {
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const charIds = team.characters.filter((id): id is string => id != null);

  return (
    <Card className={CARD_CLS}>
      <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
        <h3 className={CARD_TITLE_CLS}>
          <Settings2 className="w-4 h-4 opacity-70" />
          <span>{t.ui("teamComp.weaponChoiceConfig")}</span>
        </h3>
      </CardHeader>
      <CardContent className={CARD_BODY_CLS}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 lg:gap-2">
          {charIds.map((charId, i) => {
            const char = charactersById[charId];
            if (!char) return null;

            const config = configs.find((c) => c.charId === charId);
            if (!config) return null;

            const weaponId = team.weapons[i];
            const weapon = weaponId ? weaponsById[weaponId] : null;

            return (
              <div
                key={charId}
                className="flex flex-col rounded-lg bg-black/10 border border-border/10 p-1 gap-1 xl:p-2"
              >
                {/* Character portrait + name */}
                <div className="flex items-center gap-1.5">
                  <img
                    src={getAssetUrl(char.imagePath)}
                    alt={charId}
                    className="w-10 h-10 lg:w-12 lg:h-12 rounded-full object-cover bg-secondary/40 border border-border/30 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-foreground/90 truncate block text-xs md:text-sm lg:text-sm xl:text-base">
                      {t.character(charId)}
                    </span>
                    {/* Default weapon (read-only) */}
                    {weapon && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <img
                          src={getAssetUrl(weapon.imagePath)}
                          alt={weaponId ?? ""}
                          className="w-4 h-4 lg:w-5 lg:h-5 object-contain rounded-sm bg-secondary/40"
                        />
                        <span className="text-[10px] lg:text-xs text-foreground/50 truncate">
                          {t.weapon(weaponId!)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Level override */}
                <div className="flex items-center gap-1 bg-black/10 rounded-md border border-border/30 px-1 py-0.5">
                  <span className="font-bold text-foreground/60 text-[10px] lg:text-xs shrink-0">
                    Lv.
                  </span>
                  <LightweightSelect
                    value={String(config.level)}
                    onValueChange={(v) =>
                      onUpdateConfig(charId, { level: Number(v) })
                    }
                  >
                    <LightweightSelectTrigger className="font-bold bg-black/20 border-border/30 w-full h-6 lg:h-7 text-xs lg:text-sm [&>span]:text-center [&>span]:w-full">
                      <LightweightSelectValue />
                    </LightweightSelectTrigger>
                    <LightweightSelectContent>
                      {CHARACTER_LEVEL_TIERS.map((tier) => (
                        <LightweightSelectItem key={tier} value={tier}>
                          Lv. {tier}
                        </LightweightSelectItem>
                      ))}
                    </LightweightSelectContent>
                  </LightweightSelect>
                </div>

                {/* Constellation override */}
                <div className="flex items-center justify-between bg-black/10 rounded-md border border-border/30 px-1 py-0.5">
                  <span className="font-bold text-foreground/60 text-[10px] lg:text-xs shrink-0">
                    {t.format(
                      "common.constellationFormat",
                      config.constellation
                    )}
                  </span>
                  <Stepper
                    value={config.constellation}
                    min={0}
                    max={6}
                    onChange={(v) =>
                      onUpdateConfig(charId, { constellation: v })
                    }
                  />
                </div>

                {/* Talent level overrides (NA/E/Q) */}
                <div className="flex flex-col gap-0.5 bg-black/10 rounded-md border border-border/30 px-1 py-0.5">
                  {(
                    [
                      [{ zh: "普攻", en: "NA" }, 0],
                      [{ zh: "战技", en: "E" }, 1],
                      [{ zh: "爆发", en: "Q" }, 2],
                    ] as [{ zh: string; en: string }, number][]
                  ).map(([label, idx]) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <span className="font-bold text-foreground/60 text-[10px] lg:text-xs shrink-0">
                        {t.resolveLabel(label)}
                      </span>
                      <Stepper
                        value={config.talentLevels[idx]}
                        min={1}
                        max={15}
                        onChange={(v) => {
                          const newLevels = [...config.talentLevels] as [
                            number,
                            number,
                            number,
                          ];
                          newLevels[idx] = v;
                          onUpdateConfig(charId, {
                            talentLevels: newLevels,
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Artifact set picker */}
                <div className="flex items-center gap-1 bg-black/10 rounded-md border border-border/30 px-1 py-0.5">
                  <ItemPicker
                    type="artifact"
                    value={config.artifactConfig}
                    triggerSize={isMobile ? "xs" : "sm"}
                    onChange={(newArtifact: ArtifactConfig) => {
                      onUpdateConfig(charId, {
                        artifactConfig: newArtifact,
                      });
                    }}
                  />
                  <span className="text-[10px] lg:text-xs text-foreground/50 truncate min-w-0">
                    {config.artifactConfig?.type === "4pc"
                      ? t.artifact(config.artifactConfig.setId)
                      : config.artifactConfig?.type === "2pc+2pc"
                        ? t.ui("buildCard.2pc+2pc")
                        : "--"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
