import { AppBar } from "@/components/layout/AppBar";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { TeamCard } from "@/components/team-builder/TeamCard";
import { STYLES } from "@/lib/styles";
import { useTeamStore } from "@/stores/useTeamStore";
import { useEffect } from "react";

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
    <div className={STYLES.layout.page}>
      <AppBar />
      <ScrollLayout className="py-8">
        <div className="w-[95%] max-w-[1900px] mx-auto grid grid-cols-[repeat(auto-fit,minmax(400px,440px))] gap-4 justify-center items-center">
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
      </ScrollLayout>
    </div>
  );
}
