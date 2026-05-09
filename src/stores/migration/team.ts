import type { ReactionType } from "@/data/enums";
import type {
  ComboFormula,
  ComboLine,
  ReactionOverride,
} from "@/lib/dmgcalc/types";
import {
  compactTeamSetupConfigs,
  dedupeTeamCompDeltasAgainstPreset,
  deriveTeamCompsFromDeltas,
  type TeamCompDelta,
} from "@/lib/team-comp/teamDeltas";
import { getCachedTeamPreset } from "@/lib/team-comp/teamPresetRegistry";
import type {
  AnalyzerConfig,
  TeamComp,
  TeamSetupConfig,
} from "@/lib/team-comp/types";
import {
  createTeamPersistenceFromLegacyTeams,
  type LegacyCharSettings,
  type LegacyPersistedTeam,
} from "@/stores/migration/teamLegacy";
import { PersistedTeamStoreSchema } from "@/stores/schemas";

type TeamMigrationState = {
  teams?: LegacyPersistedTeam[];
  teamComps?: TeamComp[];
  activePresetId?: string | null;
  compDeltas?: TeamCompDelta[];
  configsByTeamId?: Record<string, TeamSetupConfig>;
  updatedAt?: number;
} & Record<string, unknown>;
type TeamResultCacheField =
  | "optimizationResult"
  | "choiceResults"
  | "weaponChoiceResult";

export function stripTeamResultCaches<T extends object>(
  team: T
): Omit<T, TeamResultCacheField> {
  const {
    optimizationResult: _optimizationResult,
    choiceResults: _choiceResults,
    weaponChoiceResult: _weaponChoiceResult,
    ...sourceTeam
  } = team as T & Partial<Record<TeamResultCacheField, unknown>>;
  return sourceTeam as Omit<T, TeamResultCacheField>;
}

export function stripTeamStoreResultCaches<
  TState extends { teams?: LegacyPersistedTeam[] },
>(state: TState): TState {
  return {
    ...state,
    teams: (state.teams ?? []).map((team) =>
      stripTeamResultCaches(team)
    ) as unknown as LegacyPersistedTeam[],
  };
}

/**
 * Migrate persisted TeamState from an older version to the current format.
 * Exported for testability — called by zustand persist's `migrate` option.
 */
