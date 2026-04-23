import {
  runWeaponChoice,
  type WeaponChoiceOptions,
  type WeaponChoiceResult,
} from "@/lib/team-comp/analyzer/weaponChoice";
import { useAsyncComputation } from "./useAsyncComputation";

export interface AsyncWeaponChoiceState {
  result: WeaponChoiceResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: WeaponChoiceOptions) => void;
  stop: () => void;
}

export function useAsyncWeaponChoice(): AsyncWeaponChoiceState {
  return useAsyncComputation<
    WeaponChoiceResult,
    WeaponChoiceResult,
    WeaponChoiceOptions
  >(runWeaponChoice);
}
