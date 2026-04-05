import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { TierAssignment } from "@/data/types";
import type { SubstatBudgetPreset } from "@/lib/team-comp/substatBudget";
import { getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";

const LABEL_CLS =
  "font-semibold text-foreground/80 select-none whitespace-nowrap text-[10px] md:text-sm";

const INPUT_CLS =
  "text-center font-bold border-border/20 bg-white/5 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 text-xs h-6 w-8 px-0.5 py-0 leading-none md:text-sm md:h-7 md:w-10 md:px-1";

const SPINNER_HIDE =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

// ─── Enemy Level + Res ───

type EnemyInputsProps = {
  enemyLevel: number | string;
  onEnemyLevelChange: (raw: string) => void;
  enemyRes: number | string;
  onEnemyResChange: (raw: string) => void;
  t: ReturnType<typeof useLanguage>["t"];
};

export function EnemyInputs({
  enemyLevel,
  onEnemyLevelChange,
  enemyRes,
  onEnemyResChange,
  t,
}: EnemyInputsProps) {
  return (
    <>
      <div className="flex items-center gap-0.5 md:gap-1">
        <span className={LABEL_CLS}>{t.ui("teamComp.enemyLevel")}</span>
        <Input
          type="text"
          inputMode="numeric"
          value={enemyLevel}
          placeholder="110"
          onChange={(e) => onEnemyLevelChange(e.target.value)}
          className={INPUT_CLS}
        />
      </div>
      <div className="flex items-center gap-0.5 md:gap-1">
        <span className={LABEL_CLS}>{t.ui("teamComp.enemyRes")}</span>
        <div className="flex items-center gap-0">
          <Input
            type="number"
            value={enemyRes}
            placeholder="10"
            onChange={(e) => onEnemyResChange(e.target.value)}
            className={`${INPUT_CLS} ${SPINNER_HIDE}`}
          />
          <span className="font-bold text-muted-foreground text-[10px] md:text-xs">
            %
          </span>
        </div>
      </div>
    </>
  );
}

// ─── Roll Multiplier + Substat Budget ───

const ROLL_MULT_OPTIONS = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0];

const BUDGET_PRESETS: { value: SubstatBudgetPreset; label: string }[] = [
  { value: "7_5", label: "7/5 (5/4★)" },
  { value: "7_6", label: "7/6 (5/4★)" },
  { value: "8_6", label: "8/6 (5/4★)" },
  { value: "8_7", label: "8/7 (5/4★)" },
  { value: "9_7", label: "9/7 (5/4★)" },
];

type RollQualityInputsProps = {
  rollMultiplier: number;
  onRollMultiplierChange: (v: number) => void;
  substatBudget: SubstatBudgetPreset;
  onSubstatBudgetChange: (v: SubstatBudgetPreset) => void;
  t: ReturnType<typeof useLanguage>["t"];
};

