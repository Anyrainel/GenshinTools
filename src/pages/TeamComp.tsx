import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { TeamCard } from "@/components/team-comp/TeamCard";
import { TeamOptDetail } from "@/components/team-comp/TeamOptDetail";
import { useLanguage } from "@/contexts/LanguageContext";
import "@/lib/team-comp";
import type { ControlHandle } from "@/components/layout/AppBar";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { useTeamStore } from "@/stores/useTeamStore";
import { Download, Trash2, Upload } from "lucide-react";
import { useEffect, useRef } from "react";

export default function TeamCompPage() {
  const { t } = useLanguage();
  const teams = useTeamStore((state) => state.teams);
  const activeTeamId = useTeamStore((state) => state.activeTeamId);
  const addTeam = useTeamStore((state) => state.addTeam);
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const deleteTeam = useTeamStore((state) => state.deleteTeam);
  const copyTeam = useTeamStore((state) => state.copyTeam);
  const setActiveTeam = useTeamStore((state) => state.setActiveTeam);
  const importTeams = useTeamStore((state) => state.importTeams);
  const exportTeams = useTeamStore((state) => state.exportTeams);

  const clearTeams = useTeamStore((state) => state.clearTeams);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<ControlHandle>(null);

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

  const handleExport = () => {
    const json = exportTeams();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "genshin_teams.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === "string") {
          importTeams(text);
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (activeTeamId) {
    const activeTeam = teams.find((t) => t.id === activeTeamId);
    if (!activeTeam) {
      setTimeout(() => setActiveTeam(null), 0);
      return null;
    }
    return (
      <PageLayout>
        <ScrollLayout className="py-8 mt-2">
          <TeamOptDetail team={activeTeam} onBack={() => setActiveTeam(null)} />
        </ScrollLayout>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      actions={[
        {
          key: "import",
          icon: Upload,
          label: t.ui("app.import"),
          onTrigger: () => fileInputRef.current?.click(),
        },
        {
          key: "export",
          icon: Download,
          label: t.ui("app.export"),
          onTrigger: handleExport,
        },
        {
          key: "clear",
          icon: Trash2,
          label: t.ui("app.clear"),
          onTrigger: () => clearRef.current?.open(),
        },
      ]}
    >
      <ClearAllControl ref={clearRef} onConfirm={clearTeams} />
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        onChange={handleImport}
        className="hidden"
      />
      <ScrollLayout className="py-8 mt-2">
        <div className="mx-auto grid grid-cols-[repeat(auto-fit,minmax(400px,440px))] gap-4 justify-center items-center max-w-[1400px]">
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
                onSelect={() => setActiveTeam(team.id)}
                isGhost={isLast}
              />
            );
          })}
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}
