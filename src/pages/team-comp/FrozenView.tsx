import { ArtifactDataHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ExportBranding } from "@/components/shared/ExportBranding";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { ArtifactFreezeDialog } from "@/components/team-comp/ArtifactFreezeDialog";
import { FrozenTeamSection } from "@/components/team-comp/FrozenTeamSection";
import {
  ExportColumn,
  buildArtifactOwnerMap,
} from "@/components/team-comp/SwapGuide";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ArtifactData, CharacterData, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { downloadElementAsImage } from "@/lib/downloadImage";
import { cn } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import type { ArtifactReuseMode, FrozenTeam } from "@/stores/useFreezeStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { Flame, Plus, Snowflake, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export interface FrozenViewHandle {
  downloadAllFrozen: () => void;
}

// ── Snapshot helpers ──
// These accumulate frozen data into append-only refs so that data is never
// lost when the store is mutated. All callbacks just call the store directly;
// the snapshot mechanism is completely decoupled from callback logic.

function absorbTeamData(
  snapshot: Record<string, Record<string, Record<Slot, ArtifactData | null>>>,
  frozenTeams: Record<string, FrozenTeam>
) {
  for (const [teamId, ft] of Object.entries(frozenTeams)) {
    if (!snapshot[teamId]) snapshot[teamId] = {};
    for (const charId of ft.frozenCharIds) {
      if (ft.artifactsByChar[charId]) {
        snapshot[teamId][charId] = ft.artifactsByChar[charId];
      }
    }
  }
}

function absorbStandaloneIds(
  snapshot: Set<string>,
  frozenArtifactIds: string[]
) {
  for (const id of frozenArtifactIds) snapshot.add(id);
}

