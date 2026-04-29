import type { ReactionType } from "@/data/enums";
import type {
  CalcContext,
  ComboFormula,
  ExtraBuff,
  OptionMap,
} from "@/lib/dmgcalc/types";
import type { Team } from "@/lib/team-comp/types";

/** Default values for team fields that may be missing from persisted data. */
export const DEFAULT_TEAM_FIELDS = {
  reactions: [] as ReactionType[],
  combo: null as ComboFormula | null,
  formulaMode: "single" as "single" | "combo",
  opts: {} as OptionMap,
  extraBuffs: [] as ExtraBuff[],
  calcContext: {} as CalcContext,
} satisfies Partial<Team>;
