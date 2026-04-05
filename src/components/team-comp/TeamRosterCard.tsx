import { ItemPicker } from "@/components/shared/ItemPicker";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { charInfo } from "@/data/charInfo";
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
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

interface TeamRosterCardProps {
  team: Team;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  accountData: AccountData | null;
  characterStats: Record<string, CharacterStats>;
  weaponStats: Record<string, WeaponStats>;
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
        className="flex items-center flex-wrap min-w-0 gap-0.5 p-0.5 md:gap-1 md:p-1 rounded-md bg-black/10 border border-border/30"
      >
        <img
          src={getAssetUrl(imagePath)}
          alt={entityId}
          className="w-5 h-5 xl:w-7 xl:h-7 object-contain rounded-full bg-secondary/40 shrink-0 border border-border/30"
        />
        <span className="font-bold text-foreground/80 text-xs md:text-sm lg:text-xs xl:text-sm min-w-0 truncate">
          {t.resolveLabel(schema.label)}
        </span>

        <div className="ml-auto shrink-0">
          {allDisabled ? (
            <span className="font-bold text-foreground/40 text-xs xl:text-sm">
              --
            </span>
          ) : (
            <LightweightSelect
              value={value}
              onValueChange={(v) => handleOptionChange(entityId, v)}
            >
              <LightweightSelectTrigger className="font-bold [&>span]:text-center [&>span]:w-full bg-white/5 border-border/30 w-24 md:w-32 lg:w-28 xl:w-36 h-6 xl:h-8 text-[10px] md:text-sm lg:text-[11px] xl:text-sm">
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
  // Note: This component only renders when gameStats are ready (gated by parent),
  // so TeamMeta always has valid element/region/faction data here.
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

  return (
    <Card className={CARD_CLS}>
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
                  className="flex flex-col items-center justify-center rounded-lg bg-black/10 border border-dashed border-border/30 p-1 gap-1 min-h-[80px] lg:p-2 lg:gap-2 lg:min-h-[100px]"
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

            // Talent levels: from override → account data → default 10
            const info = charInfo[charId];
            const talentAuto =
              team.opts?.[`${charId}.overrideTalentAuto`] !== undefined &&
              team.opts[`${charId}.overrideTalentAuto`] !== ""
                ? Number(team.opts[`${charId}.overrideTalentAuto`])
                : (acctChar?.talent?.auto ?? 10);
            const talentSkill =
              team.opts?.[`${charId}.overrideTalentSkill`] !== undefined &&
              team.opts[`${charId}.overrideTalentSkill`] !== ""
                ? Number(team.opts[`${charId}.overrideTalentSkill`])
                : (acctChar?.talent?.skill ?? 10);
            const talentBurst =
              team.opts?.[`${charId}.overrideTalentBurst`] !== undefined &&
              team.opts[`${charId}.overrideTalentBurst`] !== ""
                ? Number(team.opts[`${charId}.overrideTalentBurst`])
                : (acctChar?.talent?.burst ?? 10);

            // Determine which talents get +3 from constellations
            const c3Bonus = info && charConst >= 3 ? info.c3Talent : null;
            const c5Bonus = info && charConst >= 5 ? info.c5Talent : null;
            const autoHasBonus = c3Bonus === "A" || c5Bonus === "A";
            const skillHasBonus = c3Bonus === "E" || c5Bonus === "E";
            const burstHasBonus = c3Bonus === "Q" || c5Bonus === "Q";

            const isCharFrozen = frozenCharIds?.has(charId) ?? false;

            return (
              <div
                key={i}
                className={cn(
                  "flex flex-col rounded-lg bg-black/10 border border-border/10 p-1 gap-1 xl:p-2",
                  isCharFrozen &&
                    "frozen-card pointer-events-none ring-1 ring-cyan-400/20"
                )}
              >
                {/* Row 1: Interactive icons */}
                <div className="flex items-end gap-0.5 md:gap-1.5">
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
                      return (w: WeaponResource) => {
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

                {/* Row 2: Name */}
                <div className="flex items-center flex-wrap gap-1">
                  <span className="font-bold text-foreground/90 truncate min-w-0 text-xs md:text-base lg:text-sm xl:text-base">
                    {t.character(charId)}
                  </span>
                </div>

                {/* Rows 3-4: Level/Constellation/Refinement + Talent overrides */}
                <div className="flex flex-col bg-black/10 rounded-md border border-border/30 px-1 py-0.5 lg:px-2 lg:py-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="w-full shrink pr-0.5">
                      <Select
                        value={String(charLevel)}
                        onValueChange={(v) =>
                          handleOptionChange(`${charId}.overrideLevel`, v)
                        }
                      >
                        <SelectTrigger className="w-full bg-white/5 border-border/30 focus:ring-0 [&>span]:text-center [&>span]:w-full font-bold h-6 px-1 text-xs lg:h-7 lg:px-1.5 lg:text-sm">
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

                    <div className="w-full shrink px-0.5 border-l border-border/20">
                      <Select
                        value={String(charConst)}
                        onValueChange={(v) =>
                          handleOptionChange(
                            `${charId}.overrideConstellation`,
                            v
                          )
                        }
                      >
                        <SelectTrigger className="w-full bg-white/5 border-border/30 focus:ring-0 [&>span]:text-center [&>span]:w-full font-bold h-6 px-1 text-xs lg:h-7 lg:px-1.5 lg:text-sm">
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
                      <div className="w-full shrink pl-0.5 border-l border-border/20">
                        <Select
                          value={String(weaponRefine)}
                          onValueChange={(v) =>
                            handleOptionChange(
                              `${charId}.overrideRefinement`,
                              v
                            )
                          }
                        >
                          <SelectTrigger className="w-full bg-white/5 border-border/30 focus:ring-0 [&>span]:text-center [&>span]:w-full font-bold h-6 px-1 text-xs lg:h-7 lg:px-1.5 lg:text-sm">
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

                  <div className="flex items-center justify-between gap-1 border-t border-border/20 pt-0.5 md:pt-1">
                    {(
                      [
                        [
                          { zh: "普攻", en: "Attack" },
                          talentAuto,
                          autoHasBonus,
                          `${charId}.overrideTalentAuto`,
                        ],
                        [
                          { zh: "战技", en: "Skill" },
                          talentSkill,
                          skillHasBonus,
                          `${charId}.overrideTalentSkill`,
                        ],
                        [
                          { zh: "爆发", en: "Burst" },
                          talentBurst,
                          burstHasBonus,
                          `${charId}.overrideTalentBurst`,
                        ],
                      ] as [
                        { zh: string; en: string },
                        number,
                        boolean,
                        string,
                      ][]
                    ).map(([label, value, hasBonus, optKey], idx) => (
                      <div
                        key={optKey}
                        className={cn(
                          "w-full shrink",
                          idx === 0
                            ? "pr-0.5"
                            : idx === 1
                              ? "px-0.5 border-l border-border/20"
                              : "pl-0.5 border-l border-border/20"
                        )}
                      >
                        <Select
                          value={String(value)}
                          onValueChange={(v) => handleOptionChange(optKey, v)}
                        >
                          <SelectTrigger className="w-full bg-white/5 border-border/30 focus:ring-0 [&>span]:text-center [&>span]:w-full font-bold h-6 px-1 text-xs lg:h-7 lg:px-1.5 lg:text-sm">
                            <SelectValue>
                              {t.resolveLabel(label)}:{" "}
                              {value + (hasBonus ? 3 : 0)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, k) => k + 1).map(
                              (lv) => (
                                <SelectItem key={lv} value={String(lv)}>
                                  {t.resolveLabel(label)}: {lv}
                                  {hasBonus ? "+3" : ""}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-character combat options */}
                {(charHasOption || weaponHasOption || artifactHasOption) && (
                  <div className="w-full space-y-1">
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
                      className="flex items-center gap-1 mt-auto pt-1 cursor-pointer select-none ml-1 xl:ml-2"
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
                      <span className="font-medium text-foreground/50 text-[10px] md:text-xs lg:text-[11px] xl:text-xs">
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
