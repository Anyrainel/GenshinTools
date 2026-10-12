import type {
  GeneratorOptions,
  GeneratorResult,
} from "@/domain/combat/generator/generator";
import { runGenerator } from "@/domain/combat/generator/generator";
import { useAsyncComputation } from "./useAsyncComputation";

export interface AsyncGeneratorState {
  result: GeneratorResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: GeneratorOptions) => void;
  stop: () => void;
  reset: () => void;
}

export function useAsyncGenerator(): AsyncGeneratorState {
  return useAsyncComputation<
    GeneratorResult,
    GeneratorResult,
    GeneratorOptions
  >(runGenerator);
}
