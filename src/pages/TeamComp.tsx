import { FilterChip } from "@/components/archive/FilterChip";
import { HeaderScrollLayout } from "@/components/layout/HeaderScrollLayout";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { TeamCard } from "@/components/team-comp/TeamCard";
import { TeamOptDetail } from "@/components/team-comp/TeamOptDetail";
import { useLanguage } from "@/contexts/LanguageContext";
import "@/lib/team-comp";
import type { ControlHandle } from "@/components/layout/AppBar";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { Button } from "@/components/ui/button";
import { charactersById, elementResourcesByName } from "@/data/constants";
import type { Element, PresetOption, Region } from "@/data/types";
import { elements, regions } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";
import { cn, getAssetUrl } from "@/lib/utils";
import type { TeamCompData } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/** Max card width drives auto-fit column sizing */
const CARD_MAX_WIDTH = 320;

const presetModules = import.meta.glob<{ default: TeamCompData }>(
  "@/presets/team-comp/*.json",
  { eager: false }
);

export default function TeamCompPage() {
  const { t } = useLanguage();
  const { ready: gameStatsReady, characterStats } = useGameStats();
  const teams = useTeamStore((state) => state.teams);
  const activeTeamId = useTeamStore((state) => state.activeTeamId);
  const addTeam = useTeamStore((state) => state.addTeam);
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const deleteTeam = useTeamStore((state) => state.deleteTeam);
  const copyTeam = useTeamStore((state) => state.copyTeam);
  const moveTeam = useTeamStore((state) => state.moveTeam);
  const setActiveTeam = useTeamStore((state) => state.setActiveTeam);
  const importTeams = useTeamStore((state) => state.importTeams);
  const exportTeams = useTeamStore((state) => state.exportTeams);
  const clearTeams = useTeamStore((state) => state.clearTeams);
  const author = useTeamStore((state) => state.author);
  const description = useTeamStore((state) => state.description);

  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);

  // Preset options
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);

  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetPayload(presetModules, path);
  }, []);

  // Filters
  const [elementFilter, setElementFilter] = useState<Element[]>([]);
  const [regionFilter, setRegionFilter] = useState<Region[]>([]);

  const toggleElement = (el: Element) =>
    setElementFilter((prev) =>
      prev.includes(el) ? prev.filter((e) => e !== el) : [...prev, el]
    );

  const toggleRegion = (r: Region) =>
    setRegionFilter((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );

  // Filter teams based on element/region of their characters
  const filteredTeams = useMemo(() => {
    if (elementFilter.length === 0 && regionFilter.length === 0) return teams;

    return teams.filter((team) => {
      const chars = team.characters
        .filter(Boolean)
        .map((id) => charactersById[id!])
        .filter(Boolean);

      if (chars.length === 0) return true; // Show unconfigured teams always

      if (elementFilter.length > 0) {
        const hasMatchingElement = chars.some((c) => {
          const meta = getCharacterDisplayMeta(c, characterStats?.[c.id]);
          return meta.element != null && elementFilter.includes(meta.element);
        });
        if (!hasMatchingElement) return false;
      }

      if (regionFilter.length > 0) {
        const hasMatchingRegion = chars.some((c) => {
          const meta = getCharacterDisplayMeta(c, characterStats?.[c.id]);
          return meta.region != null && regionFilter.includes(meta.region);
        });
        if (!hasMatchingRegion) return false;
      }

      return true;
    });
  }, [teams, elementFilter, regionFilter, characterStats]);

  // Displayable regions (exclude "None")
  const displayRegions = useMemo(() => regions.filter((r) => r !== "None"), []);

  const handleImport = (data: TeamCompData) => {
    importTeams(data);
    toast.success(t.ui("import.action"));
  };

  const handleExport = (exportAuthor: string, exportDescription: string) => {
    const data = exportTeams(exportAuthor, exportDescription);
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `[${exportAuthor}] ${exportDescription}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Persist metadata to store
      useTeamStore.getState().setMetadata(exportAuthor, exportDescription);
      toast.success(t.ui("export.action"));
    } catch (error) {
      console.error("Error exporting teams:", error);
    }
  };

  if (activeTeamId) {
    const activeTeam = teams.find((t) => t.id === activeTeamId);
    if (!activeTeam) {
      setTimeout(() => setActiveTeam(null), 0);
      return null;
    }
    if (!gameStatsReady) {
      return (
        <PageLayout>
          <ScrollLayout className="py-8 mt-2 flex items-center justify-center">
            <span className="text-muted-foreground">
              {t.ui("common.loading")}
            </span>
          </ScrollLayout>
        </PageLayout>
      );
    }
    const clearActiveTeam = () => {
      updateTeam(activeTeam.id, {
        characters: [null, null, null, null],
        weapons: [null, null, null, null],
        artifacts: [null, null, null, null],
        opts: {},
        selectedFormula: null,
        targetEr: {},
      });
    };

    return (
      <PageLayout
        onClearData={clearActiveTeam}
        clearLabel={t.ui("teamComp.clearTeamData")}
      >
        <ScrollLayout className="py-8 mt-2">
          <TeamOptDetail team={activeTeam} onBack={() => setActiveTeam(null)} />
        </ScrollLayout>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      onClearData={clearTeams}
      clearLabel={t.ui("common.clearTeams")}
      actions={[
        {
          key: "import",
          icon: Upload,
          label: t.ui("import.action"),
          onTrigger: () => importRef.current?.open(),
        },
        {
          key: "export",
          icon: Download,
          label: t.ui("export.action"),
          onTrigger: () => exportRef.current?.open(),
        },
        {
          key: "clear",
          icon: Trash2,
          label: t.ui("common.clear"),
          onTrigger: () => clearRef.current?.open(),
        },
      ]}
    >
      {/* Control dialogs - render without triggers, opened via ref */}
      <ImportControl<TeamCompData>
        ref={importRef}
        options={presetOptions}
        loadPreset={loadPreset}
        onApply={handleImport}
        onLocalImport={handleImport}
        variant="team-comp"
      />
      <ExportControl
        ref={exportRef}
        onExport={handleExport}
        variant="team-comp"
        defaultAuthor={author}
        defaultDescription={description}
      />
      <ClearAllControl ref={clearRef} onConfirm={clearTeams} />

      <HeaderScrollLayout
        header={
          <div className="container flex items-center gap-1 2xl:gap-2 flex-wrap py-2">
            {/* Element chips */}
            {elements.map((el) => {
              const active =
                elementFilter.length === 0 || elementFilter.includes(el);
              const res = elementResourcesByName[el];
              return (
                <FilterChip
                  key={el}
                  active={active}
                  onClick={() => toggleElement(el)}
                >
                  <img
                    src={getAssetUrl(res.imagePath)}
                    alt={el}
                    className="w-4 h-4"
                  />
                </FilterChip>
              );
            })}

            <div className="h-5 w-px bg-border/50 mx-1" />

            {/* Region chips */}
            {displayRegions.map((r) => {
              const active =
                regionFilter.length === 0 || regionFilter.includes(r);
              return (
                <FilterChip
                  key={r}
                  active={active}
                  onClick={() => toggleRegion(r)}
                >
                  <span className="text-xs">{t.region(r)}</span>
                </FilterChip>
              );
            })}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Add team buttons */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-sm h-8"
              onClick={() => addTeam(undefined, "start")}
            >
              <Plus className="w-3 h-3" />
              {t.ui("teamComp.newTeamStart")}
              <span className="text-muted-foreground">↑</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 text-sm h-8"
              onClick={() => addTeam(undefined, "end")}
            >
              <Plus className="w-3 h-3" />
              {t.ui("teamComp.newTeamEnd")}
              <span className="opacity-60">↓</span>
            </Button>
          </div>
        }
      >
        <div className="py-6">
          <div
            className={cn("grid gap-4 justify-center items-start")}
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MAX_WIDTH}px, max-content))`,
            }}
          >
            {filteredTeams.map((team, index) => {
              // Use actual index in the full teams array for move logic
              const realIndex = teams.indexOf(team);
              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  index={realIndex}
                  onUpdate={(patch) => updateTeam(team.id, patch)}
                  onDelete={() => deleteTeam(team.id)}
                  onCopy={() => copyTeam(team.id)}
                  onSelect={() => setActiveTeam(team.id)}
                  onMoveUp={
                    realIndex > 0 ? () => moveTeam(team.id, "up") : undefined
                  }
                  onMoveDown={
                    realIndex < teams.length - 1
                      ? () => moveTeam(team.id, "down")
                      : undefined
                  }
                />
              );
            })}
          </div>

          {/* Empty State */}
          {teams.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <p className="text-muted-foreground text-sm">
                {t.ui("teamComp.emptyDamageMessage")}
              </p>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => addTeam()}
              >
                <Plus className="w-5 h-5" />
                {t.ui("teamComp.newTeamEnd")}
              </Button>
            </div>
          )}
        </div>
      </HeaderScrollLayout>
    </PageLayout>
  );
}
