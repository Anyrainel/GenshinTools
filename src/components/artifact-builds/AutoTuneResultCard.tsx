import {
  ComboTable,
  MainStatColumn,
  SubstatPills,
} from "@/components/artifact-builds/AutoTuneResults";
import { AutoTuneTeamRow } from "@/components/artifact-builds/AutoTuneTeamRow";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { AccountData, Build, Element } from "@/data/types";
import type {
  AutoTuneOutput,
  TeamBreakdown,
} from "@/lib/account-data/scoring/pipeline";
import { ELEMENT_HEX, cn, getElementColor } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";

type EntryStatus = "idle" | "computing" | "done" | "applied";

type ResultEntry = {
  buildId: string;
  characterId: string;
  build: Build;
  status: EntryStatus;
  result: AutoTuneOutput | null;
  teams: Team[];
};

function TeamResultRow({
  team,
  characterId,
  breakdown,
  accountData,
}: {
  team: Team | null;
  characterId: string;
  breakdown: TeamBreakdown;
  accountData: AccountData | null;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const qualifying = breakdown.combos.filter((c) => c.damageRatio >= 0.96);

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button
        type="button"
        className="flex items-center gap-3 w-full px-2.5 py-2 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {team ? (
          <div className="flex-1 min-w-0 pointer-events-none">
            <AutoTuneTeamRow
              team={team}
              characterId={characterId}
              enabled={true}
              onToggle={() => {}}
              accountData={accountData}
            />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground truncate flex-1">
            {breakdown.label}
          </span>
        )}

        <div className="shrink-0 text-right space-y-0.5">
          {breakdown.formulas
            ?.filter((f) => f.count > 0)
            .map((f) => (
              <div key={f.formulaId} className="text-xs">
                <span className="font-medium text-foreground md:text-sm">
                  {f.label ? t.resolveLabel(f.label) : f.formulaId}
                </span>{" "}
                <span className="text-sm font-mono font-semibold text-foreground/70">
                  ×{f.count}
                </span>
              </div>
            ))}
          <div className="text-xs text-muted-foreground">
            {t.format(
              "batchAutoTune.mainStatCombos",
              qualifying.length,
              qualifying.length !== 1 ? "s" : ""
            )}
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && qualifying.length > 0 && (
        <div className="px-2.5 pb-2">
          <ComboTable combos={qualifying} />
        </div>
      )}
    </div>
  );
}

export function AutoTuneResultCard({
  entry,
  onApply,
  onDismiss,
  element,
  accountData,
}: {
  entry: ResultEntry;
  onApply: () => void;
  onDismiss: () => void;
  element: string;
  accountData: AccountData | null;
}) {
  const { t } = useLanguage();
  const char = charactersById[entry.characterId];
  const elColor = getElementColor(element as Element, "text");
  const elHex = ELEMENT_HEX[element] || "#888";
  const result = entry.result;

  // Computing — spinner placeholder card
  if (entry.status === "computing") {
    return (
      <div className="bg-gradient-card border border-border/50 rounded-lg overflow-hidden">
        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, ${elHex}, transparent)`,
          }}
        />
        <div className="p-3 flex items-center gap-2">
          {char && <ItemIcon characterId={entry.characterId} size="md" />}
          <div className="min-w-0 flex-1">
            <div className={cn("font-bold text-base truncate", elColor)}>
              {t.character(entry.characterId)}
            </div>
            {entry.build.name && (
              <div className="text-sm text-foreground/70">
                {entry.build.name}
              </div>
            )}
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  const applied = entry.status === "applied";

  return (
    <div
      className={cn(
        "bg-gradient-card border rounded-lg overflow-hidden",
        applied ? "border-green-500/40" : "border-border/50"
      )}
    >
      {/* Element accent */}
      <div
        className="h-1"
        style={{
          background: `linear-gradient(90deg, ${elHex}, transparent)`,
        }}
      />

      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          {char && <ItemIcon characterId={entry.characterId} size="md" />}
          <div className="min-w-0 flex-1">
            <div className={cn("font-bold text-base truncate", elColor)}>
              {t.character(entry.characterId)}
            </div>
            {entry.build.name && (
              <div className="text-sm text-foreground/70">
                {entry.build.name}
              </div>
            )}
          </div>
          {applied ? (
            <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
              <Check className="w-3.5 h-3.5" />
              {t.ui("batchAutoTune.applied")}
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={onDismiss}
              >
                {t.ui("batchAutoTune.dismiss")}
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={onApply}>
                {t.ui("batchAutoTune.apply")}
              </Button>
            </div>
          )}
        </div>

        {/* Main stat weights (3-col grid) */}
        <div className="grid grid-cols-3 gap-2">
          <MainStatColumn
            label={t.slot("sands")}
            weights={result.sandsWeights}
          />
          <MainStatColumn
            label={t.slot("goblet")}
            weights={result.gobletWeights}
          />
          <MainStatColumn
            label={t.slot("circlet")}
            weights={result.circletWeights}
          />
        </div>

        {/* Substat pills */}
        <SubstatPills substats={result.substats} />

        {/* Per-team breakdowns */}
        {result.teamBreakdowns.length > 0 && (
          <div className="border-t border-white/10 pt-2 space-y-2">
            {result.teamBreakdowns.map((tb) => (
              <TeamResultRow
                key={tb.teamIndex}
                team={entry.teams[tb.teamIndex] ?? null}
                characterId={entry.characterId}
                breakdown={tb}
                accountData={accountData}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
