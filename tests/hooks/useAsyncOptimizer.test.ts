import { useAsyncOptimizer } from "@/hooks/useAsyncOptimizer";
import type {
  OptimizationResult,
  OptimizerOptions,
} from "@/lib/team-comp/optimizer";
import { runOptimization } from "@/lib/team-comp/optimizer";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/team-comp/optimizer", () => ({
  runOptimization: vi.fn(),
}));

const mockRunOptimization = vi.mocked(runOptimization);

const mockOpts = {} as OptimizerOptions;

async function* mockGenerator(
  results: OptimizationResult[]
): AsyncGenerator<OptimizationResult> {
  for (const r of results) {
    yield r;
  }
}

function makeResult(
  overrides: Partial<OptimizationResult> = {}
): OptimizationResult {
  return {
    bestDamage: 100,
    bestDamageResult: null,
    bestArtifacts: {} as OptimizationResult["bestArtifacts"],
    progress: 1,
    combinationsEvaluated: 1,
    combinationsTotal: 1,
    startTime: 0,
    endTime: 1,
    done: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAsyncOptimizer", () => {
  describe("initial state", () => {
    it("returns null result, not computing, no error", () => {
      const { result } = renderHook(() => useAsyncOptimizer());
      expect(result.current.result).toBeNull();
      expect(result.current.isComputing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.start).toBe("function");
      expect(typeof result.current.stop).toBe("function");
    });
  });

  describe("start", () => {
    it("sets isComputing true then yields result and sets isComputing false", async () => {
      const res = makeResult({ bestDamage: 100 });
      mockRunOptimization.mockReturnValue(
        mockGenerator([res]) as ReturnType<typeof runOptimization>
      );

      const { result } = renderHook(() => useAsyncOptimizer());

      act(() => {
        result.current.start(mockOpts);
      });
      expect(result.current.isComputing).toBe(true);

      await waitFor(() => {
        expect(result.current.isComputing).toBe(false);
      });
      expect(result.current.result).toEqual(res);
      expect(result.current.error).toBeNull();
      expect(mockRunOptimization).toHaveBeenCalledWith(mockOpts);
    });

    it("sets error when optimization throws", async () => {
      const err = new Error("optimizer failed");
      mockRunOptimization.mockImplementation(() => {
        throw err;
      });

      const { result } = renderHook(() => useAsyncOptimizer());

      await act(async () => {
        result.current.start(mockOpts);
      });

      await waitFor(() => {
        expect(result.current.isComputing).toBe(false);
        expect(result.current.error).not.toBeNull();
      });
      expect(result.current.error?.message).toBe("optimizer failed");
    });
  });

  describe("stop", () => {
    it("sets isComputing false and leaves result as-is", async () => {
      let resolvePromise: () => void;
      const blockPromise = new Promise<void>((r) => {
        resolvePromise = r;
      });
      mockRunOptimization.mockReturnValue(
        (async function* () {
          await blockPromise;
          yield makeResult();
        })() as ReturnType<typeof runOptimization>
      );

      const { result } = renderHook(() => useAsyncOptimizer());

      act(() => {
        result.current.start(mockOpts);
      });
      expect(result.current.isComputing).toBe(true);

      act(() => {
        result.current.stop();
      });
      expect(result.current.isComputing).toBe(false);
      resolvePromise!();
    });
  });
});
