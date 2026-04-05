import { CategoryChip } from "@/components/archive/CategoryChip";
import { FilterChip } from "@/components/archive/FilterChip";
import type { ControlHandle } from "@/components/layout/AppBar";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { TeamCard } from "@/components/team-comp/TeamCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTour } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, elementResourcesByName } from "@/data/constants";
import type { Element, Region } from "@/data/types";
import { elements, regions, tiers } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHasAccountData, useIsOwned } from "@/hooks/useOwnership";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { fuzzyMatch } from "@/lib/search";
import { isTourCompleted, markTourCompleted } from "@/lib/tourConfig";
import { cn, getAssetUrl } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import type { TeamSort } from "@/stores/useSessionNavStore";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import type { Team } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTierStore } from "@/stores/useTierStore";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpDown,
  Bookmark,
  Download,
  Plus,
  Search,
  Swords,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const EMPTY_SET = new Set<string>();
const CARD_MAX_WIDTH = 320;
const CARD_MAX_WIDTH_COMPACT = 284;

// ── Sortable wrapper for each team card slot ──

function SortableTeamSlot({
  id,
  isVisible,
  order,
  disabled,
  children,
}: {
  id: string;
  isVisible: boolean;
  order: number | undefined;
  disabled: boolean;
  children: (
    dragHandleProps: React.HTMLAttributes<HTMLElement> | undefined
  ) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: disabled || !isVisible,
  });

  const style: React.CSSProperties = isVisible
    ? {
        order,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : undefined,
      }
    : { display: "none" };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(!disabled && isVisible ? listeners : undefined)}
    </div>
  );
}

export interface TeamGridProps {
  /** Identifies which view this grid belongs to (for per-view session settings) */
  viewId: import("@/stores/useSessionNavStore").ViewId;
  /** Session navigation: which team is currently open in detail view */
  activeTeamId: string | null;
  setActiveTeamId: (id: string | null) => void;
  /** Renders the detail view for a selected team */
  renderDetail: (team: Team, onBack: () => void) => React.ReactNode;
  /** TeamCard select-button overrides */
  selectLabel?: string;
  selectIcon?: LucideIcon;
  selectClassName?: string;
  /** Enable freeze system integration (frozen teams sort to top, freeze badges) */
  enableFreeze?: boolean;
  /** Enable empty-state welcome screen with import button */
  emptyState?: { importRef: React.RefObject<ControlHandle | null> };
  /** Enable auto-tour on first visit */
  enableTour?: boolean;
}

