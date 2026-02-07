import { CharacterCard } from "@/components/account-data/CharacterCard";
import { BuildCard } from "@/components/artifact-builds/BuildCard";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  charactersById,
  elementResourcesByName,
  sortedCharacters,
  weaponResourcesByName,
} from "@/data/constants";
import type { Character, Element, Rarity, WeaponType } from "@/data/types";
import { elements, weaponTypes } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { characterMatchesSearch } from "@/lib/search";
import { cn, getAssetUrl } from "@/lib/utils";
import { useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { ArrowLeft, Book, ChevronRight, Plus } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArchiveToolbar } from "./ArchiveToolbar";
import { BaseStatsTable } from "./BaseStatsTable";
import { EffectCard } from "./EffectCard";
import { FilterChip } from "./FilterChip";
import { SkillCard } from "./SkillCard";

interface CharacterListItemProps {
  character: Character;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const CharacterListItem = memo(
  ({ character, isSelected, onSelect }: CharacterListItemProps) => {
    const { t } = useLanguage();
    const name = t.character(character.id);

    return (
      <button
        type="button"
        onClick={() => onSelect(character.id)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left",
          isSelected
            ? "bg-primary/15 ring-1 ring-primary/30"
            : "hover:bg-accent/50"
        )}
      >
        <ItemIcon
          imagePath={character.imagePath}
          rarity={character.rarity}
          size="sm"
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{name}</div>
        </div>
      </button>
    );
  }
);
CharacterListItem.displayName = "CharacterListItem";

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

const EMPTY_BUILD_IDS: string[] = [];

function LinkedBuildSection({ character }: { character: Character }) {
  const { t } = useLanguage();
  const buildIdsFromStore = useBuildsStore(
    (state) => state.characterToBuildIds[character.id]
  );
  const buildIds = buildIdsFromStore ?? EMPTY_BUILD_IDS;
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
          {t.ui("archive.addBuild")}
        </Button>
      </div>
      {buildIds.length > 0 ? (
        <div className="grid gap-2 grid-cols-1 2xl:grid-cols-2">
          {buildIds.map((buildId, index) => (
            <BuildCard
              key={buildId}
              buildId={buildId}
              buildIndex={index + 1}
              onDelete={() => removeBuild(character.id, buildId)}
              onDuplicate={() => copyBuild(character.id, buildId)}
              element={character.element}
            />
          ))}
        </div>
      ) : (
        <div className="h-6" />
      )}
    </div>
  );
}

