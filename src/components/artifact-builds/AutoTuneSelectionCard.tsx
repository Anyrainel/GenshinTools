import { AutoTuneTeamRow } from "@/components/artifact-builds/AutoTuneTeamRow";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { AccountData, Build, Element } from "@/data/types";
import { ELEMENT_HEX, cn, getElementColor } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { Check } from "lucide-react";

type SelectionEntry = {
  buildId: string;
  characterId: string;
  build: Build;
  selected: boolean;
  teams: Team[];
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
  teams,
  characterId,
  accountData,
}: {
  teams: Team[];
  characterId: string;
  accountData: AccountData | null;
}) {
  if (teams.length === 0) return null;
  return (
    <div className="space-y-1.5 p-2">
      {teams.map((team) => (
        <AutoTuneTeamRow
          key={team.id}
          team={team}
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
  accountData,
}: {
  entry: SelectionEntry;
  onToggle: () => void;
  element: string;
  accountData: AccountData | null;
}) {
  const { t } = useLanguage();
  const char = charactersById[entry.characterId];
  const elHex = ELEMENT_HEX[element] || "#888";
  const elColor = getElementColor(element as Element, "text");
  const noTeams = entry.teams.length === 0;

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
            "grid place-content-center h-4 w-4 shrink-0 rounded-sm border shadow",
            !noTeams && entry.selected
              ? "border-primary bg-primary text-primary-foreground"
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
      {entry.teams.length > 0 && (
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
            teams={entry.teams}
            characterId={entry.characterId}
            accountData={accountData}
          />
        </div>
      )}
    </div>
  );
}
