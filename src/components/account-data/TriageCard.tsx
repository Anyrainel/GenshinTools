import { ChevronDown, ChevronUp, Info, ShieldAlert } from "lucide-react";
import { ArtifactStatList } from "@/components/shared/ArtifactStatList";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  EmbryoResult,
  TriageDecision,
} from "@/lib/account-data/triage/types";
import { cn } from "@/lib/utils";
import { getRarityColor, getTriageTierColor } from "../shared/colors";

export type TriageCardSection =
  | "recommendLock"
  | "recommendUnlock"
  | "noChange"
  | "protected";

// Helpers

type T = ReturnType<typeof useLanguage>["t"];

const RULE_KEY = {
  TP: "triage.rule.TP",
  TQ: "triage.rule.TQ",
  QB: "triage.rule.QB",
  NK: "triage.rule.NK",
  TN: "triage.rule.TN",
  TF: "triage.rule.TF",
  TD: "triage.rule.TD",
} as const;

const TIER_KEY = {
  P: "triage.tier.P",
  Q: "triage.tier.Q",
  N: "triage.tier.N",
  T: "triage.tier.T",
  FLEX: "triage.tier.FLEX",
} as const;

const CHIP_KEY = {
  suggestLock: "triage.chip.suggestLock",
  suggestUnlock: "triage.chip.suggestUnlock",
  locked: "triage.chip.locked",
  unlocked: "triage.chip.unlocked",
  protected: "triage.chip.protected",
} as const;

const SP_KEY = {
  SP1: "triage.sp.SP1",
  SP3: "triage.sp.SP3",
  SP4: "triage.sp.SP4",
  SP5: "triage.sp.SP5",
  SP6: "triage.sp.SP6",
  SP7: "triage.sp.SP7",
  FLEX: "triage.sp.FLEX",
} as const;

function formatRule(
  ruleId: string,
  reasonArgs: (string | number)[],
  t: T
): string {
  const key = RULE_KEY[ruleId as keyof typeof RULE_KEY];
  if (!key) return "";
  let text = t.ui(key);
  if (text === key) return "";
  for (let i = 0; i < reasonArgs.length; i++) {
    text = text.replace(`{${i}}`, String(reasonArgs[i]));
  }
  return text;
}

function tierName(tier: string, t: T): string {
  const key = TIER_KEY[tier as keyof typeof TIER_KEY];
  return key ? t.ui(key) : tier;
}

function strategicValueStatLabel(reason: string, t: T): string {
  if (reason === "concentrated-crit") {
    return `${t.statShort("cr")}+${t.statShort("cd")}`;
  }
  return t.statShort(reason.replace("concentrated-", ""));
}

function spName(sp: string, t: T): string {
  if (sp.startsWith("SV:")) {
    const reason = sp.slice(3);
    return t.format(
      "triage.sv.concentratedStat",
      strategicValueStatLabel(reason, t)
    );
  }
  const key = SP_KEY[sp as keyof typeof SP_KEY];
  return key ? t.ui(key) : sp;
}

function strategicValueReason(decision: TriageDecision, t: T): string | null {
  const svRule = decision.specialRules.find((sp) => sp.startsWith("SV:"));
  if (!svRule) return null;
  return `${t.ui("triage.detail.lockReason")}: ${spName(svRule, t)}`;
}

function demandSourceLabel(result: EmbryoResult, t: T): string {
  const src = result.embryo.demand.demandSource;
  if (src.type === "4pc") return t.ui("computeFilters.fourPc");
  if (src.type === "2pc") return t.ui("computeFilters.twoPc");
  return t.ui("triage.rulePrefixFlex");
}

function groupableDemandSourceKey(result: EmbryoResult): string | null {
  const src = result.embryo.demand.demandSource;
  if (src.type === "2pc") return null;
  return src.type === "4pc" ? `4pc:${src.setKey}` : "flex";
}