export function RollQualityInputs({
  rollMultiplier,
  onRollMultiplierChange,
  substatBudget,
  onSubstatBudgetChange,
  t,
}: RollQualityInputsProps) {
  return (
    <>
      <div className="flex items-center gap-0.5 md:gap-1">
        <span className={LABEL_CLS}>{t.ui("teamComp.rollMultiplier")}</span>
        <Select
          value={String(rollMultiplier)}
          onValueChange={(v) => onRollMultiplierChange(Number(v))}
        >
          <SelectTrigger className="font-bold border-border/20 bg-white/5 text-xs h-6 w-14 px-1 py-0 md:text-sm md:h-7 md:w-16 md:px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLL_MULT_OPTIONS.map((v) => (
              <SelectItem key={v} value={String(v)}>
                {v}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-0.5 md:gap-1">
        <span className={LABEL_CLS}>{t.ui("teamComp.substatBudget")}</span>
        <Select
          value={substatBudget}
          onValueChange={onSubstatBudgetChange as (v: string) => void}
        >
          <SelectTrigger className="font-bold border-border/20 bg-white/5 min-w-0 max-w-[9rem] text-xs h-6 px-1 py-0 md:text-sm md:h-7 md:max-w-[10rem] md:px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUDGET_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

// ─── Per-Character CR/ER Settings ───

const CHAR_INPUT_CLS =
  "text-center font-bold bg-white/5 rounded-md border border-border/20 p-0 leading-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-8 h-5 text-xs lg:w-10 lg:h-6 lg:text-sm";

export type CharCrErProps = {
  team: Team;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  tierAssignments?: TierAssignment;
  t: ReturnType<typeof useLanguage>["t"];
};

export function CharCrErSettings({
  team,
  updateTeam,
  tierAssignments,
  t,
}: CharCrErProps) {
  const charIds = team.characters.filter((id): id is string => id != null);
  if (charIds.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-around items-start gap-y-1">
      {charIds.map((charId) => {
        const crMode = team.crMode?.[charId] ?? "min";
        const hasTier = tierAssignments?.[charId] != null;
        const tierEnabled = team.tierAwarePool?.[charId] ?? false;

        return (
          <div
            key={charId}
            className="flex items-center gap-1 md:gap-1.5 flex-wrap justify-center"
          >
            {/* Character icon */}
            {charactersById[charId] && (
              <img
                src={getAssetUrl(charactersById[charId]!.imagePath)}
                alt={t.character(charId)}
                title={t.character(charId)}
                className="w-5 h-5 md:w-6 md:h-6 object-contain rounded-full bg-secondary/40 shrink-0"
              />
            )}

            {/* CR block: mode select + value input + % */}
            <div className="flex items-center gap-px">
              <Select
                value={crMode}
                onValueChange={(v) => {
                  const newCrMode = { ...(team.crMode ?? {}) };
                  newCrMode[charId] = v as "min" | "target";
                  const newMinCr = { ...(team.minCr ?? {}) };
                  delete newMinCr[charId];
                  updateTeam(team.id, { crMode: newCrMode, minCr: newMinCr });
                }}
              >
                <SelectTrigger className="w-[62px] md:w-[72px] h-5 md:h-6 text-[10px] md:text-xs font-bold text-foreground bg-white/5 border-border/20 px-0.5 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="min">{t.ui("teamComp.minCr")}</SelectItem>
                  <SelectItem value="target">
                    {t.ui("teamComp.critRateTarget")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="--"
                value={
                  team.minCr?.[charId] != null
                    ? String(Math.round(team.minCr[charId] * 100))
                    : ""
                }
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === "") {
                    const next = { ...(team.minCr ?? {}) };
                    delete next[charId];
                    updateTeam(team.id, { minCr: next });
                    return;
                  }
                  const val = Number(raw) / 100;
                  if (!Number.isNaN(val)) {
                    updateTeam(team.id, {
                      minCr: {
                        ...(team.minCr ?? {}),
                        [charId]: Math.max(0, Math.min(1, val)),
                      },
                    });
                  }
                }}
                className={CHAR_INPUT_CLS}
              />
              <span className="font-bold text-foreground text-[10px] md:text-xs">
                %
              </span>
            </div>

            {/* ER block: label + value input + % */}
            <div className="flex items-center gap-px">
              <span className="font-bold text-foreground text-[10px] md:text-xs mr-px">
                {t.ui("teamComp.minEr")}
              </span>
              <Input
                type="text"
                inputMode="numeric"
                value={
                  team.minEr[charId] != null
                    ? String(Math.round(team.minEr[charId] * 100))
                    : ""
                }
                placeholder="--"
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === "") {
                    const { [charId]: _, ...rest } = team.minEr;
                    updateTeam(team.id, { minEr: rest });
                    return;
                  }
                  if (!/^\d+$/.test(raw)) return;
                  const val = Number(raw) / 100;
                  if (!Number.isNaN(val)) {
                    updateTeam(team.id, {
                      minEr: { ...team.minEr, [charId]: val },
                    });
                  }
                }}
                className={CHAR_INPUT_CLS}
              />
              <span className="font-bold text-foreground text-[10px] md:text-xs">
                %
              </span>
            </div>

            {/* Tier toggle */}
            {hasTier && (
              <div
                className="flex items-center gap-0.5 cursor-pointer select-none"
                onClick={() =>
                  updateTeam(team.id, {
                    tierAwarePool: {
                      ...(team.tierAwarePool ?? {}),
                      [charId]: !tierEnabled,
                    },
                  })
                }
              >
                <Checkbox
                  checked={tierEnabled}
                  className="h-3.5 w-3.5 pointer-events-none"
                />
                <span className="font-medium text-foreground/50 text-[10px] md:text-xs">
                  {t.ui("teamComp.tierPool")}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