export function migrateTeamStore(
  persistedState: unknown,
  version: number
): TeamMigrationState {
  const state = persistedState as TeamMigrationState;
  if (!Array.isArray(state.teams)) state.teams = [];
  if (version < 1) {
    state.teams = (state.teams ?? []).map((t) => ({
      ...t,
      reactions: (t as LegacyPersistedTeam).reactions || [],
    }));
  }
  if (version < 2) {
    // biome-ignore lint/suspicious/noExplicitAny: migration from legacy format (reactionOverrides removed in v9)
    state.teams = (state.teams ?? []).map((t: any) => ({
      ...t,
      reactionOverrides: t.reactionOverrides ?? {},
      combos: t.combos ?? [],
      selectedCombo: t.selectedCombo ?? null,
    }));
  }
  if (version < 3) {
    state.teams = state.teams.map((t) => ({
      ...t,
      formulaMode: (t as LegacyPersistedTeam).formulaMode ?? "single",
    }));
  }
  if (version < 4) {
    // Rename targetEr/targetCr → minEr/minCr
    // biome-ignore lint/suspicious/noExplicitAny: migration from legacy field names
    state.teams = state.teams.map((t: any) => {
      const { targetEr, targetCr, ...rest } = t;
      return {
        ...rest,
        minEr: t.minEr ?? targetEr ?? {},
        minCr: t.minCr ?? targetCr ?? {},
      };
    });
  }
  if (version < 5) {
    // Add extraBuffs field
    state.teams = state.teams.map((t) => ({
      ...t,
      extraBuffs: (t as LegacyPersistedTeam).extraBuffs ?? [],
    }));
  }
  if (version < 6) {
    // Rename investmentConfigs → analyzerConfigs
    // biome-ignore lint/suspicious/noExplicitAny: migration from legacy field name
    state.teams = state.teams.map((t: any) => {
      const { investmentConfigs, ...rest } = t;
      return {
        ...rest,
        analyzerConfigs: t.analyzerConfigs ?? investmentConfigs,
      };
    });
  }
  if (version < 7) {
    // Batch renames: calcContext.idealSubstatBudget → substatBudget, enemyElementAura → enemyAura
    // biome-ignore lint/suspicious/noExplicitAny: migration from legacy field names
    state.teams = state.teams.map((t: any) => {
      let team = t;
      // calcContext.idealSubstatBudget → substatBudget
      if (team.calcContext?.idealSubstatBudget) {
        const { idealSubstatBudget, ...restCtx } = team.calcContext;
        team = {
          ...team,
          calcContext: { ...restCtx, substatBudget: idealSubstatBudget },
        };
      }
      // enemyElementAura → enemyAura
      if (team.enemyElementAura) {
        const { enemyElementAura, ...rest } = team;
        team = { ...rest, enemyAura: enemyElementAura };
      }
      return team;
    });
  }
  if (version < 8) {
    // analyzerConfigs: store only the alt weapon (not from roster)
    // biome-ignore lint/suspicious/noExplicitAny: migration from legacy AnalyzerCharConfig
    state.teams = state.teams.map((t: any) => {
      if (!t.analyzerConfigs?.length) return t;
      // biome-ignore lint/suspicious/noExplicitAny: migration
      const configs = t.analyzerConfigs.map((cfg: any) => {
        const charIdx = t.characters?.indexOf(cfg.charId) ?? -1;
        const rosterWeaponId = charIdx >= 0 ? t.weapons?.[charIdx] : null;
        // The alt weapon is whichever stored weapon doesn't match the roster
        let altWeapon: { id: string; refinement?: number } | undefined;
        if (cfg.weapon5Star?.id && cfg.weapon5Star.id !== rosterWeaponId) {
          altWeapon = { id: cfg.weapon5Star.id };
        } else if (
          cfg.weapon4Star?.id &&
          cfg.weapon4Star.id !== rosterWeaponId
        ) {
          altWeapon = {
            id: cfg.weapon4Star.id,
            refinement: cfg.weapon4Star.refinement,
          };
        }
        return {
          charId: cfg.charId,
          altWeapon,
          startConstellation: cfg.startConstellation ?? 0,
          startRefinement: cfg.startRefinement ?? 0,
          maxConstellation: cfg.maxConstellation ?? 6,
          maxRefinement: cfg.maxRefinement ?? 5,
        };
      });
      return { ...t, analyzerConfigs: configs };
    });
  }
  if (version < 9) {
    // Merge reactionOverrides into combo lines, set formulaMode to "combo"
    // biome-ignore lint/suspicious/noExplicitAny: migration from legacy format
    state.teams = state.teams.map((t: any) => {
      const overrides: Record<string, ReactionOverride> =
        t.reactionOverrides ?? {};
      const combos: ComboFormula[] = (t.combos ?? []).map(
        (combo: ComboFormula) => ({
          ...combo,
          lines: combo.lines.map((line: ComboLine) => {
            const key = `${line.charId}.${line.formulaId}`;
            const singleOverride = overrides[key];
            if (!singleOverride) return line;

            // Merge single-mode per-part config into the line's reaction.
            // Old data used partReactions/partHits; normalize to rxnParts/rxnPartHits.
            interface LegacyReactionOverride {
              reaction?: unknown;
              rxnParts?: Record<string, string>;
              partReactions?: Record<string, string>;
              rxnPartHits?: Record<string, number>;
              partHits?: Record<string, number>;
            }
            const so = singleOverride as LegacyReactionOverride;
            const normalized: ReactionOverride = {
              reaction: so.reaction as ReactionOverride["reaction"],
              rxnParts: (so.rxnParts ?? so.partReactions) as
                | Record<number, ReactionType>
                | undefined,
              rxnPartHits: so.rxnPartHits ?? so.partHits,
            };
            let merged = line.reaction;
            if (normalized && merged) {
              merged = {
                ...merged,
                rxnParts: {
                  ...normalized.rxnParts,
                  ...merged.rxnParts,
                },
                rxnPartHits: {
                  ...normalized.rxnPartHits,
                  ...merged.rxnPartHits,
                },
              };
              // Clean up empty objects
              if (merged.rxnParts && Object.keys(merged.rxnParts).length === 0)
                merged.rxnParts = undefined;
              if (
                merged.rxnPartHits &&
                Object.keys(merged.rxnPartHits).length === 0
              )
                merged.rxnPartHits = undefined;
            } else if (normalized && !merged) {
              merged = normalized;
            }
            return { ...line, reaction: merged };
          }),
        })
      );
      const { reactionOverrides: _, ...rest } = t;
      return { ...rest, combos, formulaMode: "combo" };
    });
  }
  if (version < 10) {
    // v10: Add optional analyzerComboOverrides and analyzerMinErOverrides fields.
    // Flat sparse records: key = "charId|constellation|lineKey" (combo) or "charId|constellation" (minEr).
    // No transformation needed — fields are optional and default to undefined.
  }
  if (version < 11) {
    // v11: activeTeamId was moved to sessionStorage. Remove from persisted state.
    delete (state as TeamMigrationState & { activeTeamId?: unknown })
      .activeTeamId;
  }
  if (version < 12) {
    // v12: Add optional analyzerReactionOverrides, analyzerEnemyAura, analyzerExtraBuffs fields.
    // No transformation needed — fields are optional and default to undefined.
  }
  if (version < 13) {
    // v13: CalcContext required, combo flatten, charSettings merge, analyzer grouping.
    // biome-ignore lint/suspicious/noExplicitAny: migration from legacy flat fields — old schema has combos[], selectedCombo, flat minEr/minCr/crMode/tierAwarePool/ignoreArtifactSets, and flat analyzerConfigs/analyzerComboOverrides/analyzerMinErOverrides/analyzerReactionOverrides/analyzerEnemyAura/analyzerExtraBuffs
    state.teams = state.teams.map((t: any) => {
      // ── CalcContext: drop deprecated critRateTarget, keep rest (all fields now optional) ──
      const { critRateTarget: _, ...calcContext } = t.calcContext ?? {};

      // ── Combo flatten: combos[] + selectedCombo → combo ──
      const combos: ComboFormula[] = t.combos ?? [];
      const selectedCombo: string | null = t.selectedCombo ?? null;
      const combo =
        combos.find((c: ComboFormula) => c.id === selectedCombo) ??
        combos[0] ??
        null;

      // ── CharSettings merge: 5 parallel Records → charSettings ──
      const minEr: Record<string, number> = t.minEr ?? {};
      const minCr: Record<string, number> = t.minCr ?? {};
      const crMode: Record<string, string> = t.crMode ?? {};
      const tierAwarePool: Record<string, boolean> = t.tierAwarePool ?? {};
      const ignoreArtifactSets: Record<string, boolean> =
        t.ignoreArtifactSets ?? {};
      const allCharIds = new Set([
        ...Object.keys(minEr),
        ...Object.keys(minCr),
        ...Object.keys(crMode),
        ...Object.keys(tierAwarePool),
        ...Object.keys(ignoreArtifactSets),
      ]);
      let charSettings: Record<string, LegacyCharSettings> | undefined;
      if (allCharIds.size > 0) {
        charSettings = {};
        for (const charId of allCharIds) {
          const s: LegacyCharSettings = {};
          if (charId in minEr) s.minEr = minEr[charId];
          if (charId in minCr) s.minCr = minCr[charId];
          if (charId in crMode) s.crMode = crMode[charId] as "min" | "target";
          if (charId in tierAwarePool) s.tierAwarePool = tierAwarePool[charId];
          if (charId in ignoreArtifactSets)
            s.ignoreArtifactSets = ignoreArtifactSets[charId];
          charSettings[charId] = s;
        }
      }

      // ── Analyzer grouping: 6 flat fields → analyzer sub-object ──
      const hasAnalyzer =
        t.analyzerConfigs ||
        t.analyzerComboOverrides ||
        t.analyzerMinErOverrides ||
        t.analyzerReactionOverrides ||
        t.analyzerEnemyAura ||
        t.analyzerExtraBuffs;
      const analyzer: AnalyzerConfig | undefined = hasAnalyzer
        ? {
            ...(t.analyzerConfigs ? { configs: t.analyzerConfigs } : {}),
            ...(t.analyzerComboOverrides
              ? { comboOverrides: t.analyzerComboOverrides }
              : {}),
            ...(t.analyzerMinErOverrides
              ? { minErOverrides: t.analyzerMinErOverrides }
              : {}),
            ...(t.analyzerReactionOverrides
              ? { reactionOverrides: t.analyzerReactionOverrides }
              : {}),
            ...(t.analyzerEnemyAura ? { enemyAura: t.analyzerEnemyAura } : {}),
            ...(t.analyzerExtraBuffs
              ? { extraBuffs: t.analyzerExtraBuffs }
              : {}),
          }
        : undefined;

      // ── Rebuild team, dropping old flat fields ──
      const {
        combos: _combos,
        selectedCombo: _selectedCombo,
        minEr: _minEr,
        minCr: _minCr,
        crMode: _crMode,
        tierAwarePool: _tierAwarePool,
        ignoreArtifactSets: _ignoreArtifactSets,
        analyzerConfigs: _ac,
        analyzerComboOverrides: _aco,
        analyzerMinErOverrides: _amo,
        analyzerReactionOverrides: _aro,
        analyzerEnemyAura: _aea,
        analyzerExtraBuffs: _aeb,
        calcContext: _oldCtx,
        ...rest
      } = t;
      return {
        ...rest,
        calcContext,
        combo,
        ...(charSettings ? { charSettings } : {}),
        ...(analyzer ? { analyzer } : {}),
      };
    });
  }
  if (version < 14) {
    // v14 bundles three independent schema changes landing in the same push:
    //   (a) ArtifactConfig 2pc+2pc shape:    { id1, id2 } → { halfSetIds: [id1, id2] }
    //   (b) ER calculator v2 ERTimeline:     { actions, ticks } + periodicE actions
    //                                      → { actions, periodic: PeriodicProc[] }
    //       and PeriodicProc { sourceChar, trigger: "E"|"Q", targetIndex }
    //   (c) TimelineAction.energyGrants widened from `Record<string, number>`
    //       to `Record<string, { flat?, percent? }>`. Legacy number values were
    //       always flat grants → mapped to { flat: N }. Defensive: strips any
    //       stray `.orb` field from intermediate dev builds (orb drops moved to
    //       a dedicated `enemyOrb` action type).

    // biome-ignore lint/suspicious/noExplicitAny: migration reads legacy persisted shapes from several prior versions
    state.teams = state.teams.map((t: any) => {
      // (a) Artifact 2pc+2pc
      // biome-ignore lint/suspicious/noExplicitAny: migration reads legacy persisted shape with { id1, id2 } fields
      const artifacts = (t.artifacts ?? []).map((a: any) => {
        if (!a) return null;
        if (a.type === "4pc") return a;
        if (a.type === "2pc+2pc") {
          return {
            type: "2pc+2pc" as const,
            halfSetIds: [
              String(a.id1 ?? a.halfSetIds?.[0] ?? ""),
              String(a.id2 ?? a.halfSetIds?.[1] ?? ""),
            ] as [string, string],
          };
        }
        if ("setId" in a) return { type: "4pc" as const, setId: a.setId };
        if ("id1" in a)
          return {
            type: "2pc+2pc" as const,
            halfSetIds: [String(a.id1), String(a.id2)] as [string, string],
          };
        return null;
      });

      // (b) ER calc v2: ticks → periodic, drop periodicE actions
      let erTimelines = t.erTimelines;
      if (Array.isArray(erTimelines)) {
        // biome-ignore lint/suspicious/noExplicitAny: legacy timeline shape
        erTimelines = erTimelines.map((ert: any) => {
          if (!ert) return { actions: [], periodic: [] };
          const legacyActions = Array.isArray(ert.actions) ? ert.actions : [];
          const legacyTicks = Array.isArray(ert.ticks) ? ert.ticks : [];
          const legacyPeriodic = Array.isArray(ert.periodic)
            ? ert.periodic
            : null;

          // Already v2 shape: just strip any stray periodicE actions.
          if (legacyPeriodic) {
            return {
              actions: legacyActions.filter(
                // biome-ignore lint/suspicious/noExplicitAny: legacy action shape
                (a: any) => a?.action !== "periodicE"
              ),
              periodic: legacyPeriodic,
            };
          }

          // Convert periodicE actions → periodic procs attached to the next real action.
          const realActions: { char: string; action: string }[] = [];
          const periodicFromActions: {
            sourceChar: string;
            trigger: "E";
            targetIndex: number;
          }[] = [];
          const pending: string[] = [];
          // biome-ignore lint/suspicious/noExplicitAny: legacy action shape
          for (const a of legacyActions as any[]) {
            if (!a) continue;
            if (a.action === "periodicE") {
              pending.push(a.char);
            } else {
              const idx = realActions.length;
              for (const src of pending)
                periodicFromActions.push({
                  sourceChar: src,
                  trigger: "E",
                  targetIndex: idx,
                });
              pending.length = 0;
              realActions.push(a);
            }
          }
          if (pending.length && realActions.length > 0) {
            const last = realActions.length - 1;
            for (const src of pending)
              periodicFromActions.push({
                sourceChar: src,
                trigger: "E",
                targetIndex: last,
              });
          }

          // Rename ticks → periodic (legacy ticks already reference real-action indices)
          const fromTicks = legacyTicks
            // biome-ignore lint/suspicious/noExplicitAny: legacy tick shape
            .filter((tk: any) => tk?.sourceChar != null)
            // biome-ignore lint/suspicious/noExplicitAny: legacy tick shape
            .map((tk: any) => ({
              sourceChar: tk.sourceChar,
              trigger: "E" as const,
              targetIndex: tk.targetIndex ?? 0,
            }));

          return {
            actions: realActions,
            periodic: [...periodicFromActions, ...fromTicks],
          };
        });
      }

      // (c) Widen energyGrants on every action of every timeline.
      if (Array.isArray(erTimelines)) {
        // biome-ignore lint/suspicious/noExplicitAny: legacy timeline shape
        erTimelines = erTimelines.map((tl: any) => {
          if (!tl) return tl;
          // biome-ignore lint/suspicious/noExplicitAny: legacy action shape
          const actions = (tl.actions ?? []).map((a: any) => {
            if (!a || a.action !== "grantEnergy" || !a.energyGrants) return a;
            const widened: Record<string, { flat?: number; percent?: number }> =
              {};
            for (const [cid, val] of Object.entries(a.energyGrants)) {
              if (typeof val === "number") {
                if (val > 0) widened[cid] = { flat: val };
              } else if (val && typeof val === "object") {
                const v = val as {
                  flat?: number;
                  percent?: number;
                  orb?: number;
                };
                const next: { flat?: number; percent?: number } = {};
                if (v.flat) next.flat = v.flat;
                if (v.percent) next.percent = v.percent;
                if (next.flat || next.percent) widened[cid] = next;
              }
            }
            return { ...a, energyGrants: widened };
          });
          return { ...tl, actions };
        });
      }

      return { ...t, artifacts, erTimelines };
    });
  }
  if (version < 16) {
    // v16: result caches are local/runtime data. Persist only authored team
    // source/config so cloud backup and localStorage do not carry stale blobs.
    Object.assign(state, stripTeamStoreResultCaches(state));
  }
  Object.assign(state, stripTeamStoreResultCaches(state));

  if (version < 17 || !Array.isArray(state.compDeltas)) {
    // Before v17, the team store persisted each team as one flat object:
    // composition (name/characters/weapons/artifacts/reactions), combat opts,
    // damage formula state, ER timelines, optimizer settings, and analyzer
    // settings all lived together under `teams`.
    //
    // v17 splits that into:
    // - compDeltas: PresetDelta<TeamComp>[] for preset-eligible composition
    //   and global order only.
    // - configsByTeamId: user-authored per-team config keyed by team ID.
    const converted = createTeamPersistenceFromLegacyTeams(state.teams ?? []);
    state.activePresetId = null;
    state.compDeltas = converted.compDeltas;
    state.configsByTeamId = converted.configsByTeamId;
    state.teamComps = deriveTeamCompsFromDeltas(state.compDeltas, null);
  }

  if (version < 18 || !Number.isFinite(state.updatedAt)) {
    state.updatedAt = Date.now();
  }
  state.configsByTeamId = compactTeamSetupConfigs(state.configsByTeamId ?? {});

  delete state.teams;
  return state;
}

