import { BarChart3, Box, Lightbulb, Lock, Monitor, Users } from "lucide-react";
import { BuildEvaluationCard } from "@/components/game-account/BuildEvaluationCard";
import { ScoreUpActionCard } from "@/components/game-account/ScoreUpActionCard";
import { TriageCard } from "@/components/game-account/TriageCard";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/domain/reference/catalog";
import {
  PREVIEW_ARTIFACT_LOOKUP,
  PREVIEW_EVALUATION,
  PREVIEW_RECOMMENDATIONS,
  PREVIEW_TRIAGE_LOCK,
  PREVIEW_TRIAGE_UNLOCK,
} from "./previewData";
import { TabPreview } from "./TabPreview";

type PreviewProps = { t: ReturnType<typeof useLanguage>["t"] };

export default function AccountDataPreview({ t }: PreviewProps) {
  return (
    <TabPreview
      tabs={[
        {
          id: "characters",
          icon: Users,
          label: t.ui("accountData.characters"),
        },
        { id: "inventory", icon: Box, label: t.ui("accountData.inventory") },
        {
          id: "recommendations",
          icon: Lightbulb,
          label: t.ui("accountData.recommendations"),
        },
        {
          id: "evaluation",
          icon: BarChart3,
          label: t.ui("evaluation.tabLabel"),
        },
        { id: "triage", icon: Lock, label: t.ui("triage.tabLabel") },
      ]}
      t={t}
      panels={[
        {
          content: <CharactersContent t={t} />,
          description: t.ui("greeting.previewCharacters"),
        },
        {
          content: <InventoryContent t={t} />,
          description: t.ui("greeting.previewInventory"),
        },
        {
          content: <ScoreUpContent t={t} />,
          description: t.ui("greeting.previewRecommendations"),
        },
        {
          content: <EvaluationContent t={t} />,
          description: t.ui("greeting.previewEvaluation"),
        },
        {
          content: <TriageContent t={t} />,
          description: t.ui("greeting.previewTriage"),
        },
      ]}
    />
  );
}

/** Characters — ItemIcon + CharacterInfo + ArtifactScore */
function CharactersContent({ t }: PreviewProps) {
  const charInfo = charactersById.furina;
  return (
    <div className="flex items-center gap-3">
      <ItemIcon characterId="furina" badge={1} level="Lv.90" size="sm" />

      {/* CharacterInfo — scaled down to fit compactly */}
      <div className="pointer-events-none min-w-0 flex-1 origin-left scale-[0.8]">
        {charInfo && (
          <CharacterInfo
            character={charInfo}
            showDate={false}
            className="gap-0.5"
            nameClassName="text-sm"
          />
        )}
      </div>

      {/* Score display — matches ArtifactScoreHoverCard trigger */}
      <div className="flex flex-col items-end gap-0 shrink-0">
        <div className="flex items-baseline gap-1">
          <span className="text-foreground font-bold leading-none not-italic text-sm">
            {t.ui("accountData.statCount")}
          </span>
          <span className="italic text-sky-300 tracking-tighter leading-none font-extrabold text-3xl pr-[2px]">
            38.2
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-foreground font-bold leading-none not-italic text-sm">
            {t.ui("accountData.score")}
          </span>
          <span className="italic bg-linear-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text text-transparent tracking-tighter leading-none font-black text-3xl pr-[2px]">
            268
          </span>
        </div>
      </div>
    </div>
  );
}

/** Inventory — weapon + artifact ItemIcons with section labels */
function InventoryContent({ t }: PreviewProps) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-xs font-semibold text-foreground mb-1 block">
          {t.ui("accountData.weapons")}
        </span>
        <div className="flex flex-wrap gap-1">
          <ItemIcon weaponId="absolution" size="md" badge={1} />
          <ItemIcon weaponId="the_black_sword" size="md" badge={5} lock />
          <ItemIcon weaponId="favonius_sword" size="md" badge={3} />
          <ItemIcon weaponId="azurelight" size="md" badge={1} />
          <ItemIcon weaponId="lions_roar" size="md" badge={2} />
        </div>
      </div>
      <div>
        <span className="text-xs font-semibold text-foreground mb-1 block">
          {t.ui("accountData.artifacts")}
        </span>
        <div className="flex flex-wrap gap-1">
          <ItemIcon
            artifactSetId="obsidian_codex"
            slot="flower"
            size="md"
            lock
            badge="⭐"
          />
          <ItemIcon
            artifactSetId="night_of_the_skys_unveiling"
            slot="plume"
            size="md"
          />
          <ItemIcon
            artifactSetId="gladiators_finale"
            slot="sands"
            size="md"
            lock
          />
          <ItemIcon
            artifactSetId="emblem_of_severed_fate"
            slot="goblet"
            size="md"
          />
          <ItemIcon
            artifactSetId="viridescent_venerer"
            slot="circlet"
            size="md"
            badge="⭐"
          />
        </div>
      </div>
    </div>
  );
}

/** ScoreUp card */
function ScoreUpContent({ t }: PreviewProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 mb-2">
        <ItemIcon characterId="mavuika" size="sm" />
        <span className="text-sm font-semibold">{t.character("mavuika")}</span>
      </div>
      <div className="pointer-events-none space-y-1.5">
        {PREVIEW_RECOMMENDATIONS.map((rec) => (
          <ScoreUpActionCard
            key={rec.slot}
            recommendation={rec}
            artifactLookup={PREVIEW_ARTIFACT_LOOKUP}
            inline
          />
        ))}
      </div>
    </div>
  );
}

/** Evaluation — real BuildEvaluationCard */
function EvaluationContent({ t: _t }: PreviewProps) {
  return (
    <div className="pointer-events-none">
      <BuildEvaluationCard evaluation={PREVIEW_EVALUATION} />
    </div>
  );
}

/** Triage — apply button + real TriageCards in collapsed state */
function TriageContent({ t }: PreviewProps) {
  return (
    <div className="pointer-events-none space-y-1.5">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 pointer-events-none"
      >
        <Monitor className="h-4 w-4" />
        {t.ui("manager.applyToGame")}
      </Button>
      <TriageCard
        decision={PREVIEW_TRIAGE_LOCK}
        expanded={false}
        onToggle={() => {}}
        section="recommendLock"
      />
      <TriageCard
        decision={PREVIEW_TRIAGE_UNLOCK}
        expanded={false}
        onToggle={() => {}}
        section="recommendUnlock"
      />
    </div>
  );
}
