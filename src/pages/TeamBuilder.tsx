import { useEffect } from "react";
import { useTeamStore } from "@/stores/useTeamStore";
import { TeamCard } from "@/components/team-builder/TeamCard";
import { ToolHeader } from "@/components/shared/ToolHeader";
import { THEME } from "@/lib/theme";

export default function TeamBuilderPage() {
  const teams = useTeamStore((state) => state.teams);
  const addTeam = useTeamStore((state) => state.addTeam);
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const deleteTeam = useTeamStore((state) => state.deleteTeam);
  const copyTeam = useTeamStore((state) => state.copyTeam);

  useEffect(() => {
    // Ensure we always have an empty card at the end
    const lastTeam = teams[teams.length - 1];
    const isLastEmpty =
      lastTeam &&
      !lastTeam.name &&
      !lastTeam.characters.some(Boolean) &&
      !lastTeam.weapons.some(Boolean) &&
      !lastTeam.artifacts.some(Boolean);

    if (!lastTeam || !isLastEmpty) {
      addTeam();
    }
  }, [teams, addTeam]);

  return (
    <div className={THEME.layout.pageContainer}>
      <ToolHeader />
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="w-[95%] max-w-[1600px] mx-auto grid grid-cols-[repeat(auto-fit,minmax(440px,460px))] gap-8 justify-center items-center">
          {teams.map((team, index) => {
            const isLast = index === teams.length - 1;
            return (
              <TeamCard
                key={team.id}
                team={team}
                index={index}
                onUpdate={(patch) => updateTeam(team.id, patch)}
                onDelete={() => deleteTeam(team.id)}
                onCopy={() => copyTeam(team.id)}
                isGhost={isLast}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