/**
 * Merge persisted state with current defaults on EVERY rehydration.
 * Ensures all teams have required fields that may be missing from
 * persisted data stored before the field was added.
 * Exported for testability — called by zustand persist's `merge` option.
 */
export function mergeTeamStore<
  TState extends {
    teamComps: TeamComp[];
    teamCompById: Record<string, TeamComp>;
    author: string;
    description: string;
    updatedAt: number;
    activePresetId: string | null;
    compDeltas: TeamCompDelta[];
    configsByTeamId: Record<string, TeamSetupConfig>;
  },
>(persistedState: unknown, currentState: TState): TState {
  const parsed = PersistedTeamStoreSchema.safeParse(persistedState);
  if (!parsed.success) return currentState;
  const compDeltas = parsed.data.compDeltas as TeamCompDelta[];
  const configsByTeamId = parsed.data.configsByTeamId as Record<
    string,
    TeamSetupConfig
  >;
  const activePresetId = parsed.data.activePresetId;
  const preset = getCachedTeamPreset(activePresetId);
  const deduped = dedupeTeamCompDeltasAgainstPreset(compDeltas, preset);
  const nextConfigsByTeamId = compactTeamSetupConfigs(configsByTeamId);
  for (const [fromId, toId] of Object.entries(deduped.idMap)) {
    if (fromId === toId) continue;
    const config = nextConfigsByTeamId[fromId];
    if (!config) continue;
    nextConfigsByTeamId[toId] = config;
    delete nextConfigsByTeamId[fromId];
  }
  const teamComps = deriveTeamCompsFromDeltas(deduped.deltas, preset);
  return {
    ...currentState,
    activePresetId,
    author: parsed.data.author ?? currentState.author,
    description: parsed.data.description ?? currentState.description,
    updatedAt: parsed.data.updatedAt ?? currentState.updatedAt,
    compDeltas: deduped.deltas,
    configsByTeamId: nextConfigsByTeamId,
    teamComps,
    teamCompById: Object.fromEntries(teamComps.map((team) => [team.id, team])),
  } as TState;
}
