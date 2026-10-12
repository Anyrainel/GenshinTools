import { Play, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AccountData } from "@/data/types";
import {
  type AccountInvestmentResult,
  buildAccountInvestmentBaseline,
  computeAccountInvestments,
} from "@/lib/team-comp/analyzer/accountInvestment";
import type {
  AnalyzerCharConfig,
  AnalyzerOptions,
} from "@/lib/team-comp/analyzer/types";
import { fmtDamage } from "@/lib/team-comp/displayFormatter";
import { CARD_CLS, CARD_HEADER_CLS, CARD_TITLE_CLS } from "./cardStyles";

interface AccountInvestmentCardProps {
  account: AccountData | null;
  charConfigs: AnalyzerCharConfig[];
  options: Pick<
    AnalyzerOptions,
    | "teamBuild"
    | "templateCombo"
    | "comboOverrides"
    | "calcContext"
    | "futureCountChanges"
    | "singleObjective"
    | "ignoredContributorIds"
  >;
}

export function AccountInvestmentCard({
  account,
  charConfigs,
  options,
}: AccountInvestmentCardProps) {
  const { t } = useLanguage();
  const baseline = useMemo(
    () =>
      account
        ? buildAccountInvestmentBaseline(
            charConfigs.map((c) => c.charId),
            account
          )
        : null,
    [account, charConfigs]
  );
  const inputKey = JSON.stringify({
    charConfigs,
    combo: options.templateCombo,
    overrides: options.comboOverrides,
    future: options.futureCountChanges,
    single: options.singleObjective,
    ignored: options.ignoredContributorIds,
    context: options.calcContext,
    combat: options.teamBuild.combatOpts,
    aura: options.teamBuild.enemyAura,
    buffs: options.teamBuild.extraBuffs,
  });
  const [computed, setComputed] = useState<{
    account: AccountData;
    key: string;
    result?: AccountInvestmentResult;
    error?: string;
  } | null>(null);
  const current =
    computed?.key === inputKey && computed.account === account
      ? computed
      : null;
  const result = current?.result;
  const run = () => {
    if (!account || !baseline) return;
    try {
      setComputed({
        account,
        key: inputKey,
        result: computeAccountInvestments(
          account,
          baseline,
          charConfigs,
          options
        ),
      });
    } catch (error) {
      setComputed({
        account,
        key: inputKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return (
    <Card className={CARD_CLS}>
      <CardHeader className={CARD_HEADER_CLS}>
        <h3 className={CARD_TITLE_CLS}>
          <TrendingUp className="h-4 w-4 shrink-0" />
          {t.ui("teamComp.investmentNextTitle")}
        </h3>
      </CardHeader>
      <CardContent className="space-y-3 p-3 md:p-5 [container-type:inline-size] [container-name:investments]">
        <p className="text-sm text-muted-foreground">
          {t.ui("teamComp.investmentNextDesc")}
        </p>
        {!baseline && (
          <p className="text-sm text-muted-foreground">
            {t.ui("teamComp.investmentNextNeedsAccount")}
          </p>
        )}
        <Button
          onClick={run}
          disabled={
            !baseline ||
            !options.templateCombo.lines.some((line) => line.count > 0)
          }
          className="h-auto min-h-10 whitespace-normal"
        >
          <Play className="mr-2 h-4 w-4 shrink-0" />
          {t.ui("teamComp.investmentNextRun")}
        </Button>
        {current?.error && (
          <p role="alert" className="text-sm text-destructive break-words">
            {current.error}
          </p>
        )}
        {result && (
          <>
            <p className="text-sm">
              {t.ui("teamComp.investmentNextBaseline")}:{" "}
              <span className="font-semibold tabular-nums">
                {fmtDamage(result.baselineDamage)}
              </span>
            </p>
            {result.recommendations.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t.ui("teamComp.investmentNextEmpty")}
              </p>
            )}
            <ol className="grid grid-cols-1 gap-2 [@container_investments_(min-width:64rem)]:grid-cols-3">
              {result.recommendations.map((item, index) => (
                <li
                  key={`${item.charId}:${item.kind}`}
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background p-3"
                >
                  <span className="shrink-0 text-sm font-bold text-primary">
                    #{index + 1}
                  </span>
                  <ItemIcon characterId={item.charId} size="sm" />
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <p className="break-words font-semibold">
                      {t.character(item.charId)}
                    </p>
                    <p className="break-words">
                      {item.kind === "constellation" ? (
                        `${t.format("common.constellationFormat", item.from)} → ${t.format("common.constellationFormat", item.to)}`
                      ) : (
                        <>
                          {item.weaponId && t.weapon(item.weaponId)}{" "}
                          {item.kind === "refinement"
                            ? `${t.format("common.refinementFormat", item.from)} → ${t.format("common.refinementFormat", item.to)}`
                            : t.format("common.refinementFormat", 1)}
                        </>
                      )}
                    </p>
                    <p className="font-semibold tabular-nums text-primary">
                      {t.ui("teamComp.investmentNextGain")}:{" "}
                      {item.gainPct >= 0 ? "+" : ""}
                      {item.gainPct.toFixed(1)}%
                    </p>
                    <p className="tabular-nums text-muted-foreground">
                      {fmtDamage(item.damage)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </CardContent>
    </Card>
  );
}
