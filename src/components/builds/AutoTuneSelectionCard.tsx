import { Check } from "lucide-react";
import { AutoTuneTeamRow } from "@/components/shared/build-editor/AutoTuneTeamRow";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { NEUTRAL_GAME_COLOR } from "@/config/gameColors";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AccountData, Build } from "@/domain/models";
import { charactersById } from "@/domain/reference/catalog";
import type { TeamComp, TeamSetupConfig } from "@/domain/team/types";
import { parseElement } from "@/domain/validation";
import { getElementHex } from "@/lib/game/colors";
import { cn } from "@/lib/utils";
import { getElementColor } from "../shared/colors";

type SelectionEntry = {
  buildId: string;
  characterId: string;
  build: Build;
  selected: boolean;
  teamComps: TeamComp[];
};

function ArtifactSetIcons({ build }: { build: Build }) {
  if (build.composition === "4pc" && build.artifactSet) {
    return <ItemIcon artifactSetId={build.artifactSet} size="xs" />;
  }
  if (
    build.composition === "2pc+2pc" &&
    build.halfSet1 != null &&
    build.halfSet2 != null
  ) {
    return <ItemIcon halfSetIds={[build.halfSet1, build.halfSet2]} size="xs" />;
  }
  return null;
}

function TeamsTooltip({
  teamComps,
  characterId,
  getTeamSetupConfigById,
  accountData,
}: {
  teamComps: TeamComp[];
  characterId: string;
  getTeamSetupConfigById: (teamId: string) => TeamSetupConfig;
  accountData: AccountData | null;
}) {
  if (teamComps.length === 0) return null;
  return (
    <div className="space-y-1.5 p-2">
      {teamComps.map((teamComp) => (
        <AutoTuneTeamRow
          key={teamComp.id}
          teamComp={teamComp}
          setupConfig={getTeamSetupConfigById(teamComp.id)}
          characterId={characterId}
          enabled={true}
          onToggle={() => {}}
          accountData={accountData}
          hideCheckbox
        />
      ))}
    </div>
  );
}

export function AutoTuneSelectionCard({
  entry,
  onToggle,
  element,
  getTeamSetupConfigById,
  accountData,
}: {
  entry: SelectionEntry;
  onToggle: () => void;
  element: string;
  getTeamSetupConfigById: (teamId: string) => TeamSetupConfig;
  accountData: AccountData | null;
}) {
  const { t } = useLanguage();
  const char = charactersById[entry.characterId];
  const elHex = getElementHex(element) ?? NEUTRAL_GAME_COLOR;
  const elColor = getElementColor(parseElement(element), "text");
  const noTeams = entry.teamComps.length === 0;

  return (
    <div className="relative group">
      <button
        type="button"
        tabIndex={noTeams ? -1 : 0}
        onClick={noTeams ? undefined : onToggle}
        disabled={noTeams}
        className={cn(
          "relative flex items-center gap-1.5 rounded-lg border text-left transition-all",
          "w-full overflow-hidden p-1.5 pl-2",
          noTeams
            ? "border-transparent bg-muted/5 opacity-30 cursor-not-allowed"
            : entry.selected
              ? "border-border bg-gradient-card cursor-pointer"
              : "border-transparent bg-muted/5 opacity-40 hover:opacity-65 cursor-pointer"
        )}
      >
        {/* Element accent — left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
          style={{
            background: entry.selected && !noTeams ? elHex : "transparent",
          }}
        />

        {/* Selection indicator */}
        <div
          className={cn(
            "grid place-content-center h-4 w-4 shrink-0 rounded-sm border shadow-sm",
            !noTeams && entry.selected
              ? "border-primary bg-primary/70 text-primary-foreground"
              : "border-primary",
            noTeams && "opacity-50"
          )}
        >
          {!noTeams && entry.selected && <Check className="h-4 w-4" />}
        </div>

        {/* Character icon */}
        {char && <ItemIcon characterId={entry.characterId} size="sm" />}

        {/* Right column: name top, artifact + team count bottom */}
        <div className="min-w-0 flex flex-col gap-1 self-stretch py-0.5">
          <span
            className={cn(
              "text-sm font-semibold truncate leading-none",
              elColor
            )}
          >
            {t.character(entry.characterId)}
          </span>

          <div className="flex items-end mt-auto">
            <ArtifactSetIcons build={entry.build} />
          </div>
        </div>
      </button>

      {/* Hover tooltip — teams */}
      {entry.teamComps.length > 0 && (
        <div
          className={cn(
            "absolute z-50 left-0 top-full mt-1 min-w-max",
            "bg-popover border border-border rounded-lg shadow-xl",
            "opacity-0 pointer-events-none scale-95 origin-top-left",
            "group-hover:opacity-100 group-hover:pointer-events-auto group-hover:scale-100",
            "transition-all duration-150"
          )}
        >
          <TeamsTooltip
            teamComps={entry.teamComps}
            characterId={entry.characterId}
            getTeamSetupConfigById={getTeamSetupConfigById}
            accountData={accountData}
          />
        </div>
      )}
    </div>
  );
}
