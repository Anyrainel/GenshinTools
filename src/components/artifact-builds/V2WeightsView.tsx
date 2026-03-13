/**
 * V2 Weights View
 *
 * Displays pre-computed V2 artifact scoring weights.
 * Data loaded from pre-generated JSON (see generateWeights.ts),
 * falls back to runtime computation if unavailable.
 *
 * Card layout (top → bottom):
 *   1. Header: character portrait + name + scaling/reaction
 *   2. Result row: [weight bars] [main stat picks + calibration]
 *   3. Team sections: [team icon grid] [ideal roll allocation]
 */

import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { DoubleItemIcon } from "@/components/shared/DoubleItemIcon";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import pregenerated from "@/data/generated/v2_weights.json";
import type { Element, SubStat } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import {
  type PipelineResult,
  runPipeline,
} from "@/lib/account-data/scorev2/pipeline";
import type { CharacterBuildProfile } from "@/lib/account-data/scorev2/teamDatabase";
import type {
  BuildV2Weights,
  TeamContext,
} from "@/lib/account-data/scorev2/types";
import { cn, getElementColor } from "@/lib/utils";
import { Clock, Crown, Loader2, Wine } from "lucide-react";
import { useMemo } from "react";

// ── Element hex colors for the accent bar ──

const ELEMENT_HEX: Record<string, string> = {
  Pyro: "#b8483f",
  Hydro: "#22728f",
  Electro: "#8f70aa",
  Cryo: "#7aa8b8",
  Anemo: "#3d9b6a",
  Geo: "#b58f35",
  Dendro: "#669423",
};

// ── Color helpers ──

function barColor(w: number) {
  if (w >= 100) return "bg-amber-400";
  if (w >= 60) return "bg-amber-500/70";
  if (w >= 30) return "bg-amber-600/50";
  return "bg-amber-700/30";
}

function valColor(w: number) {
  if (w >= 100) return "text-amber-300 font-bold";
  if (w >= 60) return "text-amber-200";
  if (w >= 30) return "text-foreground/80";
  return "text-foreground/50";
}

function rollColor(r: number) {
  if (r >= 15) return "text-amber-300";
  if (r >= 5) return "text-foreground/80";
  return "text-foreground/50";
}

// ── Slot icons ──

const SLOT_ICON = { sands: Clock, goblet: Wine, circlet: Crown } as const;

// ── Team icon grid (3 rows: characters, weapons, artifacts) ──

function TeamGrid({
  team,
  tChar,
  tWeapon,
  tArtifact,
}: {
  team: TeamContext;
  tChar: (id: string) => string;
  tWeapon: (id: string) => string;
  tArtifact: (id: string) => string;
}) {
  const placeholder = (key: string, label = "?") => (
    <span
      key={key}
      className="w-10 h-10 rounded bg-muted/20 inline-flex items-center justify-center text-xs text-muted-foreground shrink-0"
    >
      {label}
    </span>
  );

  return (
    <div className="inline-grid grid-cols-4 gap-1">
      {/* Characters */}
      {team.characters.map((id, i) => {
        const c = charactersById[id];
        return c ? (
          <ItemIcon
            key={id}
            imagePath={c.imagePath}
            rarity={c.rarity}
            size="xs"
            title={tChar(id)}
            className={cn(
              i === team.dpsIndex && "ring-1 ring-amber-400/60 rounded-md"
            )}
          />
        ) : (
          placeholder(id)
        );
      })}

      {/* Weapons */}
      {team.builds.map((b, i) => {
        const w = weaponsById[b.weapon];
        return w ? (
          <ItemIcon
            key={`w${i}`}
            imagePath={w.imagePath}
            rarity={w.rarity}
            size="xs"
            title={tWeapon(b.weapon)}
          />
        ) : (
          placeholder(`w${i}`)
        );
      })}

      {/* Artifacts */}
      {team.builds.map((b, i) => {
        if (b.artifacts.length === 0) return placeholder(`a${i}`, "—");
        if (b.artifacts.length === 1) {
          const art = artifactsById[b.artifacts[0]];
          return art ? (
            <ItemIcon
              key={`a${i}`}
              imagePath={art.imagePaths.flower}
              rarity={art.rarity}
              size="xs"
              title={tArtifact(b.artifacts[0])}
            />
          ) : (
            placeholder(`a${i}`)
          );
        }
        // 2+2: resolve half-set IDs → rarity-5 artifact flower images
        {
          const id1 = b.artifacts[0];
          const id2 = b.artifacts[1];

          // Try direct artifact lookup first, fall back to half-set resolution
          const resolveArt = (artId: string, exclude?: string) => {
            const direct = artifactsById[artId];
            if (direct) return direct;
            const half = artifactHalfSetsById[artId];
            if (!half) return undefined;
            return half.setIds
              .filter((sid) => sid !== exclude)
              .map((sid) => artifactsById[sid])
              .find((a) => a?.rarity === 5);
          };

          const art1 = resolveArt(id1);
          const art2 = resolveArt(id2, art1?.id);

          return (
            <DoubleItemIcon
              key={`a${i}`}
              imagePath1={art1?.imagePaths.flower || ""}
              imagePath2={art2?.imagePaths.flower || ""}
              size="xs"
              alt1={art1 ? tArtifact(art1.id) : "?"}
              alt2={art2 ? tArtifact(art2.id) : "?"}
              title={
                art1 && art2
                  ? `${tArtifact(art1.id)} + ${tArtifact(art2.id)}`
                  : undefined
              }
            />
          );
        }
      })}
    </div>
  );
}

