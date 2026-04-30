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
import { charactersById } from "@/data/gameResources";
import type { TierAssignment } from "@/data/types";
import {
  numericInputFilter,
  useDeferredTextInput,
} from "@/hooks/useDeferredTextInput";
import type { SubstatBudgetPreset } from "@/lib/dmgcalc/types";
import type { TeamCharConfig } from "@/lib/team-comp/types";
import { getAssetUrl } from "@/lib/utils";

const LABEL_CLS =
  "font-semibold text-foreground/80 select-none whitespace-nowrap text-[10px] md:text-sm";
const INPUT_CLS =
  "text-center font-bold border-border/20 bg-white/5 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 text-xs h-6 w-8 px-0.5 py-0 leading-none md:text-sm md:h-7 md:w-10 md:px-1";
const SPINNER_HIDE =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

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
  const lvl = useDeferredTextInput(
    String(enemyLevel ?? ""),
    onEnemyLevelChange,
    { filter: numericInputFilter }
  );
  const res = useDeferredTextInput(String(enemyRes ?? ""), onEnemyResChange, {
    filter: numericInputFilter,
  });
  return (
    <>
      <div className="flex items-center gap-0.5 md:gap-1">
        <span className={LABEL_CLS}>{t.ui("teamComp.enemyLevel")}</span>
        <Input
          type="text"
          inputMode="numeric"
          value={lvl.value}
          placeholder="110"
          onChange={lvl.onChange}
          onBlur={lvl.onBlur}
          onKeyDown={lvl.onKeyDown}
          className={INPUT_CLS}
        />
      </div>
      <div className="flex items-center gap-0.5 md:gap-1">
        <span className={LABEL_CLS}>{t.ui("teamComp.enemyRes")}</span>
        <div className="flex items-center gap-0">
          <Input
            type="text"
            inputMode="numeric"
            value={res.value}
            placeholder="10"
            onChange={res.onChange}
            onBlur={res.onBlur}
            onKeyDown={res.onKeyDown}
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
        <Select value={substatBudget} onValueChange={onSubstatBudgetChange}>
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

// Defers commit until blur/Enter so per-keystroke config updates don't
// re-render the whole optimizer/generator results pipeline.
function PctInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (raw: string) => void;
}) {
  const d = useDeferredTextInput(value, onCommit, {
    filter: numericInputFilter,
  });
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder="--"
      value={d.value}
      onChange={d.onChange}
      onBlur={d.onBlur}
      onKeyDown={d.onKeyDown}
      className={CHAR_INPUT_CLS}
    />
  );
}

const CB_CLS = "flex items-center gap-0.5 cursor-pointer select-none";
const CB_LABEL_CLS =
  "font-medium text-foreground/60 text-[10px] md:text-xs leading-tight";

export type CharCrErProps = {
  characters: (string | null)[];
  charConfigs?: Record<string, TeamCharConfig>;
  onCharConfigsChange: (charConfigs: Record<string, TeamCharConfig>) => void;
  tierAssignments?: TierAssignment;
  t: ReturnType<typeof useLanguage>["t"];
};

export function CharCrErSettings({
  characters,
  charConfigs,
  onCharConfigsChange,
  tierAssignments,
  t,
}: CharCrErProps) {
  const configs = charConfigs ?? {};
  const charIds = characters.filter((id): id is string => id != null);
  if (charIds.length === 0) return null;

  const updateCharConfig = (
    charId: string,
    updater: (current: TeamCharConfig) => TeamCharConfig
  ) => {
    onCharConfigsChange({
      ...configs,
      [charId]: updater(configs[charId] ?? {}),
    });
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 pb-1 md:pb-2">
      {charIds.map((charId) => {
        const cs = configs[charId];
        const crMode = cs?.crMode ?? "min";
        const tierEnabled = cs?.tierAwarePool ?? false;
        const fullSetOptional = cs?.fullSetOptional ?? false;

        return (
          <div
            key={charId}
            className="flex flex-col gap-0.5 rounded-md border border-border px-1.5 py-1 md:px-2 md:py-1.5"
          >
            {/* Row 1: icon + CR + ER */}
            <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 md:gap-x-1.5">
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
                    const prev = configs[charId];
                    const { minCr: _, ...rest } = prev ?? {};
                    updateCharConfig(charId, () => {
                      return { ...rest, crMode: v as "min" | "target" };
                    });
                  }}
                >
                  <SelectTrigger className="w-[62px] md:w-[72px] h-5 md:h-6 text-[10px] md:text-xs font-bold text-foreground bg-white/5 border-border/20 px-0.5 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="min">
                      {t.ui("teamComp.minCr")}
                    </SelectItem>
                    <SelectItem value="target">
                      {t.ui("teamComp.critRateTarget")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <PctInput
                  value={
                    cs?.minCr != null ? String(Math.round(cs.minCr * 100)) : ""
                  }
                  onCommit={(rawIn) => {
                    const raw = rawIn.trim();
                    const prev = configs[charId];
                    if (raw === "") {
                      const { minCr: _, ...rest } = prev ?? {};
                      updateCharConfig(charId, () => rest);
                      return;
                    }
                    const val = Number(raw) / 100;
                    if (!Number.isNaN(val)) {
                      updateCharConfig(charId, () => {
                        return {
                          ...prev,
                          minCr: Math.max(0, Math.min(1, val)),
                        };
                      });
                    }
                  }}
                />
                <span className="font-bold text-foreground text-[10px] md:text-xs">
                  %
                </span>
              </div>

              {/* ER block: label + value input + % */}
              <div className="flex items-center gap-px">
                <span className="whitespace-nowrap font-bold text-foreground text-[10px] md:text-xs mr-px">
                  {t.ui("teamComp.minEr")}
                </span>
                <PctInput
                  value={
                    cs?.minEr != null ? String(Math.round(cs.minEr * 100)) : ""
                  }
                  onCommit={(rawIn) => {
                    const raw = rawIn.trim();
                    const prev = configs[charId];
                    if (raw === "") {
                      const { minEr: _, ...rest } = prev ?? {};
                      updateCharConfig(charId, () => rest);
                      return;
                    }
                    const val = Number(raw) / 100;
                    if (!Number.isNaN(val)) {
                      updateCharConfig(charId, () => {
                        return { ...prev, minEr: val };
                      });
                    }
                  }}
                />
                <span className="font-bold text-foreground text-[10px] md:text-xs">
                  %
                </span>
              </div>
            </div>

            {/* Row 2: checkboxes */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 md:gap-x-3 pl-6 md:pl-7">
              {/* ER over set checkbox */}
              <div
                className={CB_CLS}
                onClick={() =>
                  updateCharConfig(charId, (current) => {
                    return {
                      ...current,
                      fullSetOptional: !fullSetOptional,
                    };
                  })
                }
              >
                <Checkbox
                  checked={fullSetOptional}
                  className="h-3.5 w-3.5 pointer-events-none"
                />
                <span className={CB_LABEL_CLS}>
                  {t.ui("teamComp.erOverSet")}
                </span>
              </div>

              {/* Tier pool checkbox — always shown; unassigned chars default to Pool tier */}
              {tierAssignments && (
                <div
                  className={CB_CLS}
                  onClick={() =>
                    updateCharConfig(charId, (current) => {
                      return {
                        ...current,
                        tierAwarePool: !tierEnabled,
                      };
                    })
                  }
                >
                  <Checkbox
                    checked={tierEnabled}
                    className="h-3.5 w-3.5 pointer-events-none"
                  />
                  <span className={CB_LABEL_CLS}>
                    {t.ui("teamComp.tierPool")}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
