import { CharacterCard } from "@/components/account-data/CharacterCard";
import { BuildCard } from "@/components/artifact-builds/BuildCard";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
import { SectionErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { CharacterResource } from "@/data/types";
import type { useGameStats } from "@/hooks/useGameStats";
import {
  useConstellation,
  useIsOwned,
  useOwnershipActions,
} from "@/hooks/useOwnership";
import { useResolvedBuilds } from "@/hooks/useResolvedBuilds";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { cn } from "@/lib/utils";
import { useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { Bookmark, ChevronRight, Info, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BaseStatsTable } from "./BaseStatsTable";
import { EffectCard } from "./EffectCard";
import { SkillCard } from "./SkillCard";

function KitSection({
  title,
  columns,
  children,
}: {
  title: string;
  /** When true, items display in 2 columns on xl+ screens */
  columns?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-muted-foreground px-1">
        {title}
      </h3>
      <div
        className={
          columns
            ? "grid gap-2 grid-cols-1 xl:grid-cols-2"
            : "flex flex-col gap-2"
        }
      >
        {children}
      </div>
    </div>
  );
}

function LinkedBuildSection({
  character,
  characterStats,
}: {
  character: CharacterResource;
  characterStats: ReturnType<typeof useGameStats>["characterStats"];
}) {
  const { t } = useLanguage();
  const builds = useResolvedBuilds(character.id);
  const newBuild = useBuildsStore((state) => state.newBuild);
  const removeBuild = useBuildsStore((state) => state.removeBuild);
  const copyBuild = useBuildsStore((state) => state.copyBuild);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-base font-semibold text-muted-foreground">
          {t.ui("archive.artifactBuilds")}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-7"
          onClick={() => newBuild(character.id)}
        >
          <Plus className="h-3 w-3" />
          {t.ui("common.addBuild")}
        </Button>
      </div>
      {builds.length > 0 ? (
        <div className="grid gap-2 grid-cols-1 2xl:grid-cols-2">
          {builds.map((build) => (
            <BuildCard
              key={build.id}
              build={build}
              buildId={build.id}
              onDelete={() => removeBuild(character.id, build.id)}
              onDuplicate={() => copyBuild(character.id, build.id)}
              element={
                getCharacterDisplayMeta(
                  character,
                  characterStats?.[character.id]
                ).element ?? "Pyro"
              }
            />
          ))}
        </div>
      ) : (
        <div className="h-6" />
      )}
    </div>
  );
}

function LinkedAccountSection({ character }: { character: CharacterResource }) {
  const { t } = useLanguage();
  const accountData = useAccountStore((state) => {
    const activeId = state.activeAccountId;
    return activeId ? state.accounts[activeId]?.data : undefined;
  });
  const scores = useAccountStore((state) => {
    const activeId = state.activeAccountId;
    return activeId ? state.accounts[activeId]?.scores : {};
  });

  const charData = accountData?.characters.find((c) => c.key === character.id);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-base font-semibold text-muted-foreground">
          {t.ui("archive.accountData")}
        </h3>
        {!charData && (
          <Link to="/account-data">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
              {t.ui("archive.goToAccountData")}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </div>
      {charData ? (
        <CharacterCard char={charData} score={scores[character.id]} />
      ) : (
        <div className="h-6" />
      )}
    </div>
  );
}

export function CharacterDetailPanel({
  characterId,
  characterStats,
}: {
  characterId: string;
  characterStats: ReturnType<typeof useGameStats>["characterStats"];
}) {
  const { t } = useLanguage();
  const character = charactersById[characterId];
  const meta = character
    ? getCharacterDisplayMeta(character, characterStats?.[characterId])
    : null;
  const skills = t.skills(characterId);
  const passives = t.passives(characterId);
  const constellations = t.constellations(characterId);
  const rawGlossary = t.glossary(characterId);

  const glossary = useMemo(() => {
    if (!rawGlossary) return null;
    const grouped = new Map<string, (typeof rawGlossary)[0]>();
    for (const entry of rawGlossary) {
      if (grouped.has(entry.descHtml)) {
        const existing = grouped.get(entry.descHtml)!;
        existing.name = `${existing.name}, ${entry.name}`;
      } else {
        grouped.set(entry.descHtml, { ...entry });
      }
    }
    return Array.from(grouped.values());
  }, [rawGlossary]);

  const unreleased = meta?.releaseDate == null;
  const isOwned = useIsOwned();
  const owned = isOwned("character", characterId);
  const effectiveOwned = !unreleased && owned;
  const constellation = useConstellation(characterId);
  const { toggleOwned } = useOwnershipActions();

  const [unlockClicks, setUnlockClicks] = useState(0);

  if (!character) return null;

  return (
    <>
      <Card className="bg-gradient-card">
        <CardContent className="py-4 md:py-6 px-3 md:px-6 space-y-4 md:space-y-6">
          {/* Character header + stats side-by-side on wide screens */}
          <div className="flex flex-col min-[1920px]:flex-row min-[1920px]:items-start min-[1920px]:justify-between gap-4">
            <div className="flex items-center gap-4">
              <ItemIcon
                imagePath={character.imagePath}
                rarity={meta?.rarity ?? character.rarity}
                size="xl"
              />
              <CharacterInfo character={character} showDate>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleOwned("character", characterId)}
                    disabled={unreleased}
                    className={cn(
                      "gap-1.5 shrink-0 rounded-full h-8 px-3 transition-colors",
                      effectiveOwned
                        ? "text-amber-400 hover:text-amber-300"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Bookmark
                      className={cn(
                        "h-4 w-4",
                        effectiveOwned && "fill-current"
                      )}
                    />
                    <span className="text-xs font-medium">
                      {effectiveOwned
                        ? t.ui("archive.owned")
                        : t.ui("archive.notOwned")}
                    </span>
                  </Button>
                  {effectiveOwned && constellation > 0 && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {t.format("common.constellationFormat", constellation)}
                    </span>
                  )}
                </div>
              </CharacterInfo>
            </div>
            {/* Base Stats — top-right on wide screens */}
            {(!unreleased || unlockClicks >= 7) && (
              <BaseStatsTable characterId={characterId} />
            )}
          </div>

          {!unreleased || unlockClicks >= 7 ? (
            <>
              {/* Skills */}
              {skills && skills.length > 0 && (
                <KitSection title={t.ui("archive.skills")}>
                  {skills.map((skill, i) => (
                    <SkillCard
                      key={skill.name || i}
                      skill={skill}
                      characterId={characterId}
                      skillIndex={i}
                    />
                  ))}
                </KitSection>
              )}

              {/* Passives — 2 columns on wide screens */}
              {passives && passives.length > 0 && (
                <KitSection title={t.ui("archive.passives")} columns>
                  {passives.map((passive, i) => (
                    <EffectCard key={passive.name || i} effect={passive} />
                  ))}
                </KitSection>
              )}

              {/* Glossary */}
              {glossary && glossary.length > 0 && (
                <KitSection title={t.ui("archive.glossary")} columns>
                  {glossary.map((entry, i) => (
                    <EffectCard key={entry.name || i} effect={entry} />
                  ))}
                </KitSection>
              )}

              {/* Constellations — 2 columns on wide screens */}
              {constellations && constellations.length > 0 && (
                <KitSection title={t.ui("archive.constellations")} columns>
                  {constellations.map((constellation, i) => (
                    <EffectCard
                      key={constellation.name || i}
                      effect={constellation}
                    />
                  ))}
                </KitSection>
              )}
            </>
          ) : (
            <div
              onClick={() => setUnlockClicks((c) => c + 1)}
              className="flex flex-col items-center justify-center py-12 text-muted-foreground select-none cursor-default"
            >
              <Info className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {t.ui("archive.notReleased")}
              </p>
            </div>
          )}

          {/* Linked: Artifact Builds */}
          <SectionErrorBoundary>
            <LinkedBuildSection
              character={character}
              characterStats={characterStats}
            />
          </SectionErrorBoundary>

          {/* Linked: Account Data */}
          <SectionErrorBoundary>
            <LinkedAccountSection character={character} />
          </SectionErrorBoundary>
        </CardContent>
      </Card>
    </>
  );
}
