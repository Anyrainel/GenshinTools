import type {
  GeneratorOptions,
  GeneratorResult,
} from "@/lib/team-comp/generator/generator";
import { runGenerator } from "@/lib/team-comp/generator/generator";
import { useAsyncComputation } from "./useAsyncComputation";

export interface AsyncGeneratorState {
  result: GeneratorResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: GeneratorOptions) => void;
  stop: () => void;
}

export function useAsyncGenerator(): AsyncGeneratorState {
  return useAsyncComputation<
    GeneratorResult,
    GeneratorResult,
    GeneratorOptions
  >(runGenerator);
}
