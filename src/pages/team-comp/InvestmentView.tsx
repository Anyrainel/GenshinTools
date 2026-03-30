import { CategoryChip } from "@/components/archive/CategoryChip";
import { FilterChip } from "@/components/archive/FilterChip";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { InvestmentDetail } from "@/components/team-comp/InvestmentDetail";
import { TeamCard } from "@/components/team-comp/TeamCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, elementResourcesByName } from "@/data/constants";
import type { Element, Region } from "@/data/types";
import { elements, regions, tiers } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHasAccountData, useIsOwned } from "@/hooks/useOwnership";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { fuzzyMatch } from "@/lib/search";
import { cn, getAssetUrl } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTierStore } from "@/stores/useTierStore";
import { TrendingUp } from "lucide-react";
import { ArrowUpDown, Bookmark, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

const EMPTY_SET = new Set<string>();

/** Max card width drives auto-fit column sizing — compact on ≤lg, spacious on xl+ */
const CARD_MAX_WIDTH = 320;
const CARD_MAX_WIDTH_COMPACT = 284;

export function InvestmentView() {
  const { t } = useLanguage();
  const isXl = useMediaQuery("(min-width: 1280px)");
  const cardMinWidth = isXl ? CARD_MAX_WIDTH : CARD_MAX_WIDTH_COMPACT;
  const { characterStats } = useGameStats();
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const teams = useTeamStore((state) => state.teams);
  const addTeam = useTeamStore((state) => state.addTeam);
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const activeInvestmentTeamId = useSessionNavStore(
    (s) => s.activeInvestmentTeamId
  );
  const setActiveInvestmentTeamId = useSessionNavStore(
    (s) => s.setActiveInvestmentTeamId
  );

  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Precompute ownership info per team
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

  // Filter teams
  const filteredTeams = useMemo(() => {
    let result = teams;

    // Search filter
    const query = searchQuery.trim();
    if (query) {
      result = result.filter((team) => {
        if (team.name && fuzzyMatch(query, team.name)) return true;
        for (const id of team.characters) {
          if (id && fuzzyMatch(query, t.character(id))) return true;
        }
        for (const id of team.weapons) {
          if (id && fuzzyMatch(query, t.weapon(id))) return true;
        }
        for (const art of team.artifacts) {
          if (!art) continue;
          if (art.type === "4pc") {
            if (fuzzyMatch(query, t.artifact(art.setId))) return true;
          } else {
            if (fuzzyMatch(query, t.artifact(String(art.id1)))) return true;
            if (fuzzyMatch(query, t.artifact(String(art.id2)))) return true;
          }
        }
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

        if (chars.length === 0) return true;

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

    // Owned-only filter
    if (ownedOnlyFilter && hasAccountData) {
      result = result.filter((team) => {
        const ownership = teamOwnershipMap.get(team.id);
        if (!ownership || ownership.filledCount === 0) return true;
        return ownership.ownedCount === ownership.filledCount;
      });
    }

    // Sort
    if (teamSort !== "default") {
      const indexed = result.map((team, i) => ({ team, origIdx: i }));
      const WORST_TIER = tiers.length;

      indexed.sort((a, b) => {
        const getScore = (tm: typeof a.team) => {
          const charIds = tm.characters.filter(Boolean) as string[];
          if (charIds.length === 0)
            return teamSort === "tier" ? WORST_TIER : "";

          if (teamSort === "tier") {
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
          if (sa !== sb) return (sa as number) - (sb as number);
        } else {
          if (sa !== sb) return sa < sb ? 1 : -1;
        }
        return a.origIdx - b.origIdx;
      });

      result = indexed.map((e) => e.team);
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
    teamSort,
    tierAssignments,
    tierRank,
  ]);

  // Precompute filtered order for CSS-based show/hide
  const filteredTeamOrder = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < filteredTeams.length; i++) {
      map.set(filteredTeams[i].id, i);
    }
    return map;
  }, [filteredTeams]);

  // Displayable regions (exclude "None")
  const displayRegions = useMemo(() => regions.filter((r) => r !== "None"), []);

  const investmentLabel = t.ui("teamComp.tabInvestment");

  const handleAddTeam = useCallback(
    (position: "start" | "end") => {
      addTeam(undefined, position);
      scrollRef.current?.scrollTo({
        top: position === "start" ? 0 : scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    },
    [addTeam]
  );

  // ── Detail view (when a team is selected) ──
  if (activeInvestmentTeamId) {
    const team = teams.find((tm) => tm.id === activeInvestmentTeamId);
    if (!team) {
      setTimeout(() => setActiveInvestmentTeamId(null), 0);
      return null;
    }

    return (
      <InvestmentDetail
        team={team}
        onBack={() => setActiveInvestmentTeamId(null)}
      />
    );
  }

  // ── Grid view ──
  return (
    <ScrollLayout
      bodyRef={scrollRef}
      header={
        <div className="space-y-3">
          {/* Search bar */}
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

          {/* Row 2: Owned-only + Sort */}
          <div className="flex items-center gap-1 2xl:gap-2 flex-wrap">
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

            {/* New team buttons */}
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
      }
    >
      <div className="py-2">
        <div
          className={cn("grid gap-3 xl:gap-4 justify-center items-start")}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinWidth}px, max-content))`,
          }}
        >
          {teams.map((team, realIndex) => {
            const order = filteredTeamOrder.get(team.id);
            const isVisible = order !== undefined;
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
                  onSelect={() => setActiveInvestmentTeamId(team.id)}
                  selectLabel={investmentLabel}
                  selectIcon={TrendingUp}
                  selectClassName="border-amber-600/50 bg-amber-700/40 text-amber-300 hover:bg-amber-700/60 hover:text-amber-200"
                  accountData={accountData}
                  allUnowned={allUnowned}
                  frozenCharIds={EMPTY_SET}
                />
              </div>
            );
          })}
        </div>
      </div>
    </ScrollLayout>
  );
}
