import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { Element } from "@/data/types";
import type {
  AnalyzerCharConfig,
  ComboCountOverrides,
  MinErOverrides,
} from "@/lib/team-comp/analyzer";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import type { ExtraBuff } from "@/lib/team-comp/extraBuffTypes";
import type {
  ComboFormula,
  ReactionOverride,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { ChevronDown, ListOrdered } from "lucide-react";
import { useState } from "react";
import { AnalyzerComboTab } from "./AnalyzerComboTab";
import { ExtraBuffsPanel } from "./ExtraBuffsPanel";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

// ─── Props ───

interface AnalyzerComboCardProps {
  teamBuild: TeamBuild;
  charConfigs: AnalyzerCharConfig[];
  configs: TeamSlotConfig[];
  templateCombo: ComboFormula;
  comboOverrides: ComboCountOverrides;
  minErOverrides: MinErOverrides;
  reactionOverrides: Record<string, ReactionOverride>;
  onComboOverridesChange: (overrides: ComboCountOverrides) => void;
  onMinErOverridesChange: (overrides: MinErOverrides) => void;
  onReactionChange: (stableKey: string, override: ReactionOverride) => void;
  // Environment settings (local, not persisted)
  envTeam: Team;
  updateEnvTeam: (id: string, patch: Partial<Team>) => void;
  localEnemyAura: Element | undefined;
  onEnemyAuraChange: (el: Element | undefined) => void;
  t: ReturnType<typeof useLanguage>["t"];
}

// ─── Main Card ───

export function AnalyzerComboCard({
  teamBuild,
  charConfigs,
  configs,
  templateCombo,
  comboOverrides,
  minErOverrides,
  reactionOverrides,
  onComboOverridesChange,
  onMinErOverridesChange,
  onReactionChange,
  envTeam,
  updateEnvTeam,
  localEnemyAura,
  onEnemyAuraChange,
  t,
}: AnalyzerComboCardProps) {
  const [comboOpen, setComboOpen] = useState(true);

  return (
    <Collapsible open={comboOpen} onOpenChange={setComboOpen}>
      <Card className={CARD_CLS}>
        <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 w-full text-left"
            >
              <span className={CARD_TITLE_CLS}>
                <ListOrdered className="w-4 h-4 opacity-70" />
                {t.ui("teamComp.analyzerCombo")}
              </span>
              <ChevronDown
                className={`w-4 h-4 ml-auto text-primary-foreground/70 transition-transform ${comboOpen ? "" : "-rotate-90"}`}
              />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className={CARD_BODY_CLS}>
            <div className="flex flex-col gap-2 items-center">
              {/* Environment settings */}
              <div className="flex items-center">
                <ExtraBuffsPanel
                  team={envTeam}
                  updateTeam={updateEnvTeam}
                  enemyAura={localEnemyAura}
                  onEnemyAuraChange={onEnemyAuraChange}
                  t={t}
                />
              </div>
              {/* Combo grid */}
              <AnalyzerComboTab
                teamBuild={teamBuild}
                charConfigs={charConfigs}
                baseConfigs={configs}
                templateCombo={templateCombo}
                comboOverrides={comboOverrides}
                minErOverrides={minErOverrides}
                reactionOverrides={reactionOverrides}
                onComboOverridesChange={onComboOverridesChange}
                onMinErOverridesChange={onMinErOverridesChange}
                onReactionChange={onReactionChange}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
