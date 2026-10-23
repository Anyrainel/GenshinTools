import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnalyzerOptions,
  AnalyzerResult,
} from "@/domain/combat/analyzer/types";
import type { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import { useAnalyzer } from "@/hooks/useAnalyzer";
import { useAnalyzerCacheStore } from "@/stores/useAnalyzerCacheStore";
import { useTeamResultCacheStore } from "@/stores/useTeamResultCacheStore";

const run = vi.hoisted(() => vi.fn());
vi.mock("@/domain/combat/analyzer/analyzer", () => ({
  runAnalysis: run,
  isAnalyzerResult: (value: object) => "sequence" in value,
}));
const result: AnalyzerResult = {
  dag: { nodes: [], edges: [], baselineJin: 0, maxJin: 0 },
  bestAtTier: new Map(),
  nodesByJin: new Map(),
  sequence: [],
};
const options: AnalyzerOptions = {
  configs: [],
  baseConfigs: [],
  calcContext: {
    enemyLevel: 100,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
  },
  teamBuild: {
    configs: [],
    combatOpts: {},
    extraBuffs: [],
  } as unknown as TeamBuild,
  templateCombo: {
    id: "selected",
    label: { en: "Selected", zh: "已选择" },
    lines: [],
  },
};

beforeEach(() => {
  useTeamResultCacheStore.getState().clearAll();
  useAnalyzerCacheStore.getState().clearAll();
  run.mockReset();
  run.mockImplementation(async function* () {
    yield result;
  });
});

describe("investment result input scope", () => {
  it("restores matching persisted inputs through public hydration, and rejects other account/objective inputs", async () => {
    localStorage.setItem(
      "team-result-cache",
      JSON.stringify({
        version: 9,
        state: {
          resultsByTeamId: {
            team: {
              investmentResult: { ...result, bestAtTier: [], nodesByJin: [] },
              investmentInputKey: "account-A:C2:vaporize",
            },
          },
        },
      })
    );
    await useTeamResultCacheStore.persist.rehydrate();
    const matching = renderHook(() =>
      useAnalyzer("team", "account-A:C2:vaporize")
    );
    expect(matching.result.current.result).toEqual(result);
    matching.unmount();
    const other = renderHook(() => useAnalyzer("team", "account-B:C0:single"));
    expect(other.result.current.result).toBeNull();
  });

  it("does not restore unkeyed cached data from an unknown calculation scope", () => {
    useTeamResultCacheStore.getState().setInvestmentResult("team", result);
    const hook = renderHook(() => useAnalyzer("team", "current-inputs"));
    expect(hook.result.current.result).toBeNull();
  });

  it("clears local and persisted output when live inputs change so remounting cannot resurrect it", () => {
    useTeamResultCacheStore
      .getState()
      .setInvestmentResult("team", result, "before");
    const hook = renderHook(({ key }) => useAnalyzer("team", key), {
      initialProps: { key: "before" },
    });
    expect(hook.result.current.result).toEqual(result);
    hook.rerender({ key: "after" });
    expect(hook.result.current.result).toBeNull();
    expect(
      useTeamResultCacheStore.getState().getInvestmentResult("team")
    ).toBeUndefined();
    hook.unmount();
    expect(
      renderHook(() => useAnalyzer("team", "after")).result.current.result
    ).toBeNull();
  });

  it("writes the current signature for fresh calculations and in-memory cache hits", async () => {
    const hook = renderHook(() => useAnalyzer("team", "current-inputs"));
    await act(async () => {
      hook.result.current.start(options);
    });
    await waitFor(() => expect(hook.result.current.result).toEqual(result));
    expect(
      useTeamResultCacheStore.getState().getForTeam("team")?.investmentInputKey
    ).toBe("current-inputs");
    act(() => {
      useTeamResultCacheStore.getState().clearForTeam("team");
    });
    await act(async () => {
      hook.result.current.start(options);
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(
      useTeamResultCacheStore
        .getState()
        .getInvestmentResult("team", "current-inputs")
    ).toEqual(result);
  });

  it("does not reuse an investment path when only a shared line's field-state setting changes", async () => {
    const offField: AnalyzerOptions = {
      ...options,
      templateCombo: {
        ...options.templateCombo,
        lines: [
          {
            charId: "carry",
            formulaId: "skill",
            count: 1,
            forceOnField: false,
          },
        ],
      },
    };
    const onField: AnalyzerOptions = {
      ...offField,
      templateCombo: {
        ...offField.templateCombo,
        lines: [{ ...offField.templateCombo.lines[0], forceOnField: true }],
      },
    };
    const hook = renderHook(({ key }) => useAnalyzer("team", key), {
      initialProps: { key: "off-field" },
    });
    await act(async () => {
      hook.result.current.start(offField);
    });
    await waitFor(() => expect(hook.result.current.result).toEqual(result));
    hook.rerender({ key: "on-field" });
    await act(async () => {
      hook.result.current.start(onField);
    });
    await waitFor(() => expect(hook.result.current.result).toEqual(result));
    expect(run).toHaveBeenCalledTimes(2);
  });
});
