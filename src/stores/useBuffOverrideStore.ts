/**
 * Ephemeral (non-persisted) Zustand store for per-formula buff activation overrides.
 *
 * Stores user overrides for how many hits of each buff apply to each formula part.
 * Used by both the display path and the optimizer hot path.
 *
 * Single mode: keyed by formulaKey "charId.formulaId", value = activatedHits per part.
 * Combo mode:  keyed by comboKey "combo:comboId:charId.formulaId",
 *              value = total activatedHits across ALL repetitions of that formula in the combo.
 */

import type { BuffActivationMap } from "@/lib/team-comp/types";
import { create } from "zustand";

interface BuffOverrideState {
  /**
   * Single mode: formulaKey → buffKey → partIndex → hitCount
   * Only non-default values are stored. Missing = use default (from greedy allocation).
   */
  overrides: Record<string, BuffActivationMap>;

  /**
   * Combo mode: comboKey → buffKey → partIndex → totalActivatedHits (across all reps).
   * comboKey format: "combo:comboId:charId.formulaId"
   * The slider max in combo is partHits × totalCount (sum of line.count for this formula).
   */
  comboOverrides: Record<string, BuffActivationMap>;

  /** Set the hit count for a specific buff on a specific part. */
  setHits: (
    formulaKey: string,
    buffKey: string,
    partIndex: number,
    hits: number
  ) => void;

  /** Remove a specific buff override for a part (revert to default). */
  clearHits: (formulaKey: string, buffKey: string, partIndex: number) => void;

  /** Set the total hit count for a buff in combo mode (across all repetitions). */
  setComboHits: (
    comboKey: string,
    buffKey: string,
    partIndex: number,
    totalHits: number
  ) => void;

  /** Remove a combo buff override for a part. */
  clearComboHits: (
    comboKey: string,
    buffKey: string,
    partIndex: number
  ) => void;

  /** Clear all overrides for a formula (or all formulas if no key given). */
  clear: (formulaKey?: string) => void;

  /** Get the BuffActivationMap for a formula key (may be undefined). */
  getActivation: (formulaKey: string) => BuffActivationMap | undefined;

  /** Get the combo BuffActivationMap for a combo key (may be undefined). */
  getComboActivation: (comboKey: string) => BuffActivationMap | undefined;

  /**
   * Version counter — bumped on team/constellation changes to invalidate.
   * UI components compare this against a hash of TeamBuild config.
   */
  version: number;
  invalidate: () => void;
}

export const useBuffOverrideStore = create<BuffOverrideState>()((set, get) => ({
  overrides: {},
  comboOverrides: {},

  setHits: (formulaKey, buffKey, partIndex, hits) =>
    set((state) => {
      const prev = state.overrides[formulaKey] ?? {};
      const prevBuff = prev[buffKey] ?? {};
      return {
        overrides: {
          ...state.overrides,
          [formulaKey]: {
            ...prev,
            [buffKey]: {
              ...prevBuff,
              [partIndex]: hits,
            },
          },
        },
      };
    }),

  clearHits: (formulaKey, buffKey, partIndex) =>
    set((state) => {
      const prev = state.overrides[formulaKey];
      if (!prev?.[buffKey]) return state;

      const prevBuff = { ...prev[buffKey] };
      delete prevBuff[partIndex];

      const newFormula = { ...prev };
      if (Object.keys(prevBuff).length === 0) {
        delete newFormula[buffKey];
      } else {
        newFormula[buffKey] = prevBuff;
      }

      const newOverrides = { ...state.overrides };
      if (Object.keys(newFormula).length === 0) {
        delete newOverrides[formulaKey];
      } else {
        newOverrides[formulaKey] = newFormula;
      }

      return { overrides: newOverrides };
    }),

  setComboHits: (comboKey, buffKey, partIndex, totalHits) =>
    set((state) => {
      const prev = state.comboOverrides[comboKey] ?? {};
      const prevBuff = prev[buffKey] ?? {};
      return {
        comboOverrides: {
          ...state.comboOverrides,
          [comboKey]: {
            ...prev,
            [buffKey]: {
              ...prevBuff,
              [partIndex]: totalHits,
            },
          },
        },
      };
    }),

  clearComboHits: (comboKey, buffKey, partIndex) =>
    set((state) => {
      const prev = state.comboOverrides[comboKey];
      if (!prev?.[buffKey]) return state;

      const prevBuff = { ...prev[buffKey] };
      delete prevBuff[partIndex];

      const newCombo = { ...prev };
      if (Object.keys(prevBuff).length === 0) {
        delete newCombo[buffKey];
      } else {
        newCombo[buffKey] = prevBuff;
      }

      const newComboOverrides = { ...state.comboOverrides };
      if (Object.keys(newCombo).length === 0) {
        delete newComboOverrides[comboKey];
      } else {
        newComboOverrides[comboKey] = newCombo;
      }

      return { comboOverrides: newComboOverrides };
    }),

  clear: (formulaKey) =>
    set((state) => {
      if (formulaKey) {
        const { [formulaKey]: _, ...rest } = state.overrides;
        return { overrides: rest };
      }
      return { overrides: {}, comboOverrides: {} };
    }),

  getActivation: (formulaKey) => get().overrides[formulaKey],

  getComboActivation: (comboKey) => get().comboOverrides[comboKey],

  version: 0,
  invalidate: () =>
    set((state) => ({
      overrides: {},
      comboOverrides: {},
      version: state.version + 1,
    })),
}));