function groupEvaluationResults(results: EmbryoResult[]) {
  const groups: Array<{
    key: string;
    results: EmbryoResult[];
  }> = [];
  const groupIndex = new Map<string, number>();

  for (const result of results) {
    const sourceKey = groupableDemandSourceKey(result);
    const key = sourceKey && result.tier ? `${result.tier}:${sourceKey}` : null;

    if (!key) {
      groups.push({ key: `single:${groups.length}`, results: [result] });
      continue;
    }

    const existingIndex = groupIndex.get(key);
    if (existingIndex == null) {
      groupIndex.set(key, groups.length);
      groups.push({ key, results: [result] });
    } else {
      groups[existingIndex].results.push(result);
    }
  }

  return groups;
}

// Tier Badge

function TierBadge({
  tier,
  colorTier = tier,
}: {
  tier: string;
  colorTier?: string;
}) {
  const { t } = useLanguage();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center h-5 px-1 rounded text-[10px] font-bold border shrink-0",
        getTriageTierColor(colorTier, "badge")
      )}
    >
      {tierName(tier, t)}
    </span>
  );
}

// Chip color per section. Tabs 1-2 use saturated green/red for the
// "suggest" recommendations; tab 3 uses a less saturated version for
// status-only display; tab 4 uses a dimmed amber for the protected zone.
const CHIP_COLOR = {
  suggestLock: "border-green-500/40 text-green-400",
  suggestUnlock: "border-red-500/40 text-red-400",
  locked: "border-green-500/25 text-green-500/70",
  unlocked: "border-red-500/25 text-red-500/70",
  protected: "border-amber-500/25 text-amber-500/60",
} as const;

// Triage Card

