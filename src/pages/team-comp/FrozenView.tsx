import { ArtifactManagerDialog } from "@/components/artifact-manager/ArtifactManagerDialog";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { ArtifactFreezeDialog } from "@/components/team-comp/ArtifactFreezeDialog";
import { FreezeControlBar } from "@/components/team-comp/FreezeControlBar";
import { FrozenExportPanel } from "@/components/team-comp/FrozenExportPanel";
import { FrozenTeamSection } from "@/components/team-comp/FrozenTeamSection";
import { StandaloneArtifactsCard } from "@/components/team-comp/StandaloneArtifactsCard";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ArtifactData, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { buildBatchEquipInstructions } from "@/lib/artifact-manager/instructions";
import { downloadElementAsImage } from "@/lib/downloadImage";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import type { ArtifactReuseMode, FrozenTeam } from "@/stores/useFreezeStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { Snowflake } from "lucide-react";
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

    const [equipDialogOpen, setEquipDialogOpen] = useState(false);

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

    const buildBatchEquipPayload = useCallback(() => {
      const teamInputs = frozenTeamEntries.map((entry) => ({
        team: entry.team,
        optimizedArtifactsByChar: entry.artifactsByChar,
      }));
      return buildBatchEquipInstructions(teamInputs, accountData);
    }, [frozenTeamEntries, accountData]);

    // Show controls when there's meaningful context (account + teams),
    // even if nothing is frozen yet, so users can configure reuse mode
    // and freeze standalone artifacts from the start.
    const hasContext = !!accountData && teams.length > 0;

    return (
      <ScrollLayout>
        <div className="flex flex-col gap-4 py-2">
          {/* Empty state — above controls so it introduces the feature */}
          {isEmpty && (
            <EmptyState
              icon={Snowflake}
              iconColor="text-cyan-500"
              glowColor="bg-cyan-500/20"
              title={t.ui("teamComp.frozenEmptyTitle")}
              description={t.ui("teamComp.frozenEmptyDesc")}
            />
          )}

          {(hasContext || !isEmpty) && (
            <FreezeControlBar
              reuseMode={reuseMode}
              onReuseModeChange={(v) => setReuseMode(v as ArtifactReuseMode)}
              hasActiveFrozen={hasActiveFrozen}
              hasPendingAnything={hasPendingAnything}
              onClearAll={handleClearAll}
              onRefreezeAll={handleRefreezeAll}
              onEquipAll={
                hasFrozenTeams ? () => setEquipDialogOpen(true) : undefined
              }
            />
          )}

          {(hasContext || !isEmpty) && accountData && (
            <StandaloneArtifactsCard
              artifacts={displayStandaloneArtifacts}
              onFreezeClick={() => setFreezeDialogOpen(true)}
              onClearArtifact={handleClearStandaloneArt}
            />
          )}

          {/* Per-team frozen sections */}
          {!isEmpty &&
            frozenTeamEntries.map((entry) => (
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
        </div>

        {hasFrozenTeams && (
          <FrozenExportPanel
            ref={frozenExportRef}
            entries={frozenTeamEntries}
            frozenTeams={frozenTeams}
            accountData={accountData}
            isXl={isXl}
            t={t}
          />
        )}

        <ArtifactFreezeDialog
          open={freezeDialogOpen}
          onOpenChange={setFreezeDialogOpen}
        />

        <ArtifactManagerDialog
          open={equipDialogOpen}
          onOpenChange={setEquipDialogOpen}
          job={{ type: "equip", build: buildBatchEquipPayload }}
          actionLabel={t.ui("manager.equipAll")}
        />
      </ScrollLayout>
    );
  }
);
