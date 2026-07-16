import {
  AlertCircle,
  BarChart2,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getExpectedE0,
  runRedesignedCalculation,
} from "@/lib/ercalc/redesignedCalculator";
import { parseRedesignedInput } from "@/lib/ercalc/redesignedParser";
import type {
  RedesignedCharTiming,
  RedesignedInput,
  RedesignedResultItem,
  RedesignedSuperTableCol,
} from "@/lib/ercalc/types";
import { cn } from "@/lib/utils";

// Example text from the NGA document
const DEFAULT_EXAMPLE = `【队伍编码 N】
N=｛1哥伦比娅60, 33菲林斯(30,80), 1伊涅芙60, 03砂糖(0,80)｝

【轴长 C】
C=｛24, 20, 20, 24｝

【动作序列 P】
P=｛3EQ1QE4QE2QEEQAAAAAEQAAAAAEQ1QE3QE4E2EEQAAAAAEQAAAAAEQ｝

【动作耗时 t_i】
t_i:=｛t_Q=1, t_E=1, t_A=0.8｝

【元素属性】
元素属性：哥伦比娅(水), 菲林斯(雷), 伊涅芙(雷), 砂糖(风)

【元素微粒参数】
哥伦比娅: δ=4, Tprod=25, e₀={1(0.66),2(0.33)}
菲林斯:   δ=2, Tprod=10, e₀=1.0
伊涅芙:   δ=2, Tprod=20, e₀={0(0.33),1(0.66)}
砂糖:     δ=1, Tprod=0.4, e₀=4.0

【周期性回复】
哥伦比娅: S=86, n=3, d_in=0.18, V=1, P=2
  T1: 2.28, 15, 4, 1
  T2: 0, 18, 14, 1
  T3: 2.28, 15, 8, 0.1
菲林斯:   S=86, n=3, d_in=0.18, V=14, P=1
  T1: 6.86, 14, 12, 1
  T2: 2.28, 15, 8, 0.7
  T3: 2.28, 5.5, 8, 1
伊涅芙、砂糖: 无`;

