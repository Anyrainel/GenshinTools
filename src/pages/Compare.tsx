/**
 * Compare page: Load optimizer testbed result JSONs and compare
 * per-team optimization results across algorithms (V1, V2, etc.).
 *
 * Computes live damage/stat sheets from artifact assignments and
 * displays using the same components as TeamOptDetail.
 */

import { PageLayout } from "@/components/layout/PageLayout";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { BuffLedger } from "@/components/team-comp/BuffLedger";
import { FormulaBreakdown } from "@/components/team-comp/FormulaBreakdown";
import { StatSheetPanel } from "@/components/team-comp/StatSheetPanel";
import { fmtDamage } from "@/components/team-comp/displayFormatters";
import { detectEquippedSets } from "@/components/team-comp/teamOptUtils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactIdToHalfSetId,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import type { ArtifactData, CharacterData, Element, Slot } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  getCharacterDisplayMeta,
  getCharacterLevelTier,
  getWeaponDisplayMeta,
} from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  CharCompConfig,
  DisplayResult,
  StatKey,
} from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import type { Team } from "@/stores/useTeamStore";
import {
  ChevronDown,
  Clock,
  FileUp,
  Flame,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

// Side-effect barrel: registers all character/weapon/artifact implementations.
import "@/lib/team-comp/index";

// ─── Preset teams import ────────────────────────────────────────────────────

import flagshipTeamsJson from "@/presets/team-comp/[GGArtifact] 战舰队伍 Flagship Teams.json";

// Auto-import all optimizer result files from scripts/output/
const resultModules = import.meta.glob<TestbedOutputRaw>(
  "/scripts/output/optimizer-*-results*.json",
  { eager: true, import: "default" }
);

/** Derive a unique label from the filename, e.g. "optimizer-v2-results-pre-refine.json" → "v2-pre-refine" */
function labelFromPath(path: string): string {
  const filename = path.split("/").pop() ?? path;
  return (
    filename
      .replace(/^optimizer-/, "")
      .replace(/-results/, "")
      .replace(/\.json$/, "") || "unknown"
  );
}

function loadStaticDatasets(): TestbedOutput[] {
  const out: TestbedOutput[] = [];
  for (const [path, data] of Object.entries(resultModules)) {
    if (data?.algorithm && data?.results) {
      const id = labelFromPath(path);
      out.push({ ...data, id, label: id });
    }
  }
  return out;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ArtifactConfig {
  type: "4pc" | "2pc+2pc";
  setId?: string;
  id1?: string | number;
  id2?: string | number;
}

interface PresetTeam {
  id: string;
  name: string;
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ArtifactConfig | null)[];
  reactions: string[];
  opts: Record<string, string>;
  targetEr: Record<string, number>;
  targetCr?: Record<string, number>;
  selectedFormula: { charId: string; formulaId: string } | null;
  calcContext?: Partial<CalcContext>;
  reactionOverrides?: Record<string, unknown>;
  enemyElementAura?: string;
}

interface FormulaResult {
  formulaId: string;
  labelEn: string;
  damage: number;
}

interface TeamResult {
  teamId: string;
  teamName: string;
  characters: string[];
  carryCharId: string;
  optimizedFormulaId: string;
  optimizedDamage: number;
  optimizeTimeSec: number;
  formulaResults: FormulaResult[];
  error?: string;
  artifactAssignment: Record<string, Record<string, string>>;
  failReasons: Record<string, string>;
}

/** Raw shape from JSON (no id/label). */
interface TestbedOutputRaw {
  algorithm: string;
  timestamp: string;
  accountFile: string;
  totalTeams: number;
  results: TeamResult[];
}

/** With unique id/label derived from filename. */
interface TestbedOutput {
  id: string;
  label: string;
  algorithm: string;
  timestamp: string;
  accountFile: string;
  totalTeams: number;
  results: TeamResult[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pctDiff(a: number, b: number): string {
  if (b === 0) return "N/A";
  const diff = ((a - b) / b) * 100;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)}%`;
}

const CARD_CLS = "bg-gradient-card border-border/50 overflow-hidden shadow-lg";
const CARD_HEADER_CLS =
  "bg-gradient-select border-b border-border/40 py-3 px-2 md:px-5";
const CARD_TITLE_CLS =
  "text-base font-bold flex items-center gap-2 tracking-tight text-primary-foreground/90";
const CARD_BODY_CLS = "p-1.5 md:p-3 bg-black/10";

const DEFAULT_CALC_CONTEXT: CalcContext = {
  enemyLevel: 110,
  enemyRes: 0.1,
  assumeCrit: false,
};

// ─── Build preset team lookup ───────────────────────────────────────────────

const presetTeams = (
  "teams" in flagshipTeamsJson
    ? (flagshipTeamsJson as { teams: PresetTeam[] }).teams
    : (flagshipTeamsJson as unknown as PresetTeam[])
) as PresetTeam[];

const presetTeamsById = new Map<string, PresetTeam>();
for (const t of presetTeams) {
  presetTeamsById.set(t.id, t);
}

/** Build CharCompConfig from preset team + optionally override artifact sets from resolved artifacts. */
function buildConfigsFromPreset(
  preset: PresetTeam,
  resolvedArtsByChar: Record<string, Record<string, ArtifactData>> | null,
  accountData: {
    characters: CharacterData[];
    extraWeapons: { key: string; refinement: number }[];
  } | null
): CharCompConfig[] {
  const configs: CharCompConfig[] = [];
  for (let i = 0; i < 4; i++) {
    const charId = preset.characters[i];
    const weaponId = preset.weapons[i];
    if (!charId || !weaponId) continue;

    const acctChar = accountData?.characters.find((c) => c.key === charId);

    const levelOverride = preset.opts?.[`${charId}.overrideLevel`];
    const consOverride = preset.opts?.[`${charId}.overrideConstellation`];

    const charLevel = levelOverride
      ? Number.parseInt(levelOverride)
      : acctChar
        ? Number(getCharacterLevelTier(acctChar.level))
        : 90;
    const constellation =
      consOverride !== undefined
        ? Number.parseInt(consOverride)
        : (acctChar?.constellation ?? 0);

    // Resolve weapon refinement
    let refinement = 1;
    const refOverride = preset.opts?.[`${charId}.overrideRefinement`];
    if (refOverride !== undefined) {
      refinement = Number.parseInt(refOverride);
    } else if (accountData) {
      const allWeapons = [
        ...accountData.extraWeapons,
        ...accountData.characters
          .map((c) => c.weapon)
          .filter((w): w is NonNullable<typeof w> => !!w),
      ];
      const matchingWeapon = allWeapons.find((w) => w.key === weaponId);
      if (matchingWeapon) refinement = matchingWeapon.refinement;
    }

    // Detect artifact sets from resolved artifacts if available
    let artifactSetId: string | null = null;
    let artifactHalfSetIds: string[] = [];

    if (resolvedArtsByChar?.[charId]) {
      const arts = Object.values(resolvedArtsByChar[charId]);
      if (arts.length > 0) {
        const detected = detectEquippedSets(arts);
        artifactSetId = detected.artifactSetId;
        artifactHalfSetIds = detected.artifactHalfSetIds;
      }
    }

    // Fallback to preset goal sets
    if (!artifactSetId && artifactHalfSetIds.length !== 2) {
      const goalArt = preset.artifacts[i];
      if (goalArt?.type === "4pc") {
        artifactSetId = goalArt.setId ?? null;
      } else if (goalArt?.type === "2pc+2pc") {
        artifactHalfSetIds = [String(goalArt.id1), String(goalArt.id2)];
      }
    }

    configs.push({
      charId,
      charLevel,
      constellation,
      weaponId,
      refinement,
      artifactSetId,
      artifactHalfSetIds,
    });
  }
  return configs;
}

/** Convert preset team to a store-compatible Team object for display components. */
function presetToTeam(preset: PresetTeam): Team {
  return {
    id: preset.id,
    name: preset.name,
    characters: preset.characters,
    weapons: preset.weapons,
    artifacts: preset.artifacts as Team["artifacts"],
    reactions: preset.reactions as Team["reactions"],
    opts: preset.opts || {},
    targetEr: preset.targetEr || {},
    targetCr: preset.targetCr,
    selectedFormula: preset.selectedFormula,
    calcContext: preset.calcContext,
    reactionOverrides: (preset.reactionOverrides ??
      {}) as Team["reactionOverrides"],
    formulaMode: "single",
    combos: [],
    enemyElementAura: preset.enemyElementAura as Team["enemyElementAura"],
    optimizationResult: null,
    selectedCombo: null,
  };
}

// ─── Computed result for a team + algorithm ──────────────────────────────────

interface ComputedResult {
  teamBuild: TeamBuild;
  displayResult: DisplayResult | null;
  damageValue: number | null;
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  calcContext: CalcContext;
  carryCharId: string;
  formulaId: string;
  /** formulaId → I18nLabel for the carry character */
  formulaLabels: Record<string, { zh: string; en: string }>;
}

function computeResult(
  preset: PresetTeam,
  teamResult: TeamResult,
  artifactById: Map<string, ArtifactData>,
  accountData: {
    characters: CharacterData[];
    extraWeapons: { key: string; refinement: number }[];
  } | null,
  formulaIdOverride?: string | null
): ComputedResult | null {
  // Resolve artifacts
  const artifactsByChar: Record<string, Record<string, ArtifactData>> = {};
  for (const [charId, slots] of Object.entries(teamResult.artifactAssignment)) {
    artifactsByChar[charId] = {};
    for (const [slot, artId] of Object.entries(slots)) {
      const art = artifactById.get(artId);
      if (art) artifactsByChar[charId][slot] = art;
    }
  }

  try {
    const configs = buildConfigsFromPreset(
      preset,
      artifactsByChar,
      accountData
    );
    if (configs.length === 0) return null;

    const teamBuild = new TeamBuild(
      configs,
      preset.opts || {},
      preset.enemyElementAura as Element | undefined
    );

    const calcContext: CalcContext = {
      enemyLevel:
        preset.calcContext?.enemyLevel ?? DEFAULT_CALC_CONTEXT.enemyLevel,
      enemyRes: preset.calcContext?.enemyRes ?? DEFAULT_CALC_CONTEXT.enemyRes,
      assumeCrit:
        preset.calcContext?.assumeCrit ?? DEFAULT_CALC_CONTEXT.assumeCrit,
    };

    const carryCharId = teamResult.carryCharId;
    const formulaId = formulaIdOverride || teamResult.optimizedFormulaId;

    // Build StatSheets
    const sheets: Record<string, StatSheet> = {};
    for (const charId of preset.characters) {
      if (!charId) continue;
      const arts = Object.values(artifactsByChar[charId] || {});
      sheets[charId] = StatSheet.fromArtifacts(arts);
    }

    // Compute display result
    const allFormulas = teamBuild.getFormulaIds()[carryCharId] ?? {};
    const formulaLabels: Record<string, { zh: string; en: string }> = {};
    for (const [fid, lbl] of Object.entries(allFormulas)) {
      formulaLabels[fid] = lbl;
    }

    if (!allFormulas[formulaId]) {
      return {
        teamBuild,
        displayResult: null,
        damageValue: teamResult.optimizedDamage,
        artifactsByChar,
        calcContext,
        carryCharId,
        formulaId,
        formulaLabels,
      };
    }

    const displayContext: CalcContext = {
      ...calcContext,
      critRateTarget: undefined,
    };
    const displayResult = teamBuild.getDisplayResult(
      carryCharId,
      formulaId,
      sheets,
      displayContext
    );

    const postStats = teamBuild.getTeamStats(sheets, carryCharId, calcContext);
    const damageResult = teamBuild.getDamageResult(
      carryCharId,
      formulaId,
      postStats,
      displayContext
    );

    return {
      teamBuild,
      displayResult,
      damageValue: damageResult.totalDamage,
      artifactsByChar,
      calcContext,
      carryCharId,
      formulaId,
      formulaLabels,
    };
  } catch (e) {
    console.error("computeResult failed:", e);
    return null;
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { characterStats, weaponStats } = useGameStats();
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;

  const [datasets, setDatasets] = useState<TestbedOutput[]>(loadStaticDatasets);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null
  );
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(
    null
  );
  const [formulaExpanded, setFormulaExpanded] = useState(true);

  // Build artifact lookup from account data (artifact-N → ArtifactData)
  const artifactById = useMemo(() => {
    const map = new Map<string, ArtifactData>();
    if (!accountData) return map;
    const allArts: ArtifactData[] = [
      ...accountData.characters.flatMap((c: CharacterData) =>
        (
          Object.values(c.artifacts || {}) as (ArtifactData | undefined)[]
        ).filter((a): a is ArtifactData => !!a)
      ),
      ...(accountData.extraArtifacts || []),
    ];
    for (const art of allArts) {
      if (art?.id) map.set(art.id, art);
    }
    return map;
  }, [accountData]);

  // All unique team IDs across datasets
  const allTeamIds = useMemo(() => {
    const seen = new Map<string, { teamName: string; characters: string[] }>();
    for (const ds of datasets) {
      for (const r of ds.results) {
        if (!seen.has(r.teamId)) {
          seen.set(r.teamId, {
            teamName: r.teamName,
            characters: r.characters,
          });
        }
      }
    }
    return seen;
  }, [datasets]);

  // Auto-select first dataset when team changes
  const activeDatasetId = useMemo(() => {
    if (selectedDatasetId && datasets.some((d) => d.id === selectedDatasetId)) {
      return selectedDatasetId;
    }
    return datasets[0]?.id ?? null;
  }, [selectedDatasetId, datasets]);

  // Get all results for selected team
  const selectedResults = useMemo(() => {
    if (!selectedTeamId) return [];
    return datasets.map((ds) => ({
      id: ds.id,
      label: ds.label,
      algorithm: ds.algorithm,
      timestamp: ds.timestamp,
      result: ds.results.find((r) => r.teamId === selectedTeamId) || null,
    }));
  }, [selectedTeamId, datasets]);

  // Compute full display result for selected team + dataset
  const computed = useMemo(() => {
    if (!selectedTeamId || !activeDatasetId) return null;
    const ds = datasets.find((d) => d.id === activeDatasetId);
    const teamResult = ds?.results.find((r) => r.teamId === selectedTeamId);
    if (!teamResult || teamResult.error) return null;

    const preset = presetTeamsById.get(selectedTeamId);
    if (!preset) return null;

    return computeResult(
      preset,
      teamResult,
      artifactById,
      accountData,
      selectedFormulaId
    );
  }, [
    selectedTeamId,
    activeDatasetId,
    datasets,
    artifactById,
    accountData,
    selectedFormulaId,
  ]);

  // Store-compatible Team object for display components
  const displayTeam = useMemo(() => {
    const preset = selectedTeamId ? presetTeamsById.get(selectedTeamId) : null;
    return preset ? presetToTeam(preset) : null;
  }, [selectedTeamId]);

  // Current team result for the active dataset
  const activeResult = useMemo(() => {
    return (
      selectedResults.find((r) => r.id === activeDatasetId)?.result ?? null
    );
  }, [selectedResults, activeDatasetId]);

  // ─── Sidebar: team list ───────────────────────────────────────────────────

  const sidebar = (
    <div className="space-y-1">
      {Array.from(allTeamIds.entries()).map(
        ([teamId, { teamName, characters }]) => {
          const isActive = teamId === selectedTeamId;
          const damages = datasets
            .map((ds) => ds.results.find((r) => r.teamId === teamId))
            .filter((r) => r && !r.error)
            .map((r) => r!.optimizedDamage);
          const hasDiff =
            damages.length > 1 && Math.max(...damages) !== Math.min(...damages);

          return (
            <button
              type="button"
              key={teamId}
              onClick={() => {
                setSelectedTeamId(teamId);
                setSelectedFormulaId(null);
              }}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-md transition-colors text-sm",
                isActive
                  ? "bg-primary/20 text-foreground"
                  : "hover:bg-muted/50 text-muted-foreground"
              )}
            >
              <div className="font-medium truncate">
                {teamName || characters.join(" / ")}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {characters.slice(0, 4).map((charId) => {
                  const charDef = charactersById[charId];
                  if (!charDef) return null;
                  return (
                    <img
                      key={charId}
                      src={getAssetUrl(charDef.imagePath)}
                      alt={charId}
                      className="w-6 h-6 rounded-full bg-black/20"
                      title={t.character(charId)}
                    />
                  );
                })}
                {hasDiff && (
                  <span className="ml-auto text-[10px] text-yellow-400 font-mono">
                    有差异
                  </span>
                )}
              </div>
            </button>
          );
        }
      )}
      {allTeamIds.size === 0 && (
        <div className="text-center text-muted-foreground text-sm py-8">
          {t.ui("common.loading")}
        </div>
      )}
    </div>
  );

  // ─── Detail ───────────────────────────────────────────────────────────────

  const preset = selectedTeamId ? presetTeamsById.get(selectedTeamId) : null;

  const detail =
    selectedTeamId && preset && displayTeam ? (
      <div
        className={cn(
          "flex flex-col w-full animate-in fade-in duration-300 pb-12",
          isMobile ? "gap-1.5" : "gap-2"
        )}
      >
        {/* Team header */}
        <div
          className={cn(
            "flex items-center gap-2",
            isMobile ? "px-0.5" : "px-1"
          )}
        >
          <h2 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/60 tracking-tight truncate">
            {preset.name ||
              preset.characters
                .filter(Boolean)
                .map((c) => t.character(c!))
                .join(" / ")}
          </h2>
        </div>

        {/* Card 1: Team Roster (read-only) */}
        <Card className={CARD_CLS}>
          <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
            <h3 className={CARD_TITLE_CLS}>
              <Users className="w-4 h-4 opacity-70" />
              <span>{t.ui("teamComp.teamRoster")}</span>
            </h3>
          </CardHeader>
          <CardContent className={CARD_BODY_CLS}>
            <div
              className={cn(
                "grid",
                isMobile
                  ? "grid-cols-2 gap-1.5"
                  : "grid-cols-2 lg:grid-cols-4 gap-3"
              )}
            >
              {preset.characters.map((charId, i) => {
                if (!charId) return <div key={i} />;
                const char = charactersById[charId];
                const weaponId = preset.weapons[i];
                const weapon = weaponId ? weaponsById[weaponId] : null;
                const artConfig = preset.artifacts[i];

                const acctChar = accountData?.characters.find(
                  (c: CharacterData) => c.key === charId
                );
                const charLevel =
                  preset.opts?.[`${charId}.overrideLevel`] !== undefined
                    ? Number(preset.opts[`${charId}.overrideLevel`])
                    : acctChar
                      ? Number(getCharacterLevelTier(acctChar.level))
                      : 90;
                const charConst =
                  preset.opts?.[`${charId}.overrideConstellation`] !== undefined
                    ? Number(preset.opts[`${charId}.overrideConstellation`])
                    : (acctChar?.constellation ?? 0);

                const charMeta = char
                  ? getCharacterDisplayMeta(char, characterStats?.[charId])
                  : null;
                const weaponMeta = weapon
                  ? getWeaponDisplayMeta(weapon, weaponStats?.[weaponId!])
                  : null;

                // Artifact set display
                let artSetLabel = "";
                if (artConfig?.type === "4pc" && artConfig.setId) {
                  artSetLabel = `4pc ${t.artifact(artConfig.setId)}`;
                } else if (artConfig?.type === "2pc+2pc") {
                  const h1 = String(artConfig.id1);
                  const h2 = String(artConfig.id2);
                  artSetLabel = `2+2 ${t.halfSetShort(h1)} / ${t.halfSetShort(h2)}`;
                }

                return (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col rounded-lg bg-black/10 border border-border/10",
                      isMobile ? "p-1 gap-1" : "p-2 gap-1.5"
                    )}
                  >
                    {/* Row 1: Character + Weapon portraits */}
                    <div
                      className={cn(
                        "flex items-end",
                        isMobile ? "gap-0.5" : "gap-1.5"
                      )}
                    >
                      {char && (
                        <div
                          className={cn(
                            "rounded-full bg-secondary/40 overflow-hidden shrink-0 border border-border/30",
                            isMobile ? "w-10 h-10" : "w-14 h-14"
                          )}
                        >
                          <img
                            src={getAssetUrl(char.imagePath)}
                            alt={charId}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      {weapon && (
                        <div
                          className={cn(
                            "rounded bg-secondary/40 overflow-hidden shrink-0 border border-border/30",
                            isMobile ? "w-8 h-8" : "w-10 h-10"
                          )}
                        >
                          <img
                            src={getAssetUrl(weapon.imagePath)}
                            alt={weaponId!}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      {artConfig &&
                        (() => {
                          const artSetId =
                            artConfig.type === "4pc"
                              ? artConfig.setId
                              : undefined;
                          const artInfo = artSetId
                            ? artifactsById[artSetId]
                            : undefined;
                          const imgPath = artInfo?.imagePaths?.flower;
                          if (!imgPath) return null;
                          return (
                            <div
                              className={cn(
                                "rounded bg-secondary/40 overflow-hidden shrink-0 border border-border/30",
                                isMobile ? "w-8 h-8" : "w-10 h-10"
                              )}
                            >
                              <img
                                src={getAssetUrl(imgPath)}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            </div>
                          );
                        })()}
                    </div>

                    {/* Row 2: Name + info */}
                    <div className="flex items-center flex-wrap gap-1">
                      <span
                        className={cn(
                          "font-bold text-foreground/90",
                          isMobile ? "text-xs" : "text-sm"
                        )}
                      >
                        {t.character(charId)}
                      </span>
                    </div>

                    {/* Row 3: Level / Const / ER */}
                    <div
                      className={cn(
                        "flex items-center gap-1 flex-wrap text-muted-foreground",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      <span>Lv.{charLevel}</span>
                      <span>C{charConst}</span>
                      {weaponId && (
                        <span className="truncate max-w-[80px]">
                          {weaponId}
                        </span>
                      )}
                      <span>
                        ER{" "}
                        {Math.round((preset.targetEr?.[charId] ?? 1.0) * 100)}%
                      </span>
                    </div>

                    {/* Row 4: Artifact set */}
                    {artSetLabel && (
                      <div
                        className={cn(
                          "text-muted-foreground truncate",
                          isMobile ? "text-[10px]" : "text-xs"
                        )}
                      >
                        {artSetLabel}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Damage Comparison Summary */}
        <Card className={CARD_CLS}>
          <CardHeader className={CARD_HEADER_CLS}>
            <div className={CARD_TITLE_CLS}>
              <Swords className="w-4 h-4" />
              {t.ui("teamComp.totalExpectedDamage")}
            </div>
          </CardHeader>
          <CardContent className={CARD_BODY_CLS}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                      算法
                    </th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">
                      {t.ui("teamComp.totalExpectedDamage")}
                    </th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">
                      耗时
                    </th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">
                      对比最优
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const validResults = selectedResults.filter(
                      (r) => r.result && !r.result.error
                    );
                    const bestDamage = Math.max(
                      0,
                      ...validResults.map((r) => r.result!.optimizedDamage)
                    );
                    return selectedResults.map((entry) => {
                      const r = entry.result;
                      const isSelected = entry.id === activeDatasetId;
                      if (!r)
                        return (
                          <tr
                            key={entry.id}
                            className="border-b border-border/10"
                          >
                            <td className="py-2 px-2 font-medium">
                              {entry.label}
                            </td>
                            <td
                              colSpan={3}
                              className="py-2 px-2 text-muted-foreground text-center"
                            >
                              —
                            </td>
                          </tr>
                        );
                      if (r.error)
                        return (
                          <tr
                            key={entry.id}
                            className="border-b border-border/10"
                          >
                            <td className="py-2 px-2 font-medium">
                              {entry.label}
                            </td>
                            <td
                              colSpan={3}
                              className="py-2 px-2 text-red-400 text-center"
                            >
                              {r.error}
                            </td>
                          </tr>
                        );
                      const isBest = r.optimizedDamage === bestDamage;
                      return (
                        <tr
                          key={entry.id}
                          onClick={() => setSelectedDatasetId(entry.id)}
                          className={cn(
                            "border-b border-border/10 cursor-pointer transition-colors",
                            isSelected ? "bg-primary/10" : "hover:bg-white/5",
                            isBest && "bg-primary/5"
                          )}
                        >
                          <td className="py-2 px-2 font-medium flex items-center gap-1.5">
                            {entry.label}
                            {isBest && validResults.length > 1 && (
                              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                            )}
                            {isSelected && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded font-mono">
                                {t.ui("teamComp.viewing") ?? "查看中"}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-[math] font-bold tabular-nums">
                            {fmtDamage(r.optimizedDamage)}
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {r.optimizeTimeSec.toFixed(1)}s
                            </span>
                          </td>
                          <td
                            className={cn(
                              "py-2 px-2 text-right tabular-nums font-mono text-xs",
                              isBest ? "text-green-400" : "text-red-400"
                            )}
                          >
                            {isBest
                              ? "最优"
                              : pctDiff(r.optimizedDamage, bestDamage)}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Formula results (all formulas across algorithms) */}
            {(() => {
              const allFormulas = new Set<string>();
              for (const entry of selectedResults) {
                if (!entry.result) continue;
                for (const f of entry.result.formulaResults)
                  allFormulas.add(f.formulaId);
              }
              if (allFormulas.size === 0) return null;
              return (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    <Flame className="w-3 h-3 inline mr-1" />
                    {t.ui("teamComp.allFormulas") ?? "全部公式"}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/20">
                          <th className="text-left py-1 px-1 text-muted-foreground">
                            公式
                          </th>
                          {selectedResults.map((e) => (
                            <th
                              key={e.id}
                              className="text-right py-1 px-1 text-muted-foreground"
                            >
                              {e.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(allFormulas).map((fid) => {
                          const values = selectedResults.map(
                            (entry) =>
                              entry.result?.formulaResults.find(
                                (f) => f.formulaId === fid
                              )?.damage ?? 0
                          );
                          const bestVal = Math.max(
                            ...values.filter((v) => v > 0)
                          );
                          const isOptimized =
                            activeResult?.optimizedFormulaId === fid;
                          const isViewing =
                            (selectedFormulaId ??
                              activeResult?.optimizedFormulaId) === fid;
                          return (
                            <tr
                              key={fid}
                              onClick={() => setSelectedFormulaId(fid)}
                              className={cn(
                                "border-b border-border/10 cursor-pointer transition-colors",
                                isViewing ? "bg-primary/10" : "hover:bg-white/5"
                              )}
                            >
                              <td className="py-1 px-1 truncate max-w-[200px] flex items-center gap-1">
                                {computed?.formulaLabels[fid]?.zh ||
                                  computed?.formulaLabels[fid]?.en ||
                                  fid}
                                {isOptimized && (
                                  <Trophy className="w-3 h-3 text-yellow-400 shrink-0" />
                                )}
                                {isViewing && (
                                  <span className="text-[9px] px-1 py-0.5 bg-primary/20 text-primary rounded font-mono shrink-0">
                                    ▶
                                  </span>
                                )}
                              </td>
                              {values.map((val, i) => (
                                <td
                                  key={selectedResults[i].id}
                                  className={cn(
                                    "py-1 px-1 text-right tabular-nums font-[math]",
                                    val === bestVal &&
                                      values.filter((v) => v > 0).length > 1
                                      ? "text-green-400 font-bold"
                                      : ""
                                  )}
                                >
                                  {val > 0 ? fmtDamage(val) : "—"}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Card 3: Stat Sheet + Artifacts + Formula + Buffs (DamageCard style) */}
        {activeResult && !activeResult.error && (
          <Card className={CARD_CLS}>
            <CardHeader className={CARD_HEADER_CLS}>
              <div className={CARD_TITLE_CLS}>
                {/* Dataset selector tabs */}
                <div className="flex items-center gap-1 flex-wrap">
                  {datasets.map((ds) => {
                    const hasResult = ds.results.some(
                      (r) => r.teamId === selectedTeamId && !r.error
                    );
                    if (!hasResult) return null;
                    const isActive = ds.id === activeDatasetId;
                    return (
                      <button
                        key={ds.id}
                        type="button"
                        onClick={() => setSelectedDatasetId(ds.id)}
                        className={cn(
                          "px-3 py-1 rounded-md text-sm font-bold transition-all",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                        )}
                      >
                        {ds.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  {fmtDamage(activeResult.optimizedDamage)} |{" "}
                  {activeResult.optimizeTimeSec.toFixed(1)}s
                </span>
              </div>
            </CardHeader>
            <CardContent className={CARD_BODY_CLS}>
              {computed && displayTeam ? (
                <div className={cn(isMobile ? "space-y-2" : "space-y-4")}>
                  {/* StatSheetPanel — per-character artifacts + stats */}
                  <StatSheetPanel
                    result={computed.displayResult}
                    team={displayTeam}
                    artifactsByChar={computed.artifactsByChar}
                    targetCharId={computed.carryCharId}
                    highlightedStat={null}
                    onStatHover={() => {}}
                    t={t}
                  />

                  {/* Damage value + formula breakdown */}
                  <Collapsible
                    open={formulaExpanded}
                    onOpenChange={setFormulaExpanded}
                  >
                    <div
                      className={cn(
                        "border border-dashed border-border/20 rounded-lg bg-black/5 text-sm",
                        isMobile ? "p-1.5" : "p-2"
                      )}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <CollapsibleTrigger asChild>
                          <div
                            className={cn(
                              "flex items-center justify-center rounded-xl transition-colors cursor-pointer select-none",
                              isMobile
                                ? "gap-1.5 px-2 py-1.5"
                                : "gap-2.5 px-4 py-2",
                              "bg-primary/10 border border-primary/30 ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.12)]",
                              "hover:bg-primary/15"
                            )}
                          >
                            <div
                              className={cn(
                                "text-primary/80 font-semibold tracking-wide whitespace-nowrap",
                                isMobile ? "text-xs" : "text-sm md:text-base"
                              )}
                            >
                              {t.ui("teamComp.totalExpectedDamage")}
                            </div>
                            <div
                              className={cn(
                                "text-foreground font-[math] font-black drop-shadow-sm",
                                isMobile ? "text-2xl" : "text-3xl md:text-4xl"
                              )}
                            >
                              {fmtDamage(computed.damageValue)}
                            </div>
                            <span
                              className={cn(
                                "text-muted-foreground whitespace-nowrap",
                                isMobile
                                  ? "text-[10px] ml-0.5"
                                  : "text-xs ml-1.5"
                              )}
                            >
                              {formulaExpanded
                                ? t.ui("teamComp.collapseFormula")
                                : t.ui("teamComp.expandFormula")}
                            </span>
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                                formulaExpanded && "rotate-180"
                              )}
                            />
                          </div>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        {computed.displayResult && (
                          <FormulaBreakdown
                            parts={computed.displayResult.parts}
                            highlightedStat={null}
                            t={t}
                          />
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>

                  {/* Buff Ledger */}
                  {computed.displayResult && (
                    <BuffLedger
                      buffs={computed.displayResult.buffs}
                      team={displayTeam}
                      t={t}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-8">
                  {!accountData
                    ? (t.ui("teamComp.noAccountData") ??
                      "请先加载账号数据以查看圣遗物详情")
                    : t.ui("common.loading")}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm py-16">
        {datasets.length === 0 ? (
          <>
            <FileUp className="w-12 h-12 mb-4 opacity-30" />
            <p>未找到优化结果文件</p>
            <p className="text-xs mt-1">
              <code className="bg-black/20 px-1 rounded">
                scripts/output/optimizer-*.json
              </code>
            </p>
          </>
        ) : (
          <>
            <Swords className="w-12 h-12 mb-4 opacity-30" />
            <p>{t.ui("teamComp.selectTeam") ?? "选择队伍"}</p>
          </>
        )}
      </div>
    );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <PageLayout>
      <SidebarDetailLayout
        sidebarWidth="w-1/4 max-w-[16rem]"
        sidebar={sidebar}
        hasSelection={!!selectedTeamId}
        onBack={() => setSelectedTeamId(null)}
        backLabel={t.ui("teamComp.teamRoster")}
        header={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">算法对比</span>
            {datasets.map((ds) => (
              <span
                key={ds.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted/50 text-xs font-mono"
              >
                {ds.label}
                <span className="text-muted-foreground">
                  ({ds.results.length})
                </span>
              </span>
            ))}
            {!accountData && datasets.length > 0 && (
              <span className="text-xs text-yellow-400">
                {t.ui("teamComp.noAccountData") ?? "请先加载账号数据"}
              </span>
            )}
          </div>
        }
      >
        {detail}
      </SidebarDetailLayout>
    </PageLayout>
  );
}
