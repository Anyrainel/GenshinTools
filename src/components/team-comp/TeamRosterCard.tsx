import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import type { AccountData, CharacterData, WeaponResource } from "@/data/types";
import type { CharacterStats, WeaponStats } from "@/lib/gameStatsLoader";
import {
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
} from "@/lib/gameStatsLoader";
import { getEntityOption } from "@/lib/team-comp/damageModels";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { Users } from "lucide-react";

const CARD_CLS = "bg-gradient-card border-border/50 overflow-hidden shadow-lg";
const CARD_HEADER_CLS =
  "bg-gradient-select border-b border-border/40 py-3 px-2 md:px-5";
const CARD_TITLE_CLS =
  "text-base font-bold flex items-center gap-2 tracking-tight text-primary-foreground/90";
const CARD_BODY_CLS = "p-1.5 md:p-3 bg-black/10";

interface TeamRosterCardProps {
  team: Team;
  effectiveTeam: Team;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  localCharacters: (string | null)[];
  localWeapons: (string | null)[];
  localArtifacts: (ArtifactConfig | null)[];
  setLocalCharacters: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  setLocalWeapons: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  setLocalArtifacts: React.Dispatch<
    React.SetStateAction<(ArtifactConfig | null)[]>
  >;
  accountData: AccountData | null;
  characterStats: Record<string, CharacterStats> | null;
  weaponStats: Record<string, WeaponStats> | null;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
}