export function RedesignedErView() {
  const { t } = useLanguage();
  const [inputText, setInputText] = useState(DEFAULT_EXAMPLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [parsedInput, setParsedInput] = useState<RedesignedInput | null>(null);
  const [timings, setTimings] = useState<RedesignedCharTiming[]>([]);
  const [groupA, setGroupA] = useState<
    Record<
      string,
      {
        E: number;
        Q_same_front: number;
        Q_same_back: number;
        Q_diff_back: number;
      }
    >
  >({});
  const [groupB, setGroupB] = useState<
    Record<string, { avg: number; min: number; max: number }>
  >({});
  const [erResults, setErResults] = useState<RedesignedResultItem[]>([]);
  const [superTable, setSuperTable] = useState<RedesignedSuperTableCol[]>([]);

  const handleRun = () => {
    try {
      setErrorMsg(null);
      const parsed = parseRedesignedInput(inputText);
      if (parsed.charOrders.length === 0) {
        throw new Error(t.ui("redesignedEr.noCharactersParsed"));
      }
      const res = runRedesignedCalculation(parsed);

      setParsedInput(parsed);
      setTimings(res.timings);
      setGroupA(res.groupA);
      setGroupB(res.groupB);
      setErResults(res.erResults);
      setSuperTable(res.superTable);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setParsedInput(null);
    }
  };

  const loadExample = () => {
    setInputText(DEFAULT_EXAMPLE);
    setErrorMsg(null);
  };

  // Helper for element badges
  const elementColors: Record<string, string> = {
    水: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    雷: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    风: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    火: "bg-red-500/10 text-red-400 border-red-500/20",
    冰: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    草: "bg-green-500/10 text-green-400 border-green-500/20",
    岩: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Introduction Card */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <Sparkles className="w-24 h-24 text-primary" />
        </div>
        <div className="max-w-3xl space-y-2">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            {t.ui("redesignedEr.title")}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t.ui("redesignedEr.description")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input area */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                {t.ui("redesignedEr.metadataInput")}
              </span>
              <button
                type="button"
                onClick={loadExample}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                {t.ui("redesignedEr.loadExample")}
              </button>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t.ui("redesignedEr.metadataPlaceholder")}
              className="w-full h-[400px] text-xs font-mono p-3 bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40 resize-y"
            />

            {errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-mono leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleRun}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/95 transition flex items-center justify-center gap-2 text-sm shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              {t.ui("redesignedEr.runCalculation")}
            </button>
          </div>
        </div>

        {/* Results area */}
        <div className="lg:col-span-2 space-y-6">
          {!parsedInput ? (
            <div className="h-[500px] rounded-xl border border-dashed border-border bg-card flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="rounded-full bg-muted p-4">
                <Play className="w-8 h-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-sm font-medium text-foreground">
                {t.ui("redesignedEr.noCalculationExecuted")}
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                {t.ui("redesignedEr.noCalculationDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Timing Table */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t.ui("redesignedEr.timelineBounds")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.format(
                      "redesignedEr.axisDescription",
                      parsedInput.axisLengths[0],
                      parsedInput.axisLengths[1]
                    )}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-medium">
                        <th className="py-2 px-3">
                          {t.ui("teamComp.analyzerChart")}
                        </th>
                        <th className="py-2 px-3">
                          {t.ui("erCalc.enemyOrbElement")}
                        </th>
                        <th className="py-2 px-3">
                          {t.ui("redesignedEr.actions")}
                        </th>
                        <th className="py-2 px-3">
                          {t.ui("redesignedEr.entryTime")}
                        </th>
                        <th className="py-2 px-3">
                          {t.ui("redesignedEr.exitTime")}
                        </th>
                        <th className="py-2 px-3">
                          {t.ui("redesignedEr.fieldTime")}
                        </th>
                        <th className="py-2 px-3">
                          {t.ui("redesignedEr.offFieldTime")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {timings.map((char) => (
                        <tr key={char.name} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            {char.name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={cn(
                                "px-2 py-0.5 text-[10px] rounded border",
                                elementColors[char.element] ||
                                  "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {char.element}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {char.actionCount}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {char.tIn.toFixed(3)}s
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {char.tOut.toFixed(3)}s
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {(char.tOut - char.tIn).toFixed(3)}s
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {(
                              parsedInput.axisLengths[0] -
                              (char.tOut - char.tIn)
                            ).toFixed(3)}
                            s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Group A (Particles) Table */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t.ui("redesignedEr.particleOutput")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.ui("redesignedEr.particleDescription")}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-medium">
                        <th className="py-2 px-3">
                          {t.ui("teamComp.analyzerChart")}
                        </th>
                        <th className="py-2 px-3">
                          {t.ui("redesignedEr.particleParams")}
                        </th>
                        <th className="py-2 px-3 text-right">
                          {t.ui("redesignedEr.effectiveParticles")}
                        </th>
                        <th className="py-2 px-3 text-right">
                          {t.ui("redesignedEr.qSameFront")}
                        </th>
                        <th className="py-2 px-3 text-right">
                          {t.ui("redesignedEr.qSameBack")}
                        </th>
                        <th className="py-2 px-3 text-right">
                          {t.ui("redesignedEr.qDifferentBack")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {timings.map((char) => {
                        const val = groupA[char.name];
                        const cfg = parsedInput.particles[char.name];
                        if (!val || !cfg) return null;
                        const expectedE0 = getExpectedE0(cfg.e0);
                        return (
                          <tr key={char.name} className="hover:bg-muted/30">
                            <td className="py-2.5 px-3 font-sans font-medium text-foreground">
                              {char.name}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] font-sans text-muted-foreground">
                              δ={cfg.delta}s, T_prod={cfg.tProd}s, e₀=
                              {typeof cfg.e0 === "number"
                                ? cfg.e0
                                : expectedE0.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                              {val.E.toFixed(3)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-400">
                              {val.Q_same_front.toFixed(3)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-teal-400">
                              {val.Q_same_back.toFixed(3)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-blue-400">
                              {val.Q_diff_back.toFixed(3)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Group B (Recoveries) Table */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t.ui("redesignedEr.flatRecoveries")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.ui("redesignedEr.flatRecoveryDescription")}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-medium">
                        <th className="py-2 px-3">
                          {t.ui("teamComp.analyzerChart")}
                        </th>
                        <th className="py-2 px-3">
                          {t.ui("redesignedEr.recoveryItem")}
                        </th>
                        <th className="py-2 px-3 text-right">
                          {t.ui("redesignedEr.average")}
                        </th>
                        <th className="py-2 px-3 text-right">
                          {t.ui("redesignedEr.minimum")}
                        </th>
                        <th className="py-2 px-3 text-right">
                          {t.ui("redesignedEr.maximum")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {timings.map((char) => {
                        const val = groupB[char.name];
                        const cfg = parsedInput.recoveries[char.name];
                        if (!val) return null;
                        const displayRecoveries =
                          cfg && cfg.S > 0
                            ? `S=${cfg.S}s, n=${cfg.n}, V=${cfg.V}, P=${cfg.P}`
                            : t.ui("common.none");
                        return (
                          <tr key={char.name} className="hover:bg-muted/30">
                            <td className="py-2.5 px-3 font-sans font-medium text-foreground">
                              {char.name}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] font-sans text-muted-foreground">
                              {displayRecoveries}
                            </td>
                            <td className="py-2.5 px-3 text-right text-foreground">
                              {val.avg.toFixed(3)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground">
                              {val.min.toFixed(3)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground">
                              {val.max.toFixed(3)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ER Results Table */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t.ui("redesignedEr.erResults")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.ui("redesignedEr.erResultsDescription")}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-medium text-left">
                        <th className="py-2 px-3">
                          {t.ui("teamComp.analyzerChart")}
                        </th>
                        <th className="py-2 px-3">
                          {t.ui("triage.detail.demand")}
                        </th>
                        <th className="py-2 px-3 text-right">
                          {t.ui("redesignedEr.demandValue")}
                        </th>
                        <th className="py-2 px-3 text-right">
                          {t.ui("redesignedEr.erRange")}
                        </th>
                        <th className="py-2 px-3 text-right">
                          {t.ui("redesignedEr.recommendedEr")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {erResults.flatMap((char) =>
                        char.demandLabels.map((label, dIdx) => {
                          const D = char.demands[dIdx];
                          const er = char.erNeeded[label];
                          const isOverflow = er.avg === 0;
                          return (
                            <tr
                              key={`${char.name}-${label}`}
                              className="hover:bg-muted/30 text-xs"
                            >
                              {dIdx === 0 ? (
                                <td
                                  className="py-2.5 px-3 font-medium text-foreground border-r border-border/40 align-middle"
                                  rowSpan={char.demandLabels.length}
                                >
                                  {char.name}
                                </td>
                              ) : null}
                              <td className="py-2.5 px-3 text-muted-foreground font-mono">
                                {label}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                                {D.toFixed(1)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                {isOverflow ? (
                                  <span className="text-muted-foreground/60 italic">
                                    {t.ui("redesignedEr.overflow")}
                                  </span>
                                ) : (
                                  <span className="text-foreground">
                                    {er.avg.toFixed(2)}%
                                    <span className="text-[11px] text-muted-foreground ml-1">
                                      ({er.min.toFixed(2)}%, {er.max.toFixed(2)}
                                      %)
                                    </span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold">
                                {isOverflow ? (
                                  <span className="text-muted-foreground">
                                    100%
                                  </span>
                                ) : (
                                  <span className="text-primary font-mono text-sm">
                                    {er.recommended.toFixed(0)}%
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Super Table (Cartesian Probabilities) */}
              {superTable.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                  <div className="border-b border-border pb-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t.ui("redesignedEr.probabilityMatrix")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.ui("redesignedEr.probabilityMatrixDescription")}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground font-medium text-left">
                          <th className="py-2 px-3">
                            {t.ui("redesignedEr.combinations")}
                          </th>
                          <th className="py-2 px-3 text-right">
                            {t.ui("redesignedEr.probability")}
                          </th>
                          {erResults.map((char) => (
                            <th
                              key={char.name}
                              className="py-2 px-3 text-right"
                            >
                              {char.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono">
                        {superTable.map((col, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="py-2.5 px-3 text-left whitespace-pre-line font-sans text-muted-foreground leading-normal">
                              {col.header}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                              {(col.prob * 100).toFixed(2)}%
                            </td>
                            {erResults.map((char) => (
                              <td
                                key={char.name}
                                className="py-2.5 px-3 text-right"
                              >
                                {col.cells[char.name] || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