// ── Character Card ──

function V2CharacterCard({
  build,
  profile,
}: {
  build: BuildV2Weights;
  profile: CharacterBuildProfile | undefined;
}) {
  const { t } = useLanguage();
  const char = charactersById[build.characterId];
  const elColor = getElementColor(build.element as Element, "text");
  const elHex = ELEMENT_HEX[build.element] || "#888";

  // sorted substats (non-zero only)
  const stats = useMemo(
    () =>
      (Object.entries(build.substats) as [SubStat, number][])
        .filter(([, w]) => w > 0)
        .sort(([, a], [, b]) => b - a),
    [build.substats]
  );

  // sorted ideal rolls (non-zero only)
  const rolls = useMemo(
    () =>
      build.idealRolls
        ? (Object.entries(build.idealRolls) as [SubStat, number][])
            .filter(([, r]) => r > 0)
            .sort(([, a], [, b]) => b - a)
        : [],
    [build.idealRolls]
  );

  const mainSlots = [
    ["sands", build.sands],
    ["goblet", build.goblet],
    ["circlet", build.circlet],
  ] as const;

  return (
    <div className="bg-gradient-card border border-border/50 rounded-lg overflow-hidden">
      {/* Element accent */}
      <div
        className="h-1"
        style={{
          background: `linear-gradient(90deg, ${elHex}, transparent)`,
        }}
      />

      <div className="p-3 space-y-3">
        {/* ── Header ── */}
        <div className="flex items-center gap-2.5">
          {char && (
            <ItemIcon
              imagePath={char.imagePath}
              rarity={char.rarity}
              size="md"
            />
          )}
          <div className="min-w-0">
            <div className={cn("font-bold text-base truncate", elColor)}>
              {t.character(build.characterId)}
            </div>
            <div className="text-sm text-foreground/70">
              {t.statShort(build.scalingStat)} / {t.reaction(build.reaction)}
              {build.artifactSet && (
                <span className="ml-1.5 text-foreground/50">
                  {t.artifact(build.artifactSet)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Result: weights (left) + main stats & calibration (right) ── */}
        <div className="flex gap-6 items-start">
          {/* Weight bars */}
          <table className="border-collapse">
            <tbody>
              {stats.map(([stat, weight]) => (
                <tr key={stat}>
                  <td
                    className={cn(
                      "pr-2 text-sm font-mono text-right whitespace-nowrap",
                      weight >= 100 ? "text-amber-300" : "text-foreground/70"
                    )}
                  >
                    {t.statShort(stat)}
                  </td>
                  <td className="py-[1px]">
                    <div className="w-24 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", barColor(weight))}
                        style={{ width: `${weight}%` }}
                      />
                    </div>
                  </td>
                  <td
                    className={cn(
                      "pl-2 text-sm font-mono text-right tabular-nums",
                      valColor(weight)
                    )}
                  >
                    {weight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Main stat picks + calibration */}
          <div className="space-y-1.5 text-sm">
            {mainSlots.map(([slot, options]) => {
              const Icon = SLOT_ICON[slot];
              return (
                <div
                  key={slot}
                  className="flex items-center gap-1 whitespace-nowrap"
                >
                  <Icon className="w-3.5 h-3.5 text-foreground/50 shrink-0" />
                  <span className="text-foreground/60">
                    {slot === "sands"
                      ? t.ui("v2Weights.sands")
                      : slot === "goblet"
                        ? t.ui("v2Weights.goblet")
                        : t.ui("v2Weights.circlet")}
                  </span>
                  {options.map((ms, i) => (
                    <span
                      key={`${slot}-${i}`}
                      className={cn(
                        "font-mono",
                        i === 0 ? "text-foreground" : "text-foreground/50"
                      )}
                    >
                      {t.statShort(ms.stat)}
                      {ms.weight < 100 && (
                        <span className="text-foreground/60 ml-px">
                          {ms.weight}
                        </span>
                      )}
                      {ms.cdEquiv && ms.cdEquiv !== 62.1 && (
                        <span className="text-foreground/40 ml-px">
                          ({ms.cdEquiv.toFixed(0)})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              );
            })}
            <div className="text-xs text-foreground/50 font-mono tabular-nums pt-0.5">
              {t.ui("v2Weights.idealScore")}={build.idealScore.toFixed(1)}{" "}
              {t.ui("v2Weights.normalizer")}={build.normalizer.toFixed(4)}
            </div>
          </div>
        </div>

        {/* ── Team contexts: grid (left) + ideal rolls (right) ── */}
        {profile && profile.teams.length > 0 && (
          <div className="border-t border-white/10 pt-2 space-y-2">
            {profile.teams.map((team, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <TeamGrid
                  team={team}
                  tChar={t.character}
                  tWeapon={t.weaponName}
                  tArtifact={t.artifact}
                />
                {rolls.length > 0 && (
                  <table className="border-collapse text-sm font-mono">
                    <tbody>
                      {rolls.map(([stat, r]) => (
                        <tr key={stat}>
                          <td className="pr-1.5 text-right text-foreground/60 whitespace-nowrap">
                            {t.statShort(stat)}
                          </td>
                          <td className={cn("tabular-nums", rollColor(r))}>
                            {r}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main View ──

export function V2WeightsView() {
  const { t } = useLanguage();
  const { ready } = useGameStats();

  const result = useMemo((): PipelineResult | null => {
    const pre = pregenerated as unknown as PipelineResult;
    if (pre.builds.length > 0) return pre;
    if (!ready) return null;
    return runPipeline();
  }, [ready]);

  if (!result) {
    return (
      <ScrollLayout>
        <div className="flex items-center justify-center h-64 gap-2 text-foreground/50">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">{t.ui("v2Weights.loading")}</span>
        </div>
      </ScrollLayout>
    );
  }

  return (
    <ScrollLayout className="pb-6 pt-2">
      <div className="mb-3 text-sm text-foreground/50">
        {t.format("v2Weights.profiled", result.builds.length)}
        {result.errors.length > 0 && (
          <span className="ml-2 text-amber-400">
            ({t.format("v2Weights.errors", result.errors.length)})
          </span>
        )}
      </div>

      <div className="grid gap-2.5 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
        {result.builds.map((build) => (
          <V2CharacterCard
            key={build.characterId}
            build={build}
            profile={result.profiles[build.characterId]}
          />
        ))}
      </div>

      {result.errors.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <h4 className="text-sm font-semibold text-destructive mb-1.5">
            {t.ui("v2Weights.generationErrors")}
          </h4>
          <ul className="text-sm text-foreground/70 space-y-0.5">
            {result.errors.map((err) => (
              <li key={err.characterId}>
                <span className="font-medium text-foreground/90">
                  {t.character(err.characterId)}
                </span>
                : {err.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ScrollLayout>
  );
}