export function TeamRosterCard({
  team,
  effectiveTeam,
  updateTeam,
  localCharacters,
  localWeapons,
  localArtifacts,
  setLocalCharacters,
  setLocalWeapons,
  setLocalArtifacts,
  accountData,
  characterStats,
  weaponStats,
  isMobile,
  t,
}: TeamRosterCardProps) {
  const handleOptionChange = (entityId: string, val: string) => {
    updateTeam(team.id, { opts: { ...(team.opts || {}), [entityId]: val } });
  };

  /** Render a single combat option dropdown. */
  const renderOption = (entityId: string, isWeapon: boolean) => {
    const schema = getEntityOption(entityId);
    if (!schema) return null;

    const value = team.opts?.[entityId] || schema.default;
    const resource = isWeapon
      ? weaponsById[entityId]
      : charactersById[entityId];
    if (!resource) return null;

    return (
      <div
        key={entityId}
        className={cn(
          "flex items-center w-full rounded-md bg-black/10 border border-border/30",
          isMobile ? "gap-1.5 px-1.5 py-1.5" : "gap-2.5 px-2.5 py-2"
        )}
      >
        <div
          className={cn(
            "rounded-full bg-secondary/40 overflow-hidden shrink-0 border border-border/30",
            isMobile ? "w-5 h-5" : "w-7 h-7"
          )}
        >
          <img
            src={getAssetUrl(resource.imagePath)}
            alt={entityId}
            className="w-full h-full object-contain"
          />
        </div>
        <span
          className={cn(
            "font-bold text-foreground/80 min-w-0 truncate",
            isMobile ? "text-xs flex-1" : "text-sm shrink-0 max-w-[120px]"
          )}
        >
          {t.resolveLabel(schema.label)}
        </span>

        <div className={cn(isMobile ? "shrink-0" : "ml-auto shrink-0")}>
          <Select
            value={value}
            onValueChange={(v) => handleOptionChange(entityId, v)}
          >
            <SelectTrigger
              className={cn(
                "font-bold [&>span]:text-center [&>span]:w-full bg-black/20 border-border/30",
                isMobile ? "w-[100px] h-7 text-xs" : "w-[150px] h-8 text-sm"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schema.choices.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {t.resolveLabel(c.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  return (
    <Card className={CARD_CLS}>
      <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
        <h3 className={CARD_TITLE_CLS}>
          <Users className="w-4 h-4 opacity-70" />
          <span>{t.ui("teamComp.teamRoster")}</span>
        </h3>
      </CardHeader>
      <CardContent className={CARD_BODY_CLS}>
        <div
          className={cn(
            "grid",
            isMobile
              ? "grid-cols-2 gap-1.5"
              : "grid-cols-2 lg:grid-cols-4 gap-3"
          )}
        >
          {effectiveTeam.characters.map((charId, i) => {
            if (!charId)
              return (
                <div
                  key={i}
                  className="flex items-center justify-center opacity-20 py-4"
                >
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-border/50" />
                </div>
              );

            const char = charactersById[charId];
            const weaponId = localWeapons[i];
            const weapon = weaponId ? weaponsById[weaponId] : null;
            const charHasOption = getEntityOption(charId) != null;
            const weaponHasOption =
              weaponId != null && getEntityOption(weaponId) != null;

            const acctChar = accountData?.characters.find(
              (c: CharacterData) => c.key === charId
            );
            const charLevel =
              team.opts?.[`${charId}.overrideLevel`] !== undefined
                ? Number(team.opts[`${charId}.overrideLevel`])
                : acctChar
                  ? acctChar.level > 90
                    ? 100
                    : 90
                  : 90;
            const charConst =
              team.opts?.[`${charId}.overrideConstellation`] !== undefined
                ? Number(team.opts[`${charId}.overrideConstellation`])
                : (acctChar?.constellation ?? 0);

            let defaultRefine = 1;
            if (weaponId && accountData) {
              const refinements: number[] = [];
              for (const c of accountData.characters) {
                if (c.weapon?.key === weaponId)
                  refinements.push(c.weapon.refinement);
              }
              for (const w of accountData.extraWeapons) {
                if (w.key === weaponId) refinements.push(w.refinement);
              }
              if (refinements.length > 0)
                defaultRefine = Math.max(...refinements);
            }
            const weaponRefine =
              team.opts?.[`${charId}.overrideRefinement`] !== undefined
                ? Number(team.opts[`${charId}.overrideRefinement`])
                : defaultRefine;

            return (
              <div
                key={i}
                className={cn(
                  "flex flex-col rounded-lg bg-black/10 border border-border/10",
                  isMobile ? "p-1 gap-1" : "p-2 gap-2"
                )}
              >
                {/* Row 1: Interactive icons */}
                <div
                  className={cn(
                    "flex items-end",
                    isMobile ? "gap-0.5" : "gap-1.5"
                  )}
                >
                  <ItemPicker
                    type="character"
                    value={charId}
                    triggerSize={isMobile ? "sm" : "xl"}
                    onChange={(newCharId) => {
                      setLocalCharacters((prev) => {
                        const next = [...prev];
                        next[i] = newCharId;
                        return next;
                      });
                      // Clear weapon if incompatible type
                      if (localWeapons[i]) {
                        const newChar = charactersById[newCharId];
                        const curWeapon = weaponsById[localWeapons[i]!];
                        if (newChar && curWeapon) {
                          const newMeta = getCharacterDisplayMeta(
                            newChar,
                            characterStats?.[newCharId]
                          );
                          const wMeta = getWeaponDisplayMeta(
                            curWeapon,
                            weaponStats?.[localWeapons[i]!]
                          );
                          if (
                            newMeta.weaponType &&
                            wMeta.type &&
                            newMeta.weaponType !== wMeta.type
                          ) {
                            setLocalWeapons((prev) => {
                              const next = [...prev];
                              next[i] = null;
                              return next;
                            });
                          }
                        }
                      }
                    }}
                  />
                  <ItemPicker
                    type="weapon"
                    value={localWeapons[i]}
                    triggerSize={isMobile ? "xs" : "lg"}
                    disabled={!charId}
                    filter={(() => {
                      if (!char) return undefined;
                      const meta = getCharacterDisplayMeta(
                        char,
                        characterStats?.[charId]
                      );
                      if (!meta.weaponType) return undefined;
                      const wType = meta.weaponType;
                      return (item: unknown) => {
                        const w = item as WeaponResource;
                        const wMeta = getWeaponDisplayMeta(
                          w,
                          weaponStats?.[w.id]
                        );
                        return wMeta.type === wType;
                      };
                    })()}
                    onChange={(newWeaponId) => {
                      setLocalWeapons((prev) => {
                        const next = [...prev];
                        next[i] = newWeaponId;
                        return next;
                      });
                    }}
                  />
                  <ItemPicker
                    type="artifact"
                    value={localArtifacts[i]}
                    triggerSize={isMobile ? "xs" : "lg"}
                    disabled={!charId}
                    onChange={(newArtifact) => {
                      setLocalArtifacts((prev) => {
                        const next = [...prev];
                        next[i] = newArtifact;
                        return next;
                      });
                    }}
                  />
                </div>

                {/* Row 2: Name + Min. ER */}
                <div
                  className={cn(
                    "flex items-center justify-between",
                    isMobile ? "gap-1" : "gap-4"
                  )}
                >
                  <span
                    className={cn(
                      "font-bold text-foreground/90",
                      isMobile ? "text-xs ml-0.5 truncate" : "text-lg ml-2"
                    )}
                  >
                    {t.character(charId)}
                  </span>
                  <div
                    className={cn(
                      "flex items-center bg-secondary/60 rounded-md border border-border/30 shrink-0",
                      isMobile ? "gap-0.5 px-1 py-0.5" : "gap-1.5 px-2.5 py-1.5"
                    )}
                  >
                    <span
                      className={cn(
                        "font-bold text-foreground/70",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      {t.ui("teamComp.minEr")}
                    </span>
                    <Input
                      type="number"
                      min={100}
                      max={400}
                      step={5}
                      value={Math.round((team.targetEr[charId] ?? 1.0) * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        if (!Number.isNaN(val)) {
                          updateTeam(team.id, {
                            targetEr: {
                              ...team.targetEr,
                              [charId]: val,
                            },
                          });
                        }
                      }}
                      className={cn(
                        "text-center font-bold bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                        isMobile ? "w-9 h-5 text-xs" : "w-12 h-6 text-sm"
                      )}
                    />
                    <span
                      className={cn(
                        "font-bold text-muted-foreground",
                        isMobile ? "text-[10px] mr-0.5" : "text-xs mr-2"
                      )}
                    >
                      %
                    </span>
                  </div>
                </div>

                {/* Row 3: Overrides */}
                <div
                  className={cn(
                    "flex items-start justify-between bg-black/10 rounded-md border border-border/30",
                    isMobile ? "gap-1 px-1 py-1" : "gap-1.5 px-1.5 py-1.5"
                  )}
                >
                  <div className="flex flex-col gap-1 w-full shrink pr-0.5">
                    <span
                      className={cn(
                        "font-bold text-muted-foreground/70 line-clamp-1 break-all",
                        isMobile ? "text-[10px] px-0.5" : "text-xs px-1"
                      )}
                      title={t.ui("teamComp.overrideLevel")}
                    >
                      {t.ui("teamComp.overrideLevel")}
                    </span>
                    <Select
                      value={String(charLevel)}
                      onValueChange={(v) =>
                        handleOptionChange(`${charId}.overrideLevel`, v)
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full bg-black/20 border-border/30 focus:ring-0 [&>span]:text-center [&>span]:w-full font-bold",
                          isMobile ? "h-6 px-1 text-xs" : "h-7 px-1.5 text-sm"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90">Lv. 90</SelectItem>
                        <SelectItem value="100">Lv. 100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1 w-full shrink px-0.5 border-l border-border/20">
                    <span
                      className={cn(
                        "font-bold text-muted-foreground/70 line-clamp-1 break-all",
                        isMobile ? "text-[10px] px-0.5" : "text-xs px-1"
                      )}
                      title={t.ui("teamComp.overrideConst")}
                    >
                      {t.ui("teamComp.overrideConst")}
                    </span>
                    <Select
                      value={String(charConst)}
                      onValueChange={(v) =>
                        handleOptionChange(`${charId}.overrideConstellation`, v)
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full bg-black/20 border-border/30 focus:ring-0 [&>span]:text-center [&>span]:w-full font-bold",
                          isMobile ? "h-6 px-1 text-xs" : "h-7 px-1.5 text-sm"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                          <SelectItem key={c} value={String(c)}>
                            {t.format("teamComp.constellationFormat", c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {weaponId && (
                    <div className="flex flex-col gap-1 w-full shrink pl-0.5 border-l border-border/20">
                      <span
                        className={cn(
                          "font-bold text-muted-foreground/70 line-clamp-1 break-all",
                          isMobile ? "text-[10px] px-0.5" : "text-xs px-1"
                        )}
                        title={t.ui("teamComp.overrideRefine")}
                      >
                        {t.ui("teamComp.overrideRefine")}
                      </span>
                      <Select
                        value={String(weaponRefine)}
                        onValueChange={(v) =>
                          handleOptionChange(`${charId}.overrideRefinement`, v)
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "w-full bg-black/20 border-border/30 focus:ring-0 [&>span]:text-center [&>span]:w-full font-bold",
                            isMobile ? "h-6 px-1 text-xs" : "h-7 px-1.5 text-sm"
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((r) => (
                            <SelectItem key={r} value={String(r)}>
                              {t.format("teamComp.refinementFormat", r)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Per-character combat options */}
                {(charHasOption || weaponHasOption) && (
                  <div className="w-full space-y-1.5 pt-1">
                    {charHasOption && renderOption(charId, false)}
                    {weaponHasOption &&
                      weaponId &&
                      renderOption(weaponId, true)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
