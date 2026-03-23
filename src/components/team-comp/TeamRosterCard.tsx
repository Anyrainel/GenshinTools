import { ItemPicker } from "@/components/shared/ItemPicker";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById, charactersById, weaponsById } from "@/data/constants";
import type { AccountData, CharacterData, WeaponResource } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { CharacterStats, WeaponStats } from "@/lib/gameStatsLoader";
import {
  CHARACTER_LEVEL_TIERS,
  getCharacterDisplayMeta,
  getCharacterLevelTier,
  getWeaponDisplayMeta,
} from "@/lib/gameStatsLoader";
import {
  TeamMeta,
  getDefaultOptionValue,
  getEntityOption,
  isChoiceEnabled,
} from "@/lib/team-comp/damageModels";
import { detectEquippedSets } from "@/lib/team-comp/teamOptUtils";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { Users } from "lucide-react";
import { useEffect, useMemo } from "react";

const CARD_CLS = "bg-gradient-card border-border/50 overflow-hidden shadow-lg";
const CARD_HEADER_CLS =
  "bg-gradient-select border-b border-border/40 py-3 px-2 md:px-5";
const CARD_TITLE_CLS =
  "text-base font-bold flex items-center gap-2 tracking-tight text-primary-foreground/90";
const CARD_BODY_CLS = "p-1.5 md:p-3 bg-black/10";

interface TeamRosterCardProps {
  team: Team;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  accountData: AccountData | null;
  characterStats: Record<string, CharacterStats> | null;
  weaponStats: Record<string, WeaponStats> | null;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  frozenCharIds?: Set<string>;
  ignoreArtifactSets?: Record<string, boolean>;
  onIgnoreArtifactSetsChange?: (v: Record<string, boolean>) => void;
}

