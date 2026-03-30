import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { SubstatBudgetPreset } from "@/lib/team-comp/substatBudget";

const LABEL_CLS =
  "font-semibold text-foreground/80 select-none whitespace-nowrap text-[10px] md:text-sm";

const INPUT_CLS =
  "text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 text-xs h-6 w-8 px-0.5 py-0 leading-none md:text-sm md:h-7 md:w-10 md:px-1";

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
          <SelectTrigger className="font-bold border-border/20 bg-background/50 text-xs h-6 w-14 px-1 py-0 md:text-sm md:h-7 md:w-16 md:px-1.5">
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
          <SelectTrigger className="font-bold border-border/20 bg-background/50 min-w-0 max-w-[9rem] text-xs h-6 px-1 py-0 md:text-sm md:h-7 md:max-w-[10rem] md:px-1.5">
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