function LinkedAccountSection({ character }: { character: Character }) {
  const { t } = useLanguage();
  const accountData = useAccountStore((state) => state.accountData);
  const scores = useAccountStore((state) => state.scores);

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

function CharacterDetailPanel({ characterId }: { characterId: string }) {
  const { t } = useLanguage();
  const character = charactersById[characterId];
  const skills = t.skills(characterId);
  const passives = t.passives(characterId);
  const constellations = t.constellations(characterId);
  const dictionary = t.dictionary(characterId);

  if (!character) return null;

  return (
    <Card className="bg-gradient-card">
      <CardContent className="py-6 space-y-6">
        {/* Character header + stats side-by-side on wide screens */}
        <div className="flex flex-col min-[1920px]:flex-row min-[1920px]:items-start min-[1920px]:justify-between gap-4">
          <div className="flex items-center gap-4">
            <ItemIcon
              imagePath={character.imagePath}
              rarity={character.rarity}
              size="xl"
            />
            <CharacterInfo character={character} showDate />
          </div>
          {/* Base Stats — top-right on wide screens */}
          <BaseStatsTable characterId={characterId} />
        </div>

        {/* Skills */}
        {skills && skills.length > 0 && (
          <KitSection title={t.ui("archive.skills")}>
            {skills.map((skill, i) => (
              <SkillCard
                key={skill.name || i}
                skill={skill}
                constellations={constellations}
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

        {/* Dictionary */}
        {dictionary && dictionary.length > 0 && (
          <KitSection title={t.ui("archive.dictionary")} columns>
            {dictionary.map((entry, i) => (
              <EffectCard key={entry.name || i} effect={entry} />
            ))}
          </KitSection>
        )}

        {/* Linked: Artifact Builds */}
        <LinkedBuildSection character={character} />

        {/* Linked: Account Data */}
        <LinkedAccountSection character={character} />
      </CardContent>
    </Card>
  );
}

function CharacterListPanel({
  characters,
  selectedId,
  onSelect,
}: {
  characters: Character[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-0.5">
      <Label className="text-xs text-muted-foreground px-2">
        {characters.length} {t.ui("archive.characterLabel")}
      </Label>
      {characters.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-8">
          {t.ui("archive.noResults")}
        </div>
      ) : (
        characters.map((c) => (
          <CharacterListItem
            key={c.id}
            character={c}
            isSelected={selectedId === c.id}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

function CharacterGrid({
  characters,
  onSelect,
}: {
  characters: Character[];
  onSelect: (id: string) => void;
}) {
  const { t } = useLanguage();

  if (characters.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">
        {t.ui("archive.noResults")}
      </div>
    );
  }

  return (
    <div
      className="grid gap-2 p-2"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))" }}
    >
      {characters.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ItemIcon imagePath={c.imagePath} rarity={c.rarity} size="sm" />
          <span className="text-xs text-foreground text-center line-clamp-1 w-full">
            {t.character(c.id)}
          </span>
        </button>
      ))}
    </div>
  );
}

function CharacterFilterChips({
  elementFilter,
  onToggleElement,
  weaponTypeFilter,
  onToggleWeaponType,
  rarityFilter,
  onToggleRarity,
}: {
  elementFilter: Element[];
  onToggleElement: (el: Element) => void;
  weaponTypeFilter: WeaponType[];
  onToggleWeaponType: (wt: WeaponType) => void;
  rarityFilter: Rarity[];
  onToggleRarity: (r: Rarity) => void;
}) {
  const { t } = useLanguage();

  return (
    <>
      {/* Elements */}
      {elements.map((el) => {
        const active = elementFilter.length === 0 || elementFilter.includes(el);
        const res = elementResourcesByName[el];
        return (
          <FilterChip
            key={el}
            active={active}
            onClick={() => onToggleElement(el)}
          >
            <img
              src={getAssetUrl(res.imagePath)}
              alt={el}
              className="w-4 h-4"
            />
            <span className="hidden sm:inline">{t.element(el)}</span>
          </FilterChip>
        );
      })}

      <div className="h-5 w-px bg-border/50 mx-1 hidden sm:block" />

      {/* Weapon Types */}
      {weaponTypes.map((wt) => {
        const active =
          weaponTypeFilter.length === 0 || weaponTypeFilter.includes(wt);
        const res = weaponResourcesByName[wt];
        return (
          <FilterChip
            key={wt}
            active={active}
            onClick={() => onToggleWeaponType(wt)}
          >
            <img
              src={getAssetUrl(res.imagePath)}
              alt={wt}
              className="w-4 h-4 brightness-125"
            />
            <span className="hidden sm:inline">{t.weaponType(wt)}</span>
          </FilterChip>
        );
      })}

      <div className="h-5 w-px bg-border/50 mx-1 hidden sm:block" />

      {/* Rarity */}
      {([5, 4] as Rarity[]).map((r) => {
        const active = rarityFilter.length === 0 || rarityFilter.includes(r);
        return (
          <FilterChip key={r} active={active} onClick={() => onToggleRarity(r)}>
            <span
              className={cn(
                active ? (r === 5 ? "text-amber-400" : "text-purple-400") : ""
              )}
            >
              ★{r}
            </span>
          </FilterChip>
        );
      })}
    </>
  );
}

export function CharacterArchiveView() {
  const { t } = useLanguage();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [elementFilter, setElementFilter] = useState<Element[]>([]);
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<WeaponType[]>([]);
  const [rarityFilter, setRarityFilter] = useState<Rarity[]>([]);

  // Filter characters
  const filteredCharacters = useMemo(() => {
    return sortedCharacters.filter((c) => {
      if (c.id.startsWith("traveler")) return false;
      if (elementFilter.length > 0 && !elementFilter.includes(c.element))
        return false;
      if (
        weaponTypeFilter.length > 0 &&
        !weaponTypeFilter.includes(c.weaponType)
      )
        return false;
      if (rarityFilter.length > 0 && !rarityFilter.includes(c.rarity))
        return false;
      if (searchQuery.trim()) {
        const name = t.character(c.id);
        const skills = t.skills(c.id);
        const passives = t.passives(c.id);
        const constellations = t.constellations(c.id);
        const dictionary = t.dictionary(c.id);
        if (
          !characterMatchesSearch(
            c.id,
            searchQuery.trim(),
            name,
            skills,
            passives,
            constellations,
            dictionary
          )
        )
          return false;
      }
      return true;
    });
  }, [searchQuery, elementFilter, weaponTypeFilter, rarityFilter, t]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
  }, []);

  // Auto-select first character on desktop if none selected
  useEffect(() => {
    if (isDesktop && !selectedId && filteredCharacters.length > 0) {
      setSelectedId(filteredCharacters[0].id);
    }
  }, [isDesktop, selectedId, filteredCharacters]);

  const toggleElement = (el: Element) => {
    setElementFilter((prev) =>
      prev.includes(el) ? prev.filter((e) => e !== el) : [...prev, el]
    );
  };

  const toggleWeaponType = (wt: WeaponType) => {
    setWeaponTypeFilter((prev) =>
      prev.includes(wt) ? prev.filter((w) => w !== wt) : [...prev, wt]
    );
  };

  const toggleRarity = (r: Rarity) => {
    setRarityFilter((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const toolbar = (
    <ArchiveToolbar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={t.ui("archive.searchPlaceholder")}
    >
      <CharacterFilterChips
        elementFilter={elementFilter}
        onToggleElement={toggleElement}
        weaponTypeFilter={weaponTypeFilter}
        onToggleWeaponType={toggleWeaponType}
        rarityFilter={rarityFilter}
        onToggleRarity={toggleRarity}
      />
    </ArchiveToolbar>
  );

  const detailPanel = selectedId ? (
    <CharacterDetailPanel characterId={selectedId} />
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
      <Book className="h-12 w-12 mb-4 opacity-30" />
      <p>{t.ui("archive.noCharacterSelected")}</p>
    </div>
  );

  // ── Mobile: grid-to-detail ──────────────────────────────────────────────
  if (!isDesktop) {
    // Show detail view with back button when a character is selected
    if (selectedId) {
      return (
        <div className="flex flex-col h-full overflow-hidden px-2">
          <div className="shrink-0 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.ui("archive.characterLabel")}
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pb-4">
            {detailPanel}
          </div>
        </div>
      );
    }

    // Show grid view
    return (
      <div className="flex flex-col h-full overflow-y-auto px-2">
        <div className="shrink-0 pt-3 pb-4">{toolbar}</div>
        <CharacterGrid
          characters={filteredCharacters}
          onSelect={handleSelect}
        />
      </div>
    );
  }

  // ── Desktop: sidebar + detail ───────────────────────────────────────────
  return (
    <div
      className={cn(
        "h-full overflow-hidden flex flex-col",
        "w-full max-w-full lg:max-w-[90%] xl:max-w-[80%] 2xl:max-w-[70%] mx-auto",
        "px-2 md:px-4 lg:px-6"
      )}
    >
      <div className="shrink-0 pt-3 pb-4">{toolbar}</div>
      <div className="flex-1 min-h-0 flex flex-row gap-3 pb-3">
        <aside className="w-1/3 max-w-xs shrink-0 overflow-y-auto rounded-lg bg-card/50 border border-border/50 p-2">
          <CharacterListPanel
            characters={filteredCharacters}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </aside>
        <main className="flex-1 min-w-0 overflow-y-auto">{detailPanel}</main>
      </div>
    </div>
  );
}
