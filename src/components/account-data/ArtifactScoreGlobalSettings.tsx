import { CircleHelp, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ScoreChangeDialogTrigger } from "@/components/account-data/ScoreChangeAnnouncement";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/contexts/LanguageContext";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";

function ScoreExplanationDialog() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="w-6 h-6 text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10 ml-1 transition-all duration-300 hover:scale-110 active:scale-95"
      >
        <CircleHelp className="w-4 h-4" />
      </Button>
      <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveDialogContent className="md:max-w-2xl bg-slate-950 border-slate-800 text-slate-200">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t.ui("scoreExplanation.title")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t.ui("scoreExplanation.description")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-6 pt-2 text-sm overflow-y-auto flex-1 px-4 md:px-0 md:pr-2">
            <div className="space-y-2">
              <div className="p-3 rounded-md bg-slate-900 border border-slate-800 font-mono text-amber-200/90 text-center text-xs sm:text-sm">
                {t.ui("scoreExplanation.formula")}
              </div>
              <div className="p-3 rounded-md bg-slate-900 border border-slate-800 font-mono text-slate-300 text-center text-xs">
                {t.ui("scoreExplanation.subFormula")}
              </div>
            </div>

            {/* Section 1: 300-Point Scale */}
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-100 flex items-center gap-2">
                <span className="bg-amber-500/20 text-amber-500 w-5 h-5 rounded-full flex items-center justify-center text-xs border border-amber-500/50">
                  1
                </span>
                {t.ui("scoreExplanation.scale300.title")}
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                {t.ui("scoreExplanation.scale300.description")}
              </p>
            </div>

            {/* Section 2: Main Stat Scoring */}
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-100 flex items-center gap-2">
                <span className="bg-amber-500/20 text-amber-500 w-5 h-5 rounded-full flex items-center justify-center text-xs border border-amber-500/50">
                  2
                </span>
                {t.ui("scoreExplanation.mainStat.title")}
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                {t.ui("scoreExplanation.mainStat.description")}
              </p>
            </div>

            {/* Section 3: CD-Equiv Factors */}
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-100 flex items-center gap-2">
                <span className="bg-amber-500/20 text-amber-500 w-5 h-5 rounded-full flex items-center justify-center text-xs border border-amber-500/50">
                  3
                </span>
                {t.ui("scoreExplanation.normalization.title")}
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                {t.ui("scoreExplanation.normalization.description")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-slate-400 text-xs font-mono bg-slate-900/50 p-3 rounded border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                  {t.ui("scoreExplanation.factors.cr")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                  {t.ui("scoreExplanation.factors.cd")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500/50" />
                  {t.ui("scoreExplanation.factors.atk")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                  {t.ui("scoreExplanation.factors.em")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                  {t.ui("scoreExplanation.factors.er")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                  {t.ui("scoreExplanation.factors.def")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50" />
                  {t.ui("scoreExplanation.factors.ele")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500/50" />
                  {t.ui("scoreExplanation.factors.phys")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500/50" />
                  {t.ui("scoreExplanation.factors.heal")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500/30" />
                  {t.ui("scoreExplanation.factors.flatAtk")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/30" />
                  {t.ui("scoreExplanation.factors.flatHp")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/30" />
                  {t.ui("scoreExplanation.factors.flatDef")}
                </div>
              </div>
            </div>

            {/* Section 4: Weights */}
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-100 flex items-center gap-2">
                <span className="bg-amber-500/20 text-amber-500 w-5 h-5 rounded-full flex items-center justify-center text-xs border border-amber-500/50">
                  4
                </span>
                {t.ui("scoreExplanation.weight.title")}
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                {t.ui("scoreExplanation.weight.description")}
              </p>
            </div>

            {/* Section 5: Punishment Factor */}
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-100 flex items-center gap-2">
                <span className="bg-amber-500/20 text-amber-500 w-5 h-5 rounded-full flex items-center justify-center text-xs border border-amber-500/50">
                  5
                </span>
                {t.ui("accountData.punishmentFactor")}
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                {t.ui("scoreExplanation.punishment.description")}
              </p>
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

export function ArtifactScoreGlobalSettings() {
  const { t } = useLanguage();
  const config = useArtifactScoreStore((s) => s.config);
  const setGlobalWeight = useArtifactScoreStore((s) => s.setGlobalWeight);
  const resetGlobalConfig = useArtifactScoreStore((s) => s.resetGlobalConfig);

  return (
    <Card className="bg-gradient-card shrink-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-bold text-white">
            {t.ui("accountData.punishmentFactor")}
          </CardTitle>
          <ScoreExplanationDialog />
          <span className="text-muted-foreground text-xs">·</span>
          <ScoreChangeDialogTrigger />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-white"
          onClick={resetGlobalConfig}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {t.ui("common.reset")}
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 pb-4">
        {(["flatAtk", "flatHp", "flatDef"] as const).map((key) => (
          <div key={key} className="flex items-center gap-3 max-w-xs">
            <span className="text-sm text-foreground shrink-0">
              {key === "flatAtk"
                ? t.ui("accountData.flatAtk")
                : key === "flatHp"
                  ? t.ui("accountData.flatHp")
                  : t.ui("accountData.flatDef")}
            </span>
            <Slider
              value={[config.global[key]]}
              min={0}
              max={100}
              step={5}
              onValueChange={([val]) => setGlobalWeight(key, val)}
              className="flex-1"
            />
            <span className="font-mono text-foreground font-bold w-10 text-right shrink-0">
              {config.global[key]}%
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