export function TriageCard({
  decision,
  expanded,
  onToggle,
  section,
}: {
  decision: TriageDecision;
  expanded: boolean;
  onToggle: () => void;
  section: TriageCardSection;
}) {
  const { t } = useLanguage();
  const { artifact } = decision;
  const setName = t.artifact(artifact.setKey);
  const dr = decision.decidingResult;
  const isProtected = section === "protected";
  const isNoDemandDecision = dr?.ruleId === "TD";
  const strategicValueText = strategicValueReason(decision, t);
  const showFlexTierBadge =
    dr?.tier != null &&
    (dr.tier === "N" || dr.tier === "T") &&
    decision.specialRules.includes("FLEX");

  const chipKind: keyof typeof CHIP_COLOR =
    section === "recommendLock"
      ? "suggestLock"
      : section === "recommendUnlock"
        ? "suggestUnlock"
        : section === "protected"
          ? "protected"
          : artifact.lock
            ? "locked"
            : "unlocked";

  return (
    <Card
      className="bg-gradient-card border-border/50 overflow-hidden cursor-pointer h-full"
      onClick={onToggle}
    >
      <CardContent className="p-3 h-full flex flex-col">
        <div className="flex items-center gap-3">
          <ItemIcon
            artifactSetId={artifact.setKey}
            slot={artifact.slotKey}
            rarity={artifact.rarity}
            level={`+${artifact.level}`}
            lock={artifact.lock}
            size="sm"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {/* Row 1: set name + tier badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium truncate",
                      getRarityColor(artifact.rarity, "text")
                    )}
                  >
                    {setName}
                  </span>
                  {dr?.tier && !isProtected && (
                    <TierBadge
                      tier={showFlexTierBadge ? "FLEX" : dr.tier}
                      colorTier={showFlexTierBadge ? "P" : dr.tier}
                    />
                  )}
                </div>
                {/* Row 2: slot · mainstat */}
                <div className="text-xs text-muted-foreground">
                  {t.slot(artifact.slotKey)} ·{" "}
                  {t.statShort(artifact.mainStatKey)}
                </div>
              </div>

              <div className="flex shrink-0 self-stretch items-center">
                {/* Status/action chip (per section) */}
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-xs", CHIP_COLOR[chipKind])}
                >
                  {t.ui(CHIP_KEY[chipKind])}
                </Badge>
              </div>
            </div>

            {/* Row 3: single reason line — sp rules take priority */}
            {(() => {
              let spRules = decision.specialRules;
              if (isProtected) {
                spRules = spRules.includes("SP3")
                  ? ["SP3"]
                  : spRules.filter((sp) => sp === "SP4");
              }
              if (spRules.length > 0) {
                return (
                  <div className="text-xs mt-0.5 flex items-start gap-1 text-amber-400">
                    <ShieldAlert className="w-3 h-3 shrink-0" />
                    <span className="min-w-0">
                      {spRules.map((sp) => spName(sp, t)).join(", ")}
                    </span>
                  </div>
                );
              }
              if (dr && !isProtected) {
                const ruleText = formatRule(dr.ruleId, dr.reasonArgs, t);
                if (ruleText) {
                  return (
                    <div className="text-xs mt-0.5 flex items-start gap-1 text-amber-400">
                      <Info className="w-3 h-3 shrink-0" />
                      <span className="min-w-0">{ruleText}</span>
                    </div>
                  );
                }
              }
              return null;
            })()}
          </div>

          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border bg-card/60 -mx-3 -mb-3 px-3 pb-3 rounded-b-xl flex-1">
            <div className="flex gap-4">
              {/* Left: artifact substats */}
              <div className="shrink-0 min-w-36 bg-card/60 rounded-lg p-2">
                <ArtifactStatList artifact={artifact} compact />
              </div>

              {/* Right: evaluation details */}
              <div className="flex-1 min-w-0 space-y-2 text-xs">
                {strategicValueText && (
                  <div className="text-amber-400">{strategicValueText}</div>
                )}

                {/* Supply/demand context */}
                {decision.supplyDemand && !isNoDemandDecision && (
                  <div className="text-muted-foreground space-y-0.5">
                    {dr?.embryo?.demand.coreStats && (
                      <div className="text-xs text-foreground">
                        {t.ui("computeFilters.subStat")}: [
                        {dr.embryo.demand.coreStats
                          .map((s) => t.statShort(s))
                          .join("+")}
                        ]
                      </div>
                    )}
                    <div>
                      {t.ui("triage.detail.demand")}:{" "}
                      {decision.supplyDemand.demand}
                    </div>
                    <div>
                      {decision.supplyDemand.demand > 0 ? (
                        <>
                          {t.ui("triage.detail.supply")}:{" "}
                          {decision.supplyDemand.supplyByTier.P}{" "}
                          {tierName("P", t)}
                          {" / "}
                          {decision.supplyDemand.supplyByTier.Q}{" "}
                          {tierName("Q", t)}
                        </>
                      ) : (
                        <>
                          {t.ui("triage.detail.supply")}:{" "}
                          {decision.supplyDemand.tierTotal} {tierName("T", t)}
                        </>
                      )}
                    </div>
                    {dr?.tier &&
                      (dr.tier === "Q" || dr.tier === "N") &&
                      decision.supplyDemand.demand > 0 && (
                        <div>
                          {t
                            .ui("triage.detail.rankInTier")
                            .replace(
                              "{0}",
                              String(decision.supplyDemand.rankInTier)
                            )
                            .replace(
                              "{1}",
                              String(decision.supplyDemand.tierTotal)
                            )
                            .replace("{2}", tierName(dr.tier, t))}
                        </div>
                      )}
                  </div>
                )}

                {/* All character evaluations (skip T tier — no meaningful match) */}
                {decision.allResults.some((r) => r.tier !== "T") && (
                  <div className="border-t border-border/50 pt-1.5 space-y-0.5">
                    {groupEvaluationResults(
                      decision.allResults.filter((r) => r.tier !== "T")
                    ).map((group) => {
                      const [first] = group.results;
                      const chars = group.results
                        .map((r) => t.character(r.embryo.demand.characterId))
                        .join(", ");
                      const shape = demandSourceLabel(first, t);
                      const isDeciding =
                        dr != null && group.results.includes(dr);
                      return (
                        <div
                          key={group.key}
                          className={cn(
                            "flex items-start gap-1",
                            isDeciding
                              ? "text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {first.tier && <TierBadge tier={first.tier} />}
                          <span className="min-w-0">
                            {chars}{" "}
                            <span className="text-muted-foreground">
                              ({shape})
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