export function TeamRosterCard({
  team,
  updateTeam,
  accountData,
  characterStats,
  weaponStats,
  isMobile,
  t,
  frozenCharIds,
  ignoreArtifactSets,
  onIgnoreArtifactSetsChange,
}: TeamRosterCardProps) {
  // 3-tier icon sizing: narrow (<560px) → mid (560-1023px) → desktop (≥1024px)
  const isNarrow = useMediaQuery("(max-width: 559px)");
  const charIconSize = isNarrow ? "sm" : isMobile ? "md" : "xl";
  const subIconSize = isNarrow ? "xs" : isMobile ? "sm" : "lg";

  const handleOptionChange = (entityId: string, val: string) => {
    updateTeam(team.id, { opts: { ...(team.opts || {}), [entityId]: val } });
  };

  /** Render a single combat option dropdown. */
  const renderOption = (
    entityId: string,
    type: "character" | "weapon" | "artifact"
  ) => {
    const schema = getEntityOption(entityId);
    if (!schema) return null;

    const enabledChoices = schema.choices.filter((c) =>
      isChoiceEnabled(c, teamMeta)
    );
    // If selected value is disabled, fall back to first enabled choice
    const raw =
      team.opts?.[entityId] || getDefaultOptionValue(schema, teamMeta);
    const allDisabled = enabledChoices.length === 0;
    const value = allDisabled
      ? ""
      : enabledChoices.some((c) => c.value === raw)
        ? raw
        : enabledChoices[0].value;
    const imagePath =
      type === "weapon"
        ? weaponsById[entityId]?.imagePath
        : type === "artifact"
          ? artifactsById[entityId]?.imagePaths?.flower
          : charactersById[entityId]?.imagePath;
    if (!imagePath) return null;

    return (
      <div
        key={entityId}
        className="flex items-center flex-wrap min-w-0 gap-1 p-1 lg:gap-2 lg:p-2 rounded-md bg-black/10 border border-border/30"
      >
        <img
          src={getAssetUrl(imagePath)}
          alt={entityId}
          className="w-5 h-5 lg:w-7 lg:h-7 object-contain rounded-full bg-secondary/40 shrink-0 border border-border/30"
        />
        <span className="font-bold text-foreground/80 text-xs lg:text-sm min-w-0 truncate">
          {t.resolveLabel(schema.label)}
        </span>

        <div className="ml-auto shrink-0">
          {allDisabled ? (
            <span className="font-bold text-foreground/40 text-xs lg:text-sm">
              --
            </span>
          ) : (
            <LightweightSelect
              value={value}
              onValueChange={(v) => handleOptionChange(entityId, v)}
            >
              <LightweightSelectTrigger className="font-bold [&>span]:text-center [&>span]:w-full bg-black/20 border-border/30 w-[90px] lg:w-[150px] h-6 lg:h-8 text-[10px] lg:text-sm">
                <LightweightSelectValue />
              </LightweightSelectTrigger>
              <LightweightSelectContent>
                {schema.choices.map((c) => {
                  const disabled = !isChoiceEnabled(c, teamMeta);
                  return (
                    <LightweightSelectItem
                      key={c.value}
                      value={c.value}
                      disabled={disabled}
                    >
                      {t.resolveLabel(c.label)}
                    </LightweightSelectItem>
                  );
                })}
              </LightweightSelectContent>
            </LightweightSelect>
          )}
        </div>
      </div>
    );
  };

  // Build TeamMeta once for option context (cheap — just lookups)
  const charIds = team.characters.filter((id): id is string => id != null);
  const constellations: Record<string, number> = {};
  for (const cid of charIds) {
    const acct = accountData?.characters.find(
      (c: CharacterData) => c.key === cid
    );
    constellations[cid] =
      team.opts?.[`${cid}.overrideConstellation`] !== undefined
        ? Number(team.opts[`${cid}.overrideConstellation`])
        : (acct?.constellation ?? 0);
  }
  const artSets: Record<string, string> = {};
  for (let i = 0; i < team.characters.length; i++) {
    const cid = team.characters[i];
    const art = team.artifacts[i];
    if (cid && art?.type === "4pc") artSets[cid] = art.setId;
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable serialized deps
  const teamMeta = useMemo(
    () => new TeamMeta(charIds, constellations, artSets, team.enemyAura),
    [
      charIds.join(),
      JSON.stringify(constellations),
      JSON.stringify(artSets),
      team.enemyAura,
    ]
  );

  // Sync effective option values back to team.opts so the calculation library
  // always receives the same value that the UI dropdown displays.
  useEffect(() => {
    const entityIds: string[] = [...charIds];
    for (let i = 0; i < team.characters.length; i++) {
      const wid = team.weapons[i];
      if (wid && getEntityOption(wid)) entityIds.push(wid);
      const art = team.artifacts[i];
      const artSetId = art?.type === "4pc" ? art.setId : null;
      if (artSetId && getEntityOption(artSetId)) entityIds.push(artSetId);
    }

    const updates: Record<string, string> = {};
    for (const eid of entityIds) {
      const schema = getEntityOption(eid);
      if (!schema) continue;
      const enabledChoices = schema.choices.filter((c) =>
        isChoiceEnabled(c, teamMeta)
      );
      if (enabledChoices.length === 0) continue;
      const raw = team.opts?.[eid] || getDefaultOptionValue(schema, teamMeta);
      const effective = enabledChoices.some((c) => c.value === raw)
        ? raw
        : enabledChoices[0].value;
      if (effective !== (team.opts?.[eid] ?? "")) {
        updates[eid] = effective;
      }
    }
    if (Object.keys(updates).length > 0) {
      updateTeam(team.id, { opts: { ...(team.opts || {}), ...updates } });
    }
  }, [
    team.id,
    team.characters,
    team.weapons,
    team.artifacts,
    team.opts,
    teamMeta,
    updateTeam,
    charIds,
  ]);

  const hasFrozenChars = frozenCharIds != null && frozenCharIds.size > 0;

  return (
    <Card className={cn(CARD_CLS, hasFrozenChars && "ring-1 ring-cyan-400/20")}>
      <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
        <h3 className={CARD_TITLE_CLS}>
          <span
            data-tour-step-id="tod-roster"
            className="inline-flex items-center gap-2"
          >
            <Users className="w-4 h-4 opacity-70" />
            <span>{t.ui("teamComp.teamRoster")}</span>
          </span>
        </h3>
      </CardHeader>
      <CardContent className={CARD_BODY_CLS}>
        <div
          className={cn("grid", "grid-cols-2 lg:grid-cols-4 gap-1 lg:gap-2")}
        >
          {team.characters.map((charId, i) => {
            if (!charId) {
              // Only the first empty slot (right after the last filled slot) is interactive
              const isNextEmpty = !team.characters.some(
                (c, j) => j < i && c == null
              );
              if (!isNextEmpty) {
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center opacity-20 py-4"
                  >
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-border/50" />
                  </div>
                );
              }
              // Render an interactive add-member slot
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg bg-black/10 border border-dashed border-border/30",
                    isMobile
                      ? "p-1 gap-1 min-h-[80px]"
                      : "p-2 gap-2 min-h-[100px]"
                  )}
                >
                  <ItemPicker
                    type="character"
                    value={null}
                    triggerSize={charIconSize}
                    filter={(item) => {
                      const c = item as { id: string };
                      return !team.characters.some(
                        (otherId, j) => j !== i && otherId === c.id
                      );
                    }}
                    onChange={(newCharId) => {
                      const newChars = [...team.characters];
                      newChars[i] = newCharId;
                      const newWeapons = [...team.weapons];
                      const newArts = [...team.artifacts];

                      // Prefill weapon and artifact from account data
                      const acctChar = accountData?.characters.find(
                        (c: CharacterData) => c.key === newCharId
                      );
                      if (acctChar) {
                        if (
                          acctChar.weapon?.key &&
                          weaponsById[acctChar.weapon.key]
                        ) {
                          newWeapons[i] = acctChar.weapon.key;
                        }
                        const equipped = Object.values(
                          acctChar.artifacts || {}
                        );
                        if (equipped.length > 0) {
                          const detected = detectEquippedSets(equipped);
                          if (detected.artifactSetId) {
                            newArts[i] = {
                              type: "4pc",
                              setId: detected.artifactSetId,
                            };
                          } else if (detected.artifactHalfSetIds.length === 2) {
                            newArts[i] = {
                              type: "2pc+2pc",
                              id1: detected.artifactHalfSetIds[0],
                              id2: detected.artifactHalfSetIds[1],
                            };
                          }
                        }
                      }
                      updateTeam(team.id, {
                        characters: newChars,
                        weapons: newWeapons,
                        artifacts: newArts,
                      });
                    }}
                  />
                </div>
              );
            }

            const char = charactersById[charId];
            const weaponId = team.weapons[i];
            const weapon = weaponId ? weaponsById[weaponId] : null;
            const charHasOption = getEntityOption(charId) != null;
            const weaponHasOption =
              weaponId != null && getEntityOption(weaponId) != null;
            const artConfig = team.artifacts[i];
            const artSetId = artConfig?.type === "4pc" ? artConfig.setId : null;
            const artifactHasOption =
              artSetId != null && getEntityOption(artSetId) != null;

            const acctChar = accountData?.characters.find(
              (c: CharacterData) => c.key === charId
            );
            const charLevel =
              team.opts?.[`${charId}.overrideLevel`] !== undefined
                ? Number(team.opts[`${charId}.overrideLevel`])
                : acctChar
                  ? Number(getCharacterLevelTier(acctChar.level))
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

            const isCharFrozen = frozenCharIds?.has(charId) ?? false;

            return (
              <div
                key={i}
                className={cn(
                  "flex flex-col rounded-lg bg-black/10 border border-border/10",
                  isMobile ? "p-1 gap-1" : "p-2 gap-2",
                  isCharFrozen &&
                    "frozen-card pointer-events-none ring-1 ring-cyan-400/20"
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
                    triggerSize={charIconSize}
                    filter={(item) => {
                      const c = item as { id: string };
                      return !team.characters.some(
                        (otherId, j) => j !== i && otherId === c.id
                      );
                    }}
                    onChange={(newCharId) => {
                      const newChars = [...team.characters];
                      newChars[i] = newCharId;
                      const newWeapons = [...team.weapons];
                      const newArts = [...team.artifacts];
                      const newChar = charactersById[newCharId];

                      // Prefill weapon and artifact from account data
                      const acctChar = accountData?.characters.find(
                        (c: CharacterData) => c.key === newCharId
                      );
                      if (acctChar) {
                        // Always prefill weapon from equipped data
                        if (
                          acctChar.weapon?.key &&
                          weaponsById[acctChar.weapon.key]
                        ) {
                          newWeapons[i] = acctChar.weapon.key;
                        }
                        const equipped = Object.values(
                          acctChar.artifacts || {}
                        );
                        if (equipped.length > 0) {
                          const detected = detectEquippedSets(equipped);
                          if (detected.artifactSetId) {
                            newArts[i] = {
                              type: "4pc",
                              setId: detected.artifactSetId,
                            };
                          } else if (detected.artifactHalfSetIds.length === 2) {
                            newArts[i] = {
                              type: "2pc+2pc",
                              id1: detected.artifactHalfSetIds[0],
                              id2: detected.artifactHalfSetIds[1],
                            };
                          }
                        }
                      } else {
                        // No account data — clear incompatible weapon
                        const weaponId = newWeapons[i];
                        if (weaponId && newChar) {
                          const curWeapon = weaponsById[weaponId];
                          if (curWeapon) {
                            const cMeta = getCharacterDisplayMeta(
                              newChar,
                              characterStats?.[newCharId]
                            );
                            const wMeta = getWeaponDisplayMeta(
                              curWeapon,
                              weaponStats?.[weaponId]
                            );
                            if (
                              cMeta.weaponType &&
                              wMeta.type &&
                              cMeta.weaponType !== wMeta.type
                            ) {
                              newWeapons[i] = null;
                            }
                          }
                        }
                      }
                      updateTeam(team.id, {
                        characters: newChars,
                        weapons: newWeapons,
                        artifacts: newArts,
                      });
                    }}
                    onClear={
                      // Only allow removing the last filled character (prefix ordering)
                      !team.characters.some((c, j) => j > i && c != null)
                        ? () => {
                            const newChars = [...team.characters];
                            newChars[i] = null;
                            const newWeapons = [...team.weapons];
                            newWeapons[i] = null;
                            const newArts = [...team.artifacts];
                            newArts[i] = null;
                            updateTeam(team.id, {
                              characters: newChars,
                              weapons: newWeapons,
                              artifacts: newArts,
                            });
                          }
                        : undefined
                    }
                  />
                  <ItemPicker
                    type="weapon"
                    value={team.weapons[i]}
                    triggerSize={subIconSize}
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
                      const newWeapons = [...team.weapons];
                      newWeapons[i] = newWeaponId;
                      updateTeam(team.id, { weapons: newWeapons });
                    }}
                  />
                  <ItemPicker
                    type="artifact"
                    value={team.artifacts[i]}
                    triggerSize={subIconSize}
                    disabled={!charId}
                    onChange={(newArtifact) => {
                      const newArts = [...team.artifacts];
                      newArts[i] = newArtifact;
                      updateTeam(team.id, { artifacts: newArts });
                    }}
                  />
                </div>

                {/* Row 2: Name + Min. CR / Min. ER */}
                <div
                  className={cn(
                    "flex items-center flex-wrap",
                    isMobile ? "gap-1" : "gap-1"
                  )}
                >
                  <span
                    className={cn(
                      "font-bold text-foreground/90",
                      isMobile ? "text-xs ml-0.5 truncate" : "text-base ml-1"
                    )}
                  >
                    {t.character(charId)}
                  </span>
                  <div className="flex-1" />
                  <div
                    className={cn(
                      "flex items-center bg-secondary/60 rounded-md border border-border/30",
                      isMobile ? "gap-0.5 px-1 py-0.5" : "gap-0.5 px-1.5 py-1.5"
                    )}
                  >
                    <span
                      className={cn(
                        "font-bold text-foreground/70",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      {t.ui("teamComp.minCr")}
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="--"
                      value={
                        team.minCr?.[charId] != null
                          ? String(Math.round(team.minCr[charId] * 100))
                          : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") {
                          const next = { ...(team.minCr ?? {}) };
                          delete next[charId];
                          updateTeam(team.id, { minCr: next });
                          return;
                        }
                        const val = Number(raw) / 100;
                        if (!Number.isNaN(val)) {
                          updateTeam(team.id, {
                            minCr: {
                              ...(team.minCr ?? {}),
                              [charId]: Math.max(0, Math.min(1, val)),
                            },
                          });
                        }
                      }}
                      className={cn(
                        "text-center font-bold bg-black/20 rounded border border-border/20 p-0 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                        isMobile ? "w-9 h-5 text-xs" : "w-12 h-6 text-sm"
                      )}
                    />
                    <span
                      className={cn(
                        "font-bold text-muted-foreground",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      %
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex items-center bg-secondary/60 rounded-md border border-border/30",
                      isMobile ? "gap-0.5 px-1 py-0.5" : "gap-0.5 px-1.5 py-1.5"
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
                      value={Math.round((team.minEr[charId] ?? 1.0) * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        if (!Number.isNaN(val)) {
                          updateTeam(team.id, {
                            minEr: {
                              ...team.minEr,
                              [charId]: val,
                            },
                          });
                        }
                      }}
                      className={cn(
                        "text-center font-bold bg-black/20 rounded border border-border/20 p-0 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                        isMobile ? "w-9 h-5 text-xs" : "w-12 h-6 text-sm"
                      )}
                    />
                    <span
                      className={cn(
                        "font-bold text-muted-foreground",
                        isMobile ? "text-[10px]" : "text-xs"
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
                        "font-bold text-muted-foreground line-clamp-1 break-all",
                        isMobile ? "text-[10px] px-0.5" : "text-xs px-1"
                      )}
                      title={t.ui("common.level")}
                    >
                      {t.ui("common.level")}
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
                        {CHARACTER_LEVEL_TIERS.map((tier) => (
                          <SelectItem key={tier} value={tier}>
                            Lv. {tier}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1 w-full shrink px-0.5 border-l border-border/20">
                    <span
                      className={cn(
                        "font-bold text-muted-foreground line-clamp-1 break-all",
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
                            {t.format("common.constellationFormat", c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {weaponId && (
                    <div className="flex flex-col gap-1 w-full shrink pl-0.5 border-l border-border/20">
                      <span
                        className={cn(
                          "font-bold text-muted-foreground line-clamp-1 break-all",
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
                              {t.format("common.refinementFormat", r)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Per-character combat options */}
                {(charHasOption || weaponHasOption || artifactHasOption) && (
                  <div className="w-full space-y-1.5 pt-1">
                    {charHasOption && renderOption(charId, "character")}
                    {weaponHasOption &&
                      weaponId &&
                      renderOption(weaponId, "weapon")}
                    {artifactHasOption &&
                      artSetId &&
                      renderOption(artSetId, "artifact")}
                  </div>
                )}

                {/* Ignore artifact sets checkbox */}
                {(() => {
                  const hasSet =
                    artConfig?.type === "4pc" || artConfig?.type === "2pc+2pc";
                  const erPct = Math.round((team.minEr?.[charId] ?? 1.0) * 100);
                  const crPct = Math.round((team.minCr?.[charId] ?? 0) * 100);
                  const hasFavonius =
                    team.weapons[i]?.startsWith("favonius_") ?? false;
                  const showCheckbox =
                    hasSet &&
                    onIgnoreArtifactSetsChange &&
                    (erPct > 160 || (hasFavonius && crPct > 40));
                  if (!showCheckbox) return null;
                  const cbId = `ignore-sets-${charId}`;
                  return (
                    <label
                      htmlFor={cbId}
                      className="flex items-center gap-1.5 pt-0.5 cursor-pointer select-none"
                    >
                      <Checkbox
                        id={cbId}
                        checked={ignoreArtifactSets?.[charId] ?? false}
                        onCheckedChange={(v) =>
                          onIgnoreArtifactSetsChange({
                            ...ignoreArtifactSets,
                            [charId]: v === true,
                          })
                        }
                        className="h-3.5 w-3.5"
                      />
                      <span
                        className={cn(
                          "font-medium text-foreground/50",
                          isMobile ? "text-[10px]" : "text-xs"
                        )}
                      >
                        {t.ui("teamComp.ignoreSets")}
                      </span>
                    </label>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