export const FrozenView = forwardRef<FrozenViewHandle>(
  function FrozenView(_, ref) {
    const { t } = useLanguage();
    const frozenTeams = useFreezeStore((s) => s.frozenTeams);
    const frozenArtifactIds = useFreezeStore((s) => s.frozenArtifactIds);
    const unfreezeArtifact = useFreezeStore((s) => s.unfreezeArtifact);
    const freezeArtifactStore = useFreezeStore((s) => s.freezeArtifact);
    const unfreezeTeamStore = useFreezeStore((s) => s.unfreezeTeam);
    const unfreezeCharactersStore = useFreezeStore((s) => s.unfreezeCharacters);
    const freezeCharactersStore = useFreezeStore((s) => s.freezeCharacters);
    const reuseMode = useFreezeStore((s) => s.reuseMode);
    const setReuseMode = useFreezeStore((s) => s.setReuseMode);
    const clearAllFrozen = useFreezeStore((s) => s.clearAll);
    const teams = useTeamStore((s) => s.teams);
    const activeAccount = useAccountStore(getActiveAccount);
    const accountData = activeAccount?.data || null;
    const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
    const frozenExportRef = useRef<HTMLDivElement>(null);
    const isXl = useMediaQuery("(min-width: 1280px)");

    // ── Append-only snapshots ──
    // These refs grow monotonically during the component's lifetime.
    // They capture ALL frozen data ever seen, so no callback needs to cache anything.
    // Data is only lost when the component unmounts (navigating away from FrozenView).

    // Team artifact data: teamId → charId → slot artifacts
    const teamDataSnapshot = useRef<
      Record<string, Record<string, Record<Slot, ArtifactData | null>>>
    >(null!);
    // Standalone artifact IDs ever seen as frozen
    const everFrozenArtIdsRef = useRef<Set<string>>(null!);
    // Incremented when we mutate the ref directly (clear from snapshot) to invalidate memos
    const [snapshotVersion, setSnapshotVersion] = useState(0);

    // Initialize refs from current store state (runs once, first render)
    if (teamDataSnapshot.current === null) {
      teamDataSnapshot.current = {};
      const state = useFreezeStore.getState();
      absorbTeamData(teamDataSnapshot.current, state.frozenTeams);
    }
    if (everFrozenArtIdsRef.current === null) {
      everFrozenArtIdsRef.current = new Set();
      absorbStandaloneIds(
        everFrozenArtIdsRef.current,
        useFreezeStore.getState().frozenArtifactIds
      );
    }

    // Subscribe to store: absorb data from BOTH prevState and newState on every mutation.
    // This runs synchronously when the store changes, BEFORE React re-renders,
    // so even clearAll() captures prevState before the data is gone.
    useEffect(() => {
      // Re-absorb in case state changed between first render and effect setup
      absorbTeamData(
        teamDataSnapshot.current,
        useFreezeStore.getState().frozenTeams
      );
      absorbStandaloneIds(
        everFrozenArtIdsRef.current,
        useFreezeStore.getState().frozenArtifactIds
      );

      return useFreezeStore.subscribe((state, prevState) => {
        absorbTeamData(teamDataSnapshot.current, prevState.frozenTeams);
        absorbTeamData(teamDataSnapshot.current, state.frozenTeams);
        absorbStandaloneIds(
          everFrozenArtIdsRef.current,
          prevState.frozenArtifactIds
        );
        absorbStandaloneIds(
          everFrozenArtIdsRef.current,
          state.frozenArtifactIds
        );
      });
    }, []);

    // ── Callbacks — just call the store. No caching logic. ──

    const handleUnfreezeChar = useCallback(
      (teamId: string, charId: string) => {
        unfreezeCharactersStore(teamId, [charId]);
      },
      [unfreezeCharactersStore]
    );

    const handleRefreezeChar = useCallback(
      (teamId: string, charId: string) => {
        const artData = teamDataSnapshot.current[teamId]?.[charId];
        if (artData) {
          freezeCharactersStore(teamId, [charId], { [charId]: artData });
        }
      },
      [freezeCharactersStore]
    );

    const handleUnfreezeTeam = useCallback(
      (teamId: string) => {
        unfreezeTeamStore(teamId);
      },
      [unfreezeTeamStore]
    );

    const handleRefreezeTeam = useCallback(
      (teamId: string) => {
        const snapshot = teamDataSnapshot.current[teamId];
        if (!snapshot) return;
        const storeFrozen = new Set(frozenTeams[teamId]?.frozenCharIds ?? []);
        const pendingCharIds = Object.keys(snapshot).filter(
          (cid) => !storeFrozen.has(cid)
        );
        if (pendingCharIds.length === 0) return;
        const artsByChar: Record<
          string,
          Record<Slot, ArtifactData | null>
        > = {};
        for (const cid of pendingCharIds) artsByChar[cid] = snapshot[cid];
        freezeCharactersStore(teamId, pendingCharIds, artsByChar);
      },
      [frozenTeams, freezeCharactersStore]
    );

    const handleClearAll = useCallback(() => {
      clearAllFrozen();
      // That's it. Snapshot refs already have the data.
    }, [clearAllFrozen]);

    /** Remove a standalone artifact from both the store AND the snapshot. */
    const handleClearStandaloneArt = useCallback(
      (artId: string) => {
        unfreezeArtifact(artId);
        everFrozenArtIdsRef.current.delete(artId);
        setSnapshotVersion((v) => v + 1);
      },
      [unfreezeArtifact]
    );

    /** Re-freeze everything that's currently pending (teams + standalone). */
    const handleRefreezeAll = useCallback(() => {
      // Re-freeze all pending team chars
      for (const [teamId, snapshot] of Object.entries(
        teamDataSnapshot.current
      )) {
        const storeFrozen = new Set(frozenTeams[teamId]?.frozenCharIds ?? []);
        const pendingCharIds = Object.keys(snapshot).filter(
          (cid) => !storeFrozen.has(cid)
        );
        if (pendingCharIds.length === 0) continue;
        const artsByChar: Record<
          string,
          Record<Slot, ArtifactData | null>
        > = {};
        for (const cid of pendingCharIds) artsByChar[cid] = snapshot[cid];
        freezeCharactersStore(teamId, pendingCharIds, artsByChar);
      }
      // Re-freeze all pending standalone artifacts
      for (const id of everFrozenArtIdsRef.current) {
        if (!frozenArtifactIds.includes(id)) {
          freezeArtifactStore(id);
        }
      }
    }, [
      frozenTeams,
      frozenArtifactIds,
      freezeCharactersStore,
      freezeArtifactStore,
    ]);

    // ── Derived display data ──

    // Build team entries from snapshot + store state.
    // Snapshot provides the data; store determines frozen vs pending status.
    const frozenTeamEntries = useMemo(() => {
      const entries: {
        teamId: string;
        team: (typeof teams)[number];
        teamIndex: number;
        frozenCharIds: string[];
        pendingRefreezeChars: Record<string, Record<Slot, ArtifactData | null>>;
        artifactsByChar: Record<string, Record<string, ArtifactData>>;
      }[] = [];

      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        const snapshot = teamDataSnapshot.current[team.id];
        const storeData = frozenTeams[team.id];
        if (!snapshot) continue;

        const storeFrozenCharIds = storeData?.frozenCharIds ?? [];
        const storeFrozenSet = new Set(storeFrozenCharIds);

        // Pending = in snapshot but not in store
        const pendingChars: Record<
          string,
          Record<Slot, ArtifactData | null>
        > = {};
        for (const [charId, arts] of Object.entries(snapshot)) {
          if (!storeFrozenSet.has(charId)) pendingChars[charId] = arts;
        }

        const hasFrozen = storeFrozenCharIds.length > 0;
        const hasPending = Object.keys(pendingChars).length > 0;
        if (!hasFrozen && !hasPending) continue;

        // Merge artifact data for display (flatten slot → ArtifactData)
        const merged: Record<string, Record<string, ArtifactData>> = {};
        for (const [cid, arts] of Object.entries(snapshot)) {
          if (!storeFrozenSet.has(cid) && !pendingChars[cid]) continue;
          const slotMap: Record<string, ArtifactData> = {};
          for (const [slot, art] of Object.entries(arts)) {
            if (art) slotMap[slot] = art;
          }
          merged[cid] = slotMap;
        }

        entries.push({
          teamId: team.id,
          team,
          teamIndex: i + 1,
          frozenCharIds: storeFrozenCharIds,
          pendingRefreezeChars: pendingChars,
          artifactsByChar: merged,
        });
      }
      return entries;
    }, [teams, frozenTeams]);

    // ── Standalone frozen artifacts ──

    // Lookup table: artId → { art, slot } from accountData
    const accountArtifactsById = useMemo(() => {
      const map = new Map<string, { art: ArtifactData; slot: Slot }>();
      if (!accountData) return map;
      for (const char of accountData.characters) {
        for (const slot of allSlots) {
          const art = char.artifacts[slot];
          if (art) map.set(art.id, { art, slot });
        }
      }
      for (const art of accountData.extraArtifacts) {
        map.set(art.id, { art, slot: art.slotKey as Slot });
      }
      return map;
    }, [accountData]);

    // Display list: all ever-frozen IDs that exist in accountData.
    // `frozenArtifactIds` in the dependency list ensures recomputation on store changes,
    // which is also when `everFrozenArtIdsRef` gets updated (via subscription).
    const frozenArtIdSet = useMemo(
      () => new Set(frozenArtifactIds),
      [frozenArtifactIds]
    );
    const displayStandaloneArtifacts = useMemo(() => {
      const result: { art: ArtifactData; slot: Slot; isFrozen: boolean }[] = [];
      for (const id of everFrozenArtIdsRef.current) {
        const entry = accountArtifactsById.get(id);
        if (entry) {
          result.push({ ...entry, isFrozen: frozenArtIdSet.has(id) });
        }
      }
      return result;
      // biome-ignore lint/correctness/useExhaustiveDependencies: snapshotVersion invalidates when ref is mutated directly
    }, [accountArtifactsById, frozenArtIdSet, snapshotVersion]);

    // ── Download all frozen ──

    const handleDownloadAllFrozen = useCallback(() => {
      if (!frozenExportRef.current) return;
      const filename = t
        .ui("teamComp.frozenExportFilename")
        .replace("{0}", String(frozenTeamEntries.length));
      downloadElementAsImage(frozenExportRef.current, filename, t);
    }, [t, frozenTeamEntries]);

    useImperativeHandle(ref, () => ({
      downloadAllFrozen: handleDownloadAllFrozen,
    }));

    const hasFrozenTeams = frozenTeamEntries.length > 0;
    const hasStandaloneArtifacts = displayStandaloneArtifacts.length > 0;
    const isEmpty = !hasFrozenTeams && !hasStandaloneArtifacts;

    // Anything pending refreeze? (teams with pending chars OR unfrozen standalone arts)
    const hasPendingAnything = useMemo(() => {
      if (displayStandaloneArtifacts.some((a) => !a.isFrozen)) return true;
      return frozenTeamEntries.some(
        (e) => Object.keys(e.pendingRefreezeChars).length > 0
      );
    }, [displayStandaloneArtifacts, frozenTeamEntries]);

    // Anything currently frozen in the store?
    const hasActiveFrozen = useMemo(
      () =>
        frozenArtifactIds.length > 0 ||
        Object.values(frozenTeams).some((ft) => ft.frozenCharIds.length > 0),
      [frozenArtifactIds, frozenTeams]
    );

    return (
      <ScrollLayout>
        <div className="flex flex-col gap-4 py-2">
          {/* Global freeze controls */}
          <div className="flex items-center justify-center gap-3 px-1 py-0">
            <div className="flex items-center gap-2">
              <span className="text-sm md:text-base font-bold text-foreground whitespace-nowrap">
                {t.ui("teamComp.reuseLabel")}
              </span>
              <Select
                value={reuseMode}
                onValueChange={(v) => setReuseMode(v as ArtifactReuseMode)}
              >
                <SelectTrigger className="w-auto text-sm md:text-base font-bold h-7 md:h-8 gap-1.5 px-3 border-primary/30 bg-primary/10 text-foreground ring-1 ring-primary/15 hover:bg-primary/15">
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
            {hasActiveFrozen && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm leading-none h-8 border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={handleClearAll}
              >
                <Flame className="w-3 h-3" />
                <span>{t.ui("teamComp.unfreezeAll")}</span>
              </Button>
            )}
            {hasPendingAnything && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm leading-none h-8 border-cyan-400/40 text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10"
                onClick={handleRefreezeAll}
              >
                <Snowflake className="w-3 h-3" />
                <span>{t.ui("teamComp.freezeTeam")}</span>
              </Button>
            )}
          </div>

          {/* Standalone frozen artifacts section */}
          <div className="bg-black/15 border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2.5 bg-black/20 border-b border-border">
              <Snowflake className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-bold text-sm text-foreground">
                {t.ui("teamComp.standaloneArtifacts")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFreezeDialogOpen(true)}
                className="ml-auto gap-1.5 font-bold text-xs h-7 px-3 shadow-md border-cyan-400/40 bg-cyan-500/10 text-cyan-300 ring-2 ring-cyan-400/20 hover:!bg-cyan-500/15 hover:!text-cyan-200 hover:ring-cyan-400/40"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.ui("teamComp.freezeArtifact")}
              </Button>
            </div>

            {!hasStandaloneArtifacts && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t.ui("teamComp.frozenEmpty")}
              </div>
            )}

            {/* Grid of standalone frozen artifacts */}
            {displayStandaloneArtifacts.length > 0 && (
              <div className="p-3 flex flex-wrap gap-3">
                {displayStandaloneArtifacts.map(({ art, slot, isFrozen }) => (
                  <div
                    key={art.id}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <ArtifactDataHoverCard
                      artifact={art}
                      slot={slot}
                      side="top"
                    >
                      <div className={cn(!isFrozen && "opacity-50")}>
                        <ItemIcon
                          artifactSetId={art.setKey}
                          slot={slot}
                          rarity={art.rarity}
                          lock={art.lock}
                          level={`+${art.level}`}
                          badge={art.astralMark ? "⭐" : undefined}
                          size="md"
                        />
                      </div>
                    </ArtifactDataHoverCard>
                    <button
                      type="button"
                      onClick={() => handleClearStandaloneArt(art.id)}
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold border border-red-400/30 text-red-400/70 hover:text-red-300 hover:border-red-400/60 hover:bg-red-500/15 transition-colors cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                      {t.ui("common.clear")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-team frozen sections */}
          {frozenTeamEntries.map((entry) => (
            <FrozenTeamSection
              key={entry.teamId}
              teamId={entry.teamId}
              team={entry.team}
              teamIndex={entry.teamIndex}
              frozenCharIds={entry.frozenCharIds}
              pendingRefreezeChars={entry.pendingRefreezeChars}
              artifactsByChar={entry.artifactsByChar}
              accountData={accountData}
              onUnfreezeChar={(charId) =>
                handleUnfreezeChar(entry.teamId, charId)
              }
              onRefreezeChar={(charId) =>
                handleRefreezeChar(entry.teamId, charId)
              }
              onUnfreezeAll={() => handleUnfreezeTeam(entry.teamId)}
              onRefreezeAll={() => handleRefreezeTeam(entry.teamId)}
            />
          ))}

          {/* Empty state — only if no frozen teams AND no standalone section content */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
              <Snowflake className="w-10 h-10 text-cyan-500/30" />
              <p className="text-sm text-muted-foreground">
                {t.ui("teamComp.frozenEmpty")}
              </p>
            </div>
          )}
        </div>

        {/* Hidden export container for download all frozen */}
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
                const optimizedArts =
                  frozenTeams[entry.teamId]?.artifactsByChar ?? {};
                return (
                  <div key={entry.team.id}>
                    {i > 0 && <div className="h-px bg-border/20" />}
                    {entry.team.name && (
                      <div className="text-center py-1.5 text-sm font-bold text-foreground/90 bg-black/20">
                        {entry.team.name}
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-px bg-border/10">
                      {charIds.map((charId) => {
                        const acctChar = accountData?.characters.find(
                          (c: CharacterData) => c.key === charId
                        );
                        const equipped = (acctChar?.artifacts || {}) as Record<
                          string,
                          ArtifactData
                        >;
                        const optimizedRaw = optimizedArts[charId] ?? {};
                        const optimized: Record<string, ArtifactData> = {};
                        for (const [slot, art] of Object.entries(
                          optimizedRaw
                        )) {
                          if (art) optimized[slot] = art;
                        }
                        return (
                          <ExportColumn
                            key={charId}
                            charId={charId}
                            team={entry.team}
                            equipped={equipped}
                            optimized={optimized}
                            ownerMap={ownerMap}
                            accountData={accountData}
                            t={t}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <ArtifactFreezeDialog
          open={freezeDialogOpen}
          onOpenChange={setFreezeDialogOpen}
        />
      </ScrollLayout>
    );
  }
);
