import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import type {
  ArtifactData,
  Element,
  MainStat,
  ReactionType,
  SubStat,
} from "@/data/types";
import type {
  ComboCountOverrides,
  MinErOverrides,
  StoredAnalyzerCharConfig,
} from "@/lib/team-comp/analyzer";
import type { OptionMap } from "@/lib/team-comp/damageModels";
import type { ExtraBuff } from "@/lib/team-comp/extraBuffTypes";
import type {
  CalcContext,
  ComboFormula,
  ComboLine,
  DamageResult,
  ReactionOverride,
} from "@/lib/team-comp/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { charSortKey, encodeTeamId } from "./teamCompCodec";

/**
 * Migrate persisted TeamState from an older version to the current format.
 * Exported for testability — called by zustand persist's `migrate` option.
 */
export function migrateTeamStore(
  persistedState: unknown,
  version: number
): TeamState {
  const state = persistedState as TeamState;
  if (version < 1) {
    state.teams = state.teams.map((t) => ({
      ...t,
      reactions: (t as Team).reactions || [],
    }));
  }
  if (version < 2) {
    // biome-ignore lint/suspicious/noExplicitAny: migration from legacy format (reactionOverrides removed in v9)
    state.teams = state.teams.map((t: any) => ({
      ...t,
      reactionOverrides: t.reactionOverrides ?? {},
      combos: t.combos ?? [],
      selectedCombo: t.selectedCombo ?? null,
    }));
  }
  if (version < 3) {
    state.teams = state.teams.map((t) => ({
      ...t,
      formulaMode: (t as Team).formulaMode ?? "single",
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
      extraBuffs: (t as Team).extraBuffs ?? [],
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

            // Merge single-mode per-part config into the line's reaction
            let merged = line.reaction;
            if (singleOverride && merged) {
              merged = {
                ...merged,
                partReactions: {
                  ...singleOverride.partReactions,
                  ...merged.partReactions,
                },
                partHits: {
                  ...singleOverride.partHits,
                  ...merged.partHits,
                },
              };
              // Clean up empty objects
              if (
                merged.partReactions &&
                Object.keys(merged.partReactions).length === 0
              )
                merged.partReactions = undefined;
              if (merged.partHits && Object.keys(merged.partHits).length === 0)
                merged.partHits = undefined;
            } else if (singleOverride && !merged) {
              merged = singleOverride;
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
    // v11: activeTeamId removed from persisted team store (now in sessionStorage).
    // biome-ignore lint/suspicious/noExplicitAny: migration from legacy field
    (state as any).activeTeamId = undefined;
  }
  if (version < 12) {
    // v12: Add optional analyzerReactionOverrides, analyzerEnemyAura, analyzerExtraBuffs fields.
    // No transformation needed — fields are optional and default to undefined.
  }
  return state;
}

/**
 * Merge persisted state with current defaults on EVERY rehydration.
 * Ensures all teams have required fields that may be missing from
 * persisted data stored before the field was added.
 * Exported for testability — called by zustand persist's `merge` option.
 */
export function mergeTeamStore(
  persistedState: unknown,
  currentState: TeamState
): TeamState {
  const merged = {
    ...currentState,
    ...(persistedState as object),
  } as TeamState;
  if (Array.isArray(merged.teams)) {
    merged.teams = merged.teams.map((t) => ({
      ...DEFAULT_TEAM_FIELDS,
      ...t,
    }));
  }
  return merged;
}

export interface OptimizationResult {
  artifacts: Record<string, ArtifactData>;
  damage: DamageResult;
  erTargets: Record<string, number>;
}

export interface WeaponRanking {
  weaponId: string;
  refinement: number;
  damage: number;
  percentOfBest: number; // 0-100
  /** Main stat choices for sands/goblet/circlet. */
  mainStats?: { sands: MainStat; goblet: MainStat; circlet: MainStat };
  /** Aggregated substat roll counts across all 5 artifact slots (number of rolls, not values). */
  substatRolls?: Partial<Record<SubStat, number>>;
  /** Artifact set IDs used (first set from flower). */
  artifactSetIds?: string[];
}

export interface WeaponChoiceResult {
  timestamp: number;
  perCharacter: Record<string, WeaponRanking[]>;
}

export interface WeaponChoiceCharConfig {
  charId: string;
  level: number; // default 90
  constellation: number; // 0-6
  talentLevels: [number, number, number]; // NA, E, Q
  artifactConfig: ArtifactConfig | null; // 4pc or 2pc+2pc
  minEr: number; // internal format, e.g. 1.6 = 160%
  minCr: number; // internal format
}

/** Default values for team fields that may be missing from persisted data. */
const DEFAULT_TEAM_FIELDS = {
  reactions: [] as ReactionType[],
  combos: [] as ComboFormula[],
  selectedCombo: null as string | null,
  formulaMode: "single" as "single" | "combo",
  minEr: {} as Record<string, number>,
  minCr: {} as Record<string, number>,
  opts: {} as OptionMap,
  extraBuffs: [] as ExtraBuff[],
} satisfies Partial<Team>;

export interface Team {
  id: string;
  name: string;
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ArtifactConfig | null)[];
  reactions: ReactionType[];
  opts: OptionMap;
  minEr: Record<string, number>;
  minCr?: Record<string, number>;
  selectedFormula: { charId: string; formulaId: string } | null;
  /** Reaction override for the selected single formula. Persisted independently from combo lines. */
  singleReaction?: ReactionOverride;
  optimizationResult: OptimizationResult | null;
  calcContext?: Partial<CalcContext>;
  /** Formula mode: "single" evaluates one formula at a time, "combo" evaluates a full rotation. */
  formulaMode: "single" | "combo";
  /** Combo formulas for rotation modeling */
  combos: ComboFormula[];
  /** Active combo ID, null = single formula mode */
  selectedCombo: string | null;
  /** Persistent element aura on the enemy (e.g. Pyro Regisvine). Enables reactions the team can't otherwise trigger. */
  enemyAura?: Element;
  /** Per-character analyzer configs (alt weapon, start/max C/R). Roster weapon is derived at runtime. */
  analyzerConfigs?: StoredAnalyzerCharConfig[];
  /** Flat sparse combo count overrides. Key = "charId|constellation|lineKey". */
  analyzerComboOverrides?: ComboCountOverrides;
  /** Flat sparse minEr overrides. Key = "charId|constellation". Value in internal format (1.6 = 160%). */
  analyzerMinErOverrides?: MinErOverrides;
  /** Per-formula reaction overrides for the analyzer (keyed by charId.formulaId). Independent from DamageView combos. */
  analyzerReactionOverrides?: Record<string, ReactionOverride>;
  /** Analyzer-specific enemy aura. Independent from DamageView enemyAura. */
  analyzerEnemyAura?: Element;
  /** Analyzer-specific extra buffs. Independent from DamageView extraBuffs. */
  analyzerExtraBuffs?: ExtraBuff[];
  /** Weapon choice per-character config overrides (level, constellation, talents, artifact sets). */
  weaponChoiceConfigs?: WeaponChoiceCharConfig[];
  /** Weapon choice formula mode. Independent from DamageView and Analyzer. */
  weaponChoiceFormulaMode?: "single" | "combo";
  weaponChoiceSelectedCombo?: string | null;
  weaponChoiceSingleFormula?: { charId: string; formulaId: string } | null;
  weaponChoiceSingleReaction?: ReactionOverride;
  weaponChoiceCombos?: ComboFormula[];
  weaponChoiceEnemyAura?: Element;
  weaponChoiceExtraBuffs?: ExtraBuff[];
  weaponChoiceCalcContext?: Partial<CalcContext>;
  /** Persisted weapon choice results. Survives refresh. */
  weaponChoiceResult?: WeaponChoiceResult | null;
  /** Extra buffs applied by user (food, environment, status, custom). UI-only until plugged into TeamBuild. */
  extraBuffs?: ExtraBuff[];
  /** Per-character toggle to exclude artifacts equipped by higher-tier characters */
  tierAwarePool?: Record<string, boolean>;
  /** Per-character CR mode: "min" = minCr constraint, "target" = critRateTarget buff */
  crMode?: Record<string, "min" | "target">;
  /** Per-character toggle to ignore artifact sets when ER/CR can't be met */
  ignoreArtifactSets?: Record<string, boolean>;
}

/** Exported artifact — `type` discriminator omitted since field names differ. */
export type ExportedArtifact =
  | { setId: string }
  | { id1: string | number; id2: string | number };

/** Exported team shape — only composition metadata, no user/account state. */
export interface ExportedTeam {
  /** Stable base64 ID derived from the team composition. */
  id: string;
  name: string;
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ExportedArtifact | null)[];
  reactions?: ReactionType[];
  minEr?: Record<string, number>;
  minCr?: Record<string, number>;
}

/** Importable/exportable team composition envelope. Backwards-compatible with raw Team[]. */
export interface TeamCompData {
  teams: ExportedTeam[];
  author?: string;
  description?: string;
}

interface TeamState {
  teams: Team[];
  author: string;
  description: string;

  // Actions
  addTeam: (initialData?: Partial<Team>, position?: "start" | "end") => string;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  copyTeam: (id: string) => void;
  moveTeam: (id: string, direction: "up" | "down") => void;
  /** Move team relative to an anchor team. Used by drag-and-drop. */
  moveTeamRelative: (
    id: string,
    anchorId: string,
    position: "before" | "after"
  ) => void;
  clearTeams: () => void;
  setMetadata: (author: string, description: string) => void;
  importTeams: (data: TeamCompData) => void;
  exportTeams: (author: string, description: string) => TeamCompData;
}

export const useTeamStore = create<TeamState>()(
  persist(
    immer((set, get) => ({
      teams: [],
      author: "",
      description: "",

      addTeam: (initialData, position = "end") => {
        const id = `team-${Date.now()}`;
        const newTeam: Team = {
          id,
          name: "",
          characters: [null, null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          ...DEFAULT_TEAM_FIELDS,
          selectedFormula: null,
          optimizationResult: null,
          ...initialData,
        };
        set((state) => {
          if (position === "start") {
            state.teams.unshift(newTeam);
          } else {
            state.teams.push(newTeam);
          }
        });
        return id;
      },

      updateTeam: (id, patch) => {
        set((state) => {
          const team = state.teams.find((t) => t.id === id);
          if (team) {
            Object.assign(team, patch);
          }
        });
      },

      deleteTeam: (id) => {
        set((state) => {
          state.teams = state.teams.filter((t) => t.id !== id);
        });
      },

      copyTeam: (id) => {
        set((state) => {
          const index = state.teams.findIndex((t) => t.id === id);
          if (index !== -1) {
            const team = state.teams[index];
            const newTeam = {
              ...team,
              id: `team-${Date.now()}`,
              name: team.name ? `${team.name}` : "",
              optimizationResult: null, // Don't copy the optimization result as it might be stale
            };
            state.teams.splice(index + 1, 0, newTeam);
          }
        });
      },

      moveTeam: (id, direction) => {
        set((state) => {
          const index = state.teams.findIndex((t) => t.id === id);
          if (index === -1) return;
          const targetIndex = direction === "up" ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= state.teams.length) return;
          const temp = state.teams[index];
          state.teams[index] = state.teams[targetIndex];
          state.teams[targetIndex] = temp;
        });
      },

      moveTeamRelative: (id, anchorId, position) => {
        set((state) => {
          if (id === anchorId) return;
          const idx = state.teams.findIndex((t) => t.id === id);
          if (idx === -1) return;
          // Remove the team first
          const [team] = state.teams.splice(idx, 1);
          // Find anchor after removal (index may have shifted)
          const anchorIdx = state.teams.findIndex((t) => t.id === anchorId);
          if (anchorIdx === -1) return;
          const insertIdx = position === "after" ? anchorIdx + 1 : anchorIdx;
          state.teams.splice(insertIdx, 0, team);
        });
      },

      clearTeams: () => {
        set((state) => {
          state.teams = [];
          state.author = "";
          state.description = "";
        });
      },

      setMetadata: (author, description) => set({ author, description }),

      importTeams: (data) => {
        // Accept both envelope { teams, author?, description? } and legacy raw Team[]
        const teamsArr = Array.isArray(data) ? data : data.teams;
        const validTeams: Team[] = teamsArr
          .filter(
            // biome-ignore lint/suspicious/noExplicitAny: imported JSON has unknown shape
            (t: any) => t.id && Array.isArray(t.characters)
          )
          // biome-ignore lint/suspicious/noExplicitAny: imported JSON has unknown shape
          .map((t: any) => {
            return {
              id: t.id,
              name: t.name ?? "",
              characters: t.characters,
              weapons: t.weapons ?? [null, null, null, null],
              artifacts: (t.artifacts ?? [null, null, null, null]).map(
                // biome-ignore lint/suspicious/noExplicitAny: imported JSON has unknown shape
                (a: any): ArtifactConfig | null => {
                  if (!a) return null;
                  if ("setId" in a) return { type: "4pc", setId: a.setId };
                  if ("id1" in a)
                    return { type: "2pc+2pc", id1: a.id1, id2: a.id2 };
                  return a; // already has type discriminator
                }
              ),
              reactions: t.reactions ?? [],
              opts: t.opts ?? {},
              // Support both new (minEr/minCr) and legacy (targetEr/targetCr) formats
              minEr: t.minEr ?? t.targetEr ?? {},
              minCr: t.minCr ?? t.targetCr ?? {},
              selectedFormula: t.selectedFormula ?? null,
              optimizationResult: null,
              calcContext: t.calcContext,
              formulaMode: t.formulaMode ?? "combo",
              combos: t.combos ?? [],
              selectedCombo: t.selectedCombo ?? null,
            };
          });

        set((state) => {
          state.teams = validTeams;
          if (!Array.isArray(data)) {
            state.author = data.author ?? "";
            state.description = data.description ?? "";
          }
        });
      },

      exportTeams: (author, description) => {
        const { teams } = get();
        // First, normalize teammate order (slots 1-3) by release date desc
        const normalized = teams.map((t) => {
          const indices = [1, 2, 3].sort(
            (a, b) =>
              charSortKey(t.characters[a]) - charSortKey(t.characters[b])
          );
          return {
            ...t,
            characters: [
              t.characters[0],
              ...indices.map((i) => t.characters[i]),
            ],
            weapons: [t.weapons[0], ...indices.map((i) => t.weapons[i])],
            artifacts: [t.artifacts[0], ...indices.map((i) => t.artifacts[i])],
          };
        });
        // Sort teams by carry release date, then group by carry ID, then teammates
        const sorted = normalized.sort((a, b) => {
          // Primary: carry release date (newest first)
          const carryDiff =
            charSortKey(a.characters[0]) - charSortKey(b.characters[0]);
          if (carryDiff !== 0) return carryDiff;
          // Secondary: group same-date carries by ID so they stay together
          const idA = a.characters[0] ?? "";
          const idB = b.characters[0] ?? "";
          if (idA !== idB) return idA < idB ? -1 : 1;
          // Tertiary: teammates 1-3
          for (let i = 1; i < 4; i++) {
            const diff =
              charSortKey(a.characters[i]) - charSortKey(b.characters[i]);
            if (diff !== 0) return diff;
          }
          return 0;
        });
        // Export composition metadata with stable content-based IDs
        const exportable: ExportedTeam[] = sorted.map((t) => {
          const entry: ExportedTeam = {
            id: encodeTeamId(t.characters, t.weapons, t.artifacts),
            name: t.name,
            characters: t.characters,
            weapons: t.weapons,
            artifacts: t.artifacts.map((a) => {
              if (!a) return null;
              if (a.type === "4pc") return { setId: a.setId };
              return { id1: a.id1, id2: a.id2 };
            }),
          };
          if (t.reactions.length > 0) entry.reactions = t.reactions;
          if (t.minEr && Object.keys(t.minEr).length > 0) entry.minEr = t.minEr;
          if (t.minCr && Object.keys(t.minCr).length > 0) entry.minCr = t.minCr;
          return entry;
        });
        return { teams: exportable, author, description };
      },
    })),
    {
      name: "team-builder-storage",
      version: 12,
      migrate: migrateTeamStore,
      merge: mergeTeamStore,
    }
  )
);