export function TeamGrid({
  viewId,
  activeTeamId,
  setActiveTeamId,
  renderDetail,
  selectLabel,
  selectIcon,
  selectClassName,
  enableFreeze,
  emptyState,
  enableTour,
}: TeamGridProps) {
  const { t } = useLanguage();
  const tour = useTour();
  const isXl = useMediaQuery("(min-width: 1280px)");
  const cardMinWidth = isXl ? CARD_MAX_WIDTH : CARD_MAX_WIDTH_COMPACT;
  const { characterStats } = useGameStats();
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const teams = useTeamStore((s) => s.teams);
  const addTeam = useTeamStore((s) => s.addTeam);
  const updateTeam = useTeamStore((s) => s.updateTeam);
  const deleteTeam = useTeamStore((s) => s.deleteTeam);
  const copyTeam = useTeamStore((s) => s.copyTeam);
  const moveTeam = useTeamStore((s) => s.moveTeam);
  const moveTeamRelative = useTeamStore((s) => s.moveTeamRelative);

  // Use targeted selectors — subscribing to the full store caused every
  // freeze mutation to re-render the entire page + recalculate filteredTeams.
  const frozenTeams = useFreezeStore((s) => s.frozenTeams);
  const unfreezeTeam = useFreezeStore((s) => s.unfreezeTeam);
  const isFrozen = useFreezeStore((s) => s.isFrozen);
  const getFrozenCharIds = useFreezeStore((s) => s.getFrozenCharIds);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Ghost team: auto-create a blank card when empty so the tour has targets
  useEffect(() => {
    if (emptyState && teams.length === 0) addTeam();
  }, [emptyState, teams.length, addTeam]);

  // Start tour on first visit (after a short delay for page to render)
  useEffect(() => {
    if (enableTour && !isTourCompleted("team-comp") && !activeTeamId) {
      const timer = setTimeout(() => {
        tour.start("team-comp");
        markTourCompleted("team-comp");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [enableTour, tour, activeTeamId]);

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

  // Filters & sort (ownedOnly + teamSort persisted per-view in sessionStorage)
  const viewSettings = useSessionNavStore((s) => s.viewSettings[viewId]);
  const setViewOwnedOnly = useSessionNavStore((s) => s.setViewOwnedOnly);
  const setViewTeamSort = useSessionNavStore((s) => s.setViewTeamSort);
  const ownedOnlyFilter =
    viewSettings.ownedOnly === null ? hasAccountData : viewSettings.ownedOnly;
  const setOwnedOnlyFilter = (v: boolean) => setViewOwnedOnly(viewId, v);
  const teamSort = viewSettings.teamSort;
  const toggleSort = (s: TeamSort) =>
    setViewTeamSort(viewId, teamSort === s ? "default" : s);

  const [searchQuery, setSearchQuery] = useState("");
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
        const getScore = (tm: typeof a.team) => {
          const charIds = tm.characters.filter(Boolean) as string[];
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
    if (enableFreeze) {
      const frozen = result.filter((t) => isFrozen(t.id));
      const unfrozen = result.filter((t) => !isFrozen(t.id));
      return [...frozen, ...unfrozen];
    }

    return result;
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
    enableFreeze,
  ]);

  // Precompute freeze data per team (avoids repeated getFrozenCharIds calls + new Set per card).
  // Iterates ALL teams (not filteredTeams) so object references stay stable across filter changes,
  // allowing React.memo on TeamCard to skip re-renders.
  // biome-ignore lint/correctness/useExhaustiveDependencies: frozenTeams is the data dep; getFrozenCharIds is a stable selector
  const teamFreezeMap = useMemo(() => {
    if (!enableFreeze) return null;
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
  }, [enableFreeze, teams, frozenTeams]);

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

  // ── Drag-and-drop ──
  const dndEnabled = teamSort === "default";

  const filteredTeamIds = useMemo(
    () => filteredTeams.map((t) => t.id),
    [filteredTeams]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = filteredTeams.findIndex((t) => t.id === active.id);
      const newIdx = filteredTeams.findIndex((t) => t.id === over.id);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

      // Compute new filtered order after the move
      const newOrder = [...filteredTeams];
      const [moved] = newOrder.splice(oldIdx, 1);
      newOrder.splice(newIdx, 0, moved);

      // Anchor the moved team relative to its new neighbor in the real array
      if (newIdx > 0) {
        moveTeamRelative(String(active.id), newOrder[newIdx - 1].id, "after");
      } else if (newOrder.length > 1) {
        moveTeamRelative(String(active.id), newOrder[1].id, "before");
      }
    },
    [filteredTeams, moveTeamRelative]
  );

  // Displayable regions (exclude "None")
  const displayRegions = useMemo(() => regions.filter((r) => r !== "None"), []);

  const isTeamEmpty = (t: { characters: (string | null)[] }) =>
    t.characters.every((c) => c == null);

  const showEmptyState =
    !!emptyState && teams.length <= 1 && teams.every(isTeamEmpty);

  const handleAddTeam = (position: "start" | "end") => {
    // Don't create a new empty team if one already exists at that edge
    if (emptyState && teams.length > 0) {
      if (position === "start" && isTeamEmpty(teams[0])) return;
      if (position === "end" && isTeamEmpty(teams[teams.length - 1])) return;
    }
    addTeam(undefined, position);
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTo({
        top: position === "start" ? 0 : scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  // ── Detail view (when a team is selected) ──
  if (activeTeamId) {
    const activeTeam = teams.find((t) => t.id === activeTeamId);
    if (!activeTeam) {
      setTimeout(() => setActiveTeamId(null), 0);
      return null;
    }
    return <>{renderDetail(activeTeam, () => setActiveTeamId(null))}</>;
  }

  // ── Grid view ──
  return (
    <ScrollLayout
      bodyRef={scrollRef}
      header={
        showEmptyState ? null : (
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

            {/* Row 2: Owned-only + Sort | New team buttons */}
            <div className="flex items-center gap-1 2xl:gap-2 flex-wrap">
              {/* Left: filter & sort chips */}
              {hasAccountData && (
                <CategoryChip
                  active={ownedOnlyFilter}
                  onClick={() => setOwnedOnlyFilter(!ownedOnlyFilter)}
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
        className={cn("py-2", showEmptyState && "flex flex-col items-center")}
      >
        {/* Empty state welcome — shown when all teams are unconfigured */}
        {showEmptyState && emptyState && (
          <EmptyState
            icon={Swords}
            title={t.ui("teamComp.emptyTeamTitle")}
            description={t.ui("teamComp.emptyTeamDesc")}
            action={{
              label: t.ui("computeFilters.importPreset"),
              icon: Download,
              onClick: () => emptyState.importRef.current?.open(),
            }}
          >
            <p className="text-base text-muted-foreground -mt-2">
              {t.ui("teamComp.emptyTeamOrImport")}
            </p>
          </EmptyState>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredTeamIds}
            strategy={rectSortingStrategy}
          >
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
                const freeze = teamFreezeMap?.get(team.id);
                const ownership = teamOwnershipMap.get(team.id);
                const allUnowned =
                  hasAccountData &&
                  !!ownership &&
                  ownership.filledCount > 0 &&
                  ownership.ownedCount === 0;
                return (
                  <SortableTeamSlot
                    key={team.id}
                    id={team.id}
                    isVisible={isVisible}
                    order={order}
                    disabled={!dndEnabled}
                  >
                    {(dragHandleProps) => (
                      <TeamCard
                        team={team}
                        index={realIndex}
                        onUpdate={(patch) => updateTeam(team.id, patch)}
                        onDelete={() => {
                          if (enableFreeze) unfreezeTeam(team.id);
                          deleteTeam(team.id);
                        }}
                        onCopy={() => copyTeam(team.id)}
                        onSelect={() => setActiveTeamId(team.id)}
                        onMoveUp={
                          realIndex > 0
                            ? () => moveTeam(team.id, "up")
                            : undefined
                        }
                        onMoveDown={
                          realIndex < teams.length - 1
                            ? () => moveTeam(team.id, "down")
                            : undefined
                        }
                        selectLabel={selectLabel}
                        selectIcon={selectIcon}
                        selectClassName={selectClassName}
                        isFrozen={freeze?.isFrozen ?? false}
                        isFullyFrozen={freeze?.isFullyFrozen ?? false}
                        frozenCount={freeze?.frozenCount ?? 0}
                        totalCharCount={freeze?.totalCharCount ?? 0}
                        frozenCharIds={freeze?.frozenCharIds ?? EMPTY_SET}
                        onUnfreeze={
                          enableFreeze ? () => unfreezeTeam(team.id) : undefined
                        }
                        accountData={accountData}
                        allUnowned={allUnowned}
                        dragHandleProps={dragHandleProps}
                      />
                    )}
                  </SortableTeamSlot>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </ScrollLayout>
  );
}
