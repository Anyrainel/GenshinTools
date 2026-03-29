import { CategoryChip } from "@/components/archive/CategoryChip";
import { FilterChip } from "@/components/archive/FilterChip";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { TeamCard } from "@/components/team-comp/TeamCard";
import { TeamOptDetail } from "@/components/team-comp/TeamOptDetail";
import { useLanguage } from "@/contexts/LanguageContext";
import "@/lib/team-comp";
import type { ControlHandle } from "@/components/layout/AppBar";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { ExportBranding } from "@/components/shared/ExportBranding";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import {
  ExportColumn,
  buildArtifactOwnerMap,
} from "@/components/team-comp/SwapGuide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTour } from "@/components/ui/tour";
import { charactersById, elementResourcesByName } from "@/data/constants";
import type { Element, PresetOption, Region, Tier } from "@/data/types";
import { elements, regions, tiers } from "@/data/types";
import type { ArtifactData, CharacterData } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHasAccountData, useIsOwned } from "@/hooks/useOwnership";
import { downloadElementAsImage } from "@/lib/downloadImage";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import {
  getCachedPresetMetadata,
  loadPresetMetadata,
  loadPresetPayload,
} from "@/lib/presetLoader";
import { fuzzyMatch } from "@/lib/search";
import { isTourCompleted, markTourCompleted } from "@/lib/tourConfig";
import { cn, getAssetUrl } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import type { ArtifactReuseMode } from "@/stores/useFreezeStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import type { TeamCompData } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTierStore } from "@/stores/useTierStore";
import {
  ArrowUpDown,
  Bookmark,
  Download,
  FileDown,
  Flame,
  HelpCircle,
  Plus,
  Search,
  Swords,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const EMPTY_SET = new Set<string>();

/** Max card width drives auto-fit column sizing — compact on ≤lg, spacious on xl+ */
const CARD_MAX_WIDTH = 320;
const CARD_MAX_WIDTH_COMPACT = 284;

const presetModules = import.meta.glob<{ default: TeamCompData }>(
  "@/presets/team-comp/*.json",
  { eager: false }
);

export default function TeamCompPage() {
  const { t } = useLanguage();
  const tour = useTour();
  const isXl = useMediaQuery("(min-width: 1280px)");
  const cardMinWidth = isXl ? CARD_MAX_WIDTH : CARD_MAX_WIDTH_COMPACT;
  const { characterStats } = useGameStats();
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const teams = useTeamStore((state) => state.teams);
  const activeTeamId = useSessionNavStore((s) => s.activeTeamId);
  const setActiveTeamId = useSessionNavStore((s) => s.setActiveTeamId);
  const addTeam = useTeamStore((state) => state.addTeam);
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const deleteTeam = useTeamStore((state) => state.deleteTeam);
  const copyTeam = useTeamStore((state) => state.copyTeam);
  const moveTeam = useTeamStore((state) => state.moveTeam);
  const importTeams = useTeamStore((state) => state.importTeams);
  const exportTeams = useTeamStore((state) => state.exportTeams);
  const clearTeamsRaw = useTeamStore((state) => state.clearTeams);
  const author = useTeamStore((state) => state.author);
  const description = useTeamStore((state) => state.description);
  // Use targeted selectors — subscribing to the full store caused every
  // freeze mutation to re-render the entire page + recalculate filteredTeams.
  const frozenTeams = useFreezeStore((s) => s.frozenTeams);
  const reuseMode = useFreezeStore((s) => s.reuseMode);
  const setReuseMode = useFreezeStore((s) => s.setReuseMode);
  const clearAllFrozen = useFreezeStore((s) => s.clearAll);
  const unfreezeTeam = useFreezeStore((s) => s.unfreezeTeam);
  const isFrozen = useFreezeStore((s) => s.isFrozen);
  const getFrozenCharIds = useFreezeStore((s) => s.getFrozenCharIds);
  const clearTeams = useCallback(() => {
    clearAllFrozen();
    clearTeamsRaw();
  }, [clearAllFrozen, clearTeamsRaw]);

  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const frozenExportRef = useRef<HTMLDivElement>(null);

  // Preset options
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>(
    () => getCachedPresetMetadata(presetModules) ?? []
  );

  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  // Ghost team: auto-create a blank card when empty so the tour has targets
  useEffect(() => {
    if (teams.length === 0) {
      addTeam();
    }
  }, [teams.length, addTeam]);

  // Start tour on first visit (after a short delay for page to render)
  useEffect(() => {
    if (!isTourCompleted("team-comp") && !activeTeamId) {
      const timer = setTimeout(() => {
        tour.start("team-comp");
        markTourCompleted("team-comp");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [tour, activeTeamId]);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetPayload(presetModules, path);
  }, []);

  // Ownership
  const isOwned = useIsOwned();
  const hasAccountData = useHasAccountData();

  // Tier data
  const tierAssignments = useTierStore((s) => s.tierAssignments);
  const tierRank = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < tiers.length; i++) map[tiers[i]] = i;
    return map;
  }, []);

  // Filters & sort
  type TeamSort = "default" | "tier" | "release";
  const [searchQuery, setSearchQuery] = useState("");
  const [elementFilter, setElementFilter] = useState<Element[]>([]);
  const [regionFilter, setRegionFilter] = useState<Region[]>([]);
  const [ownedOnlyFilter, setOwnedOnlyFilter] = useState(false);
  const [teamSort, setTeamSort] = useState<TeamSort>("default");
  const toggleSort = (s: TeamSort) =>
    setTeamSort((prev) => (prev === s ? "default" : s));

  const toggleElement = (el: Element) =>
    setElementFilter((prev) =>
      prev.includes(el) ? prev.filter((e) => e !== el) : [...prev, el]
    );

  const toggleRegion = (r: Region) =>
    setRegionFilter((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );

  // Precompute ownership info per team (how many of the filled characters are owned)
  const teamOwnershipMap = useMemo(() => {
    if (!hasAccountData)
      return new Map<string, { ownedCount: number; filledCount: number }>();
    const map = new Map<string, { ownedCount: number; filledCount: number }>();
    for (const team of teams) {
      const filledChars = team.characters.filter(Boolean) as string[];
      const ownedCount = filledChars.filter((id) =>
        isOwned("character", id)
      ).length;
      map.set(team.id, { ownedCount, filledCount: filledChars.length });
    }
    return map;
  }, [teams, isOwned, hasAccountData]);

  // Filter teams based on search, element/region of their characters
  // biome-ignore lint/correctness/useExhaustiveDependencies: frozenTeams is the data dep; isFrozen is a stable selector
  const filteredTeams = useMemo(() => {
    let result = teams;

    // Search filter: fuzzy match against team name, character/weapon/artifact names, reaction names
    const query = searchQuery.trim();
    if (query) {
      result = result.filter((team) => {
        // Team custom name
        if (team.name && fuzzyMatch(query, team.name)) return true;
        // Character names
        for (const id of team.characters) {
          if (id && fuzzyMatch(query, t.character(id))) return true;
        }
        // Weapon names
        for (const id of team.weapons) {
          if (id && fuzzyMatch(query, t.weapon(id))) return true;
        }
        // Artifact set names
        for (const art of team.artifacts) {
          if (!art) continue;
          if (art.type === "4pc") {
            if (fuzzyMatch(query, t.artifact(art.setId))) return true;
          } else {
            if (fuzzyMatch(query, t.artifact(String(art.id1)))) return true;
            if (fuzzyMatch(query, t.artifact(String(art.id2)))) return true;
          }
        }
        // Reaction names
        for (const r of team.reactions) {
          if (fuzzyMatch(query, t.reaction(r))) return true;
        }
        return false;
      });
    }

    if (elementFilter.length > 0 || regionFilter.length > 0) {
      result = result.filter((team) => {
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
    }

    // Owned-only filter: keep teams where all filled characters are owned
    if (ownedOnlyFilter && hasAccountData) {
      result = result.filter((team) => {
        const ownership = teamOwnershipMap.get(team.id);
        if (!ownership || ownership.filledCount === 0) return true; // Show unconfigured teams
        return ownership.ownedCount === ownership.filledCount;
      });
    }

    // Sort by tier or release date (stable: original index as tie-breaker)
    if (teamSort !== "default") {
      const indexed = result.map((team, i) => ({ team, origIdx: i }));
      const WORST_TIER = tiers.length; // sentinel for untiered / empty teams

      indexed.sort((a, b) => {
        const getScore = (t: typeof a.team) => {
          const charIds = t.characters.filter(Boolean) as string[];
          if (charIds.length === 0)
            return teamSort === "tier" ? WORST_TIER : "";

          if (teamSort === "tier") {
            // Best (lowest) tier rank among team members
            let best = WORST_TIER;
            for (const id of charIds) {
              const assignment = tierAssignments[id];
              if (assignment) {
                const rank = tierRank[assignment.tier] ?? WORST_TIER;
                if (rank < best) best = rank;
              }
            }
            return best;
          }
          // Most recent release date among team members
          let latest = "";
          for (const id of charIds) {
            const date = characterStats?.[id]?.releaseDate ?? "";
            if (date > latest) latest = date;
          }
          return latest;
        };

        const sa = getScore(a.team);
        const sb = getScore(b.team);

        if (teamSort === "tier") {
          // Lower rank = better tier → sort ascending
          if (sa !== sb) return (sa as number) - (sb as number);
        } else {
          // More recent date = first → sort descending
          if (sa !== sb) return sa < sb ? 1 : -1;
        }
        return a.origIdx - b.origIdx;
      });

      result = indexed.map((e) => e.team);
    }

    // Sort frozen teams to the top while preserving relative order
    const frozen = result.filter((t) => isFrozen(t.id));
    const unfrozen = result.filter((t) => !isFrozen(t.id));
    return [...frozen, ...unfrozen];
  }, [
    teams,
    searchQuery,
    t,
    elementFilter,
    regionFilter,
    ownedOnlyFilter,
    hasAccountData,
    teamOwnershipMap,
    characterStats,
    frozenTeams,
    teamSort,
    tierAssignments,
    tierRank,
  ]);

  // Precompute freeze data per team (avoids repeated getFrozenCharIds calls + new Set per card).
  // Iterates ALL teams (not filteredTeams) so object references stay stable across filter changes,
  // allowing React.memo on TeamCard to skip re-renders.
  // biome-ignore lint/correctness/useExhaustiveDependencies: frozenTeams is the data dep; getFrozenCharIds is a stable selector
  const teamFreezeMap = useMemo(() => {
    const map = new Map<
      string,
      {
        isFrozen: boolean;
        isFullyFrozen: boolean;
        frozenCount: number;
        totalCharCount: number;
        frozenCharIds: Set<string>;
      }
    >();
    for (const team of teams) {
      const frozenIds = getFrozenCharIds(team.id);
      const charIds = team.characters.filter(Boolean);
      map.set(team.id, {
        isFrozen: frozenIds.length > 0,
        isFullyFrozen:
          frozenIds.length > 0 &&
          charIds.every((id) => frozenIds.includes(id!)),
        frozenCount: frozenIds.length,
        totalCharCount: charIds.length,
        frozenCharIds: new Set(frozenIds),
      });
    }
    return map;
  }, [teams, frozenTeams]);

  // Precompute filtered order: maps team id → display position.
  // Teams not in filteredTeams get hidden via CSS instead of unmounting,
  // so re-enabling a filter doesn't incur full mount cost for 30+ cards.
  const filteredTeamOrder = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < filteredTeams.length; i++) {
      map.set(filteredTeams[i].id, i);
    }
    return map;
  }, [filteredTeams]);

  // Displayable regions (exclude "None")
  const displayRegions = useMemo(() => regions.filter((r) => r !== "None"), []);

  const isTeamEmpty = (t: { characters: (string | null)[] }) =>
    t.characters.every((c) => c == null);

  const isEmptyState = teams.length <= 1 && teams.every(isTeamEmpty);

  const handleAddTeam = (position: "start" | "end") => {
    // Don't create a new empty team if one already exists at that edge
    if (teams.length > 0) {
      if (position === "start" && isTeamEmpty(teams[0])) return;
      if (position === "end" && isTeamEmpty(teams[teams.length - 1])) return;
    }
    addTeam(undefined, position);
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      if (position === "start") {
        scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    });
  };

  const handleImport = (data: TeamCompData) => {
    clearAllFrozen();
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

  // Frozen teams data for export
  const frozenTeamEntries = useMemo(() => {
    const entries: {
      team: (typeof teams)[number];
      equippedArtifactsByChar: Record<string, Record<string, ArtifactData>>;
      optimizedArtifactsByChar: Record<string, Record<string, ArtifactData>>;
    }[] = [];
    for (const [teamId, frozenData] of Object.entries(frozenTeams)) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) continue;
      const equipped: Record<string, Record<string, ArtifactData>> = {};
      for (const cid of team.characters) {
        if (!cid) continue;
        const acctChar = accountData?.characters.find(
          (c: CharacterData) => c.key === cid
        );
        equipped[cid] = (acctChar?.artifacts || {}) as Record<
          string,
          ArtifactData
        >;
      }
      const optimized: Record<string, Record<string, ArtifactData>> = {};
      for (const [cid, artsBySlot] of Object.entries(
        frozenData.artifactsByChar
      )) {
        const slotMap: Record<string, ArtifactData> = {};
        for (const [slot, art] of Object.entries(artsBySlot)) {
          if (art) slotMap[slot] = art;
        }
        optimized[cid] = slotMap;
      }
      entries.push({
        team,
        equippedArtifactsByChar: equipped,
        optimizedArtifactsByChar: optimized,
      });
    }
    return entries;
  }, [frozenTeams, teams, accountData]);

  const handleDownloadAllFrozen = useCallback(() => {
    if (!frozenExportRef.current) return;
    const filename = t
      .ui("teamComp.frozenExportFilename")
      .replace("{0}", String(frozenTeamEntries.length));
    downloadElementAsImage(frozenExportRef.current, filename, t);
  }, [t, frozenTeamEntries]);

  if (activeTeamId) {
    const activeTeam = teams.find((t) => t.id === activeTeamId);
    if (!activeTeam) {
      setTimeout(() => setActiveTeamId(null), 0);
      return null;
    }
    const clearActiveTeam = () => {
      updateTeam(activeTeam.id, {
        characters: [null, null, null, null],
        weapons: [null, null, null, null],
        artifacts: [null, null, null, null],
        opts: {},
        selectedFormula: null,
        minEr: {},
      });
    };

    return (
      <PageLayout
        onClearData={clearActiveTeam}
        clearLabel={t.ui("teamComp.clearTeamData")}
        actions={[
          {
            key: "help",
            icon: HelpCircle,
            label: t.ui("buttons.help"),
            onTrigger: () => tour.start("team-opt-detail"),
          },
        ]}
      >
        <ScrollLayout>
          <TeamOptDetail
            team={activeTeam}
            onBack={() => setActiveTeamId(null)}
          />
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
          icon: Download,
          label: t.ui("import.action"),
          alwaysShow: true,
          tourStepId: "tc-import",
          onTrigger: () => importRef.current?.open(),
        },
        {
          key: "export",
          icon: Upload,
          label: t.ui("export.action"),
          onTrigger: () => exportRef.current?.open(),
        },
        ...(Object.keys(frozenTeams).length > 0
          ? [
              {
                key: "download-frozen",
                icon: FileDown,
                label: t.ui("teamComp.downloadAllFrozen"),
                onTrigger: handleDownloadAllFrozen,
              },
            ]
          : []),
        {
          key: "clear",
          icon: Trash2,
          label: t.ui("common.clear"),
          onTrigger: () => clearRef.current?.open(),
        },
        {
          key: "help",
          icon: HelpCircle,
          label: t.ui("buttons.help"),
          onTrigger: () => tour.start("team-comp"),
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

      <ScrollLayout
        bodyRef={scrollRef}
        header={
          isEmptyState ? null : (
            <div className="space-y-3">
              {/* Search bar — centered, prominent (matches Archive pages) */}
              <div className="relative max-w-2xl mx-auto">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
                <Input
                  placeholder={t.ui("teamComp.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 text-base rounded-xl bg-card/50 border-border/50 focus:border-primary/50 shadow-sm"
                />
              </div>

              {/* Row 1: Element + Region chips */}
              <div className="flex items-center justify-center gap-1 2xl:gap-2 flex-wrap">
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
                      <span className="text-xs">{t.element(el)}</span>
                    </FilterChip>
                  );
                })}

                <div className="h-5 w-px bg-border/50 mx-1" />

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
              </div>

              {/* Row 2: Owned-only + Sort | Freeze controls | New team buttons */}
              <div className="flex items-center gap-1 2xl:gap-2 flex-wrap">
                {/* Left: filter & sort chips */}
                {hasAccountData && (
                  <CategoryChip
                    active={ownedOnlyFilter}
                    onClick={() => setOwnedOnlyFilter((v) => !v)}
                    color="amber"
                    activeIcon={Bookmark}
                    inactiveIcon={Bookmark}
                  >
                    {t.ui("common.ownedOnly")}
                  </CategoryChip>
                )}

                <CategoryChip
                  active={teamSort === "tier"}
                  onClick={() => toggleSort("tier")}
                  color="sky"
                  activeIcon={ArrowUpDown}
                  inactiveIcon={ArrowUpDown}
                >
                  {t.ui("teamComp.sortByTier")}
                </CategoryChip>
                <CategoryChip
                  active={teamSort === "release"}
                  onClick={() => toggleSort("release")}
                  color="sky"
                  activeIcon={ArrowUpDown}
                  inactiveIcon={ArrowUpDown}
                >
                  {t.ui("teamComp.sortByRelease")}
                </CategoryChip>

                <div className="flex-1" />

                {/* Center: Freeze controls */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs md:text-sm text-foreground/80 whitespace-nowrap">
                    {t.ui("teamComp.reuseLabel")}
                  </span>
                  <Select
                    value={reuseMode}
                    onValueChange={(v) => setReuseMode(v as ArtifactReuseMode)}
                  >
                    <SelectTrigger className="w-auto text-xs h-7 md:h-8 gap-1 px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t.ui("teamComp.reuseNone")}
                      </SelectItem>
                      <SelectItem value="sameChar">
                        {t.ui("teamComp.reuseSameChar")}
                      </SelectItem>
                      <SelectItem value="forceReuse">
                        {t.ui("teamComp.reuseForce")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-sm leading-none h-8 border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:pointer-events-none"
                  onClick={() => clearAllFrozen()}
                  disabled={Object.keys(frozenTeams).length === 0}
                >
                  <Flame className="w-3 h-3" />
                  <span>{t.ui("teamComp.unfreezeAll")}</span>
                </Button>

                <div className="flex-1" />

                {/* Right: New team buttons */}
                <div className="flex items-center gap-1 2xl:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-sm leading-none h-8"
                    onClick={() => handleAddTeam("start")}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.ui("teamComp.newTeamStart")}</span>
                    <span className="text-muted-foreground">↑</span>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 text-sm leading-none h-8"
                    onClick={() => handleAddTeam("end")}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.ui("teamComp.newTeamEnd")}</span>
                    <span className="opacity-60">↓</span>
                  </Button>
                </div>
              </div>
            </div>
          )
        }
      >
        <div
          className={cn(
            "py-2",
            isEmptyState &&
              "min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center"
          )}
        >
          {/* Empty state welcome — shown when all teams are unconfigured */}
          {isEmptyState && (
            <div className="flex flex-col items-center text-center px-4 pt-4 sm:pt-8 pb-4 max-w-md mx-auto">
              <div className="relative mb-3 sm:mb-5">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                <div className="relative bg-background p-4 rounded-full border border-border shadow-sm">
                  <Swords className="w-10 h-10 text-primary opacity-80" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {t.ui("teamComp.emptyTeamTitle")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t.ui("teamComp.emptyTeamDesc")}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                {t.ui("teamComp.emptyTeamOrImport")}
              </p>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 text-base px-6"
                onClick={() => importRef.current?.open()}
              >
                <Download className="w-5 h-5" />
                {t.ui("import.action")}
              </Button>
            </div>
          )}
          <div
            className={cn("grid gap-3 xl:gap-4 justify-center items-start")}
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinWidth}px, max-content))`,
            }}
          >
            {/* Render ALL teams — hidden ones use display:none + CSS order for sort.
                This avoids destroying/recreating 30+ cards when toggling filters. */}
            {teams.map((team, realIndex) => {
              const order = filteredTeamOrder.get(team.id);
              const isVisible = order !== undefined;
              const freeze = teamFreezeMap.get(team.id);
              const ownership = teamOwnershipMap.get(team.id);
              const allUnowned =
                hasAccountData &&
                !!ownership &&
                ownership.filledCount > 0 &&
                ownership.ownedCount === 0;
              return (
                <div
                  key={team.id}
                  style={isVisible ? { order } : { display: "none" }}
                >
                  <TeamCard
                    team={team}
                    index={realIndex}
                    onUpdate={(patch) => updateTeam(team.id, patch)}
                    onDelete={() => {
                      unfreezeTeam(team.id);
                      deleteTeam(team.id);
                    }}
                    onCopy={() => copyTeam(team.id)}
                    onSelect={() => setActiveTeamId(team.id)}
                    onMoveUp={
                      realIndex > 0 ? () => moveTeam(team.id, "up") : undefined
                    }
                    onMoveDown={
                      realIndex < teams.length - 1
                        ? () => moveTeam(team.id, "down")
                        : undefined
                    }
                    isFrozen={freeze?.isFrozen ?? false}
                    isFullyFrozen={freeze?.isFullyFrozen ?? false}
                    frozenCount={freeze?.frozenCount ?? 0}
                    totalCharCount={freeze?.totalCharCount ?? 0}
                    frozenCharIds={freeze?.frozenCharIds ?? EMPTY_SET}
                    onUnfreeze={() => unfreezeTeam(team.id)}
                    accountData={accountData}
                    allUnowned={allUnowned}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </ScrollLayout>

      {/* Hidden export container for all frozen teams */}
      {frozenTeamEntries.length > 0 && (
        <div
          style={{ position: "fixed", left: -9999, top: 0 }}
          aria-hidden="true"
        >
          <div
            ref={frozenExportRef}
            className="p-1"
            style={{ width: isXl ? 1400 : 700 }}
          >
            <ExportBranding />
            {frozenTeamEntries.map((entry, i) => {
              const ownerMap = buildArtifactOwnerMap(accountData);
              const charIds = entry.team.characters.filter(
                (id): id is string => id != null
              );
              return (
                <div key={entry.team.id}>
                  {i > 0 && <div className="h-px bg-border/20" />}
                  {entry.team.name && (
                    <div className="text-center py-1.5 text-sm font-bold text-foreground/90 bg-black/20">
                      {entry.team.name}
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-px bg-border/10">
                    {charIds.map((charId) => (
                      <ExportColumn
                        key={charId}
                        charId={charId}
                        team={entry.team}
                        equipped={entry.equippedArtifactsByChar[charId] ?? {}}
                        optimized={entry.optimizedArtifactsByChar[charId] ?? {}}
                        ownerMap={ownerMap}
                        accountData={accountData}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
