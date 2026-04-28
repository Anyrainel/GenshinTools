import { Book } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { CharacterDetailPanel } from "@/components/archive/CharacterDetailPanel";
import { BuildsDefaultPresetPrompt } from "@/components/artifact-builds/BuildsDefaultPresetPrompt";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Element, Rarity, WeaponType } from "@/data/enums";
import { elements, weaponTypes } from "@/data/enums";
import {
  allCharacters,
  elementResourcesByName,
  weaponResourcesByName,
} from "@/data/gameResources";
import {
  type CharacterStatsMap,
  characterStatsResource,
  getCharacterDisplayMeta,
} from "@/data/gameStatsLoader";
import type { CharacterResource } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useIsOwned } from "@/hooks/useOwnership";
import { characterMatchesSearch } from "@/lib/search";
import { cn, getAssetUrl } from "@/lib/utils";
import { useArchiveSessionStore } from "@/stores/useArchiveSessionStore";

interface CharacterListItemProps {
  character: CharacterResource;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const CharacterListItem = memo(
  ({
    character,
    characterStats,
    isSelected,
    onSelect,
  }: CharacterListItemProps & {
    characterStats: CharacterStatsMap | null;
  }) => {
    const { t } = useLanguage();
    const meta = getCharacterDisplayMeta(
      character,
      characterStats?.[character.id]
    );
    const name = t.character(character.id);
    const isOwned = useIsOwned();
    const owned = isOwned("character", character.id);
    const unreleased = meta.releaseDate == null;

    return (
      <button
        type="button"
        onClick={() => onSelect(character.id)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left",
          isSelected
            ? "bg-primary/15 ring-1 ring-primary/30"
            : "hover:bg-accent/50",
          (unreleased || !owned) && "opacity-40"
        )}
      >
        <ItemIcon
          characterId={character.id}
          rarity={meta.rarity}
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

function CharacterListPanel({
  characters,
  characterStats,
  selectedId,
  onSelect,
}: {
  characters: CharacterResource[];
  characterStats: CharacterStatsMap | null;
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
            characterStats={characterStats}
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
  characterStats,
  onSelect,
}: {
  characters: CharacterResource[];
  characterStats: CharacterStatsMap | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useLanguage();
  const isOwnedFn = useIsOwned();

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
      {characters.map((c) => {
        const meta = getCharacterDisplayMeta(c, characterStats?.[c.id]);
        const unreleased = meta.releaseDate == null;
        const owned = isOwnedFn("character", c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-white/10 transition-colors",
              (unreleased || !owned) && "opacity-40"
            )}
          >
            <ItemIcon characterId={c.id} rarity={meta.rarity} size="sm" />
            <span className="text-xs text-foreground text-center line-clamp-1 w-full">
              {t.character(c.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CharacterFilterChips({
  elementFilter,
  onElementFilterChange,
  weaponTypeFilter,
  onWeaponTypeFilterChange,
  rarityFilter,
  onRarityFilterChange,
}: {
  elementFilter: Set<Element>;
  onElementFilterChange: (nextValues: Set<Element>) => void;
  weaponTypeFilter: Set<WeaponType>;
  onWeaponTypeFilterChange: (nextValues: Set<WeaponType>) => void;
  rarityFilter: Set<Rarity>;
  onRarityFilterChange: (nextValues: Set<Rarity>) => void;
}) {
  const { t } = useLanguage();

  return (
    <>
      <FilterChipGroup
        options={elements}
        selectedValues={elementFilter}
        onSelectedValuesChange={onElementFilterChange}
        getKey={(element) => element}
        getIcon={(element) => {
          const res = elementResourcesByName[element];
          return (
            <img
              src={getAssetUrl(res.imagePath)}
              alt={element}
              className="w-4 h-4"
            />
          );
        }}
        getLabel={(element) => (
          <span className="hidden sm:inline">{t.element(element)}</span>
        )}
        className="contents"
      />

      <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

      <FilterChipGroup
        options={[5, 4] as Rarity[]}
        selectedValues={rarityFilter}
        onSelectedValuesChange={onRarityFilterChange}
        getKey={(rarity) => String(rarity)}
        getLabel={(rarity, active) => (
          <span
            className={cn(
              active
                ? rarity === 5
                  ? "text-amber-400"
                  : "text-purple-400"
                : ""
            )}
          >
            ★{rarity}
          </span>
        )}
        className="contents"
      />

      <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

      <FilterChipGroup
        options={weaponTypes}
        selectedValues={weaponTypeFilter}
        onSelectedValuesChange={onWeaponTypeFilterChange}
        getKey={(weaponType) => weaponType}
        getIcon={(weaponType) => {
          const res = weaponResourcesByName[weaponType];
          return (
            <img
              src={getAssetUrl(res.imagePath)}
              alt={weaponType}
              className="w-4 h-4 brightness-125"
            />
          );
        }}
        getLabel={(weaponType) => (
          <span className="hidden sm:inline">{t.weaponType(weaponType)}</span>
        )}
        className="contents"
      />
    </>
  );
}

export function CharacterArchiveView() {
  const { t } = useLanguage();
  const characterStats = characterStatsResource.use();
  const sortedCharacters = useMemo(() => {
    const list = [...allCharacters];
    if (!characterStats) return list;
    return list.sort((a, b) => {
      // Traveler at the end, manekin/manekina after traveler
      const rankA = a.id.startsWith("manekin")
        ? 2
        : a.id.startsWith("traveler")
          ? 1
          : 0;
      const rankB = b.id.startsWith("manekin")
        ? 2
        : b.id.startsWith("traveler")
          ? 1
          : 0;
      if (rankA !== rankB) return rankA - rankB;
      // Release date descending, no release date first
      const dateA = characterStats[a.id]?.releaseDate ?? "";
      const dateB = characterStats[b.id]?.releaseDate ?? "";
      if (!dateA && !dateB) return 0;
      if (!dateA) return -1;
      if (!dateB) return 1;
      return dateB.localeCompare(dateA);
    });
  }, [characterStats]);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const searchQuery = useArchiveSessionStore((s) => s.characterSearch);
  const setSearchQuery = useArchiveSessionStore((s) => s.setCharacterSearch);
  const selectedId = useArchiveSessionStore((s) => s.selectedCharacterId);
  const setSelectedId = useArchiveSessionStore((s) => s.setSelectedCharacterId);
  const [searchParams, setSearchParams] = useSearchParams();
  const characterParam = searchParams.get("character");
  const hasCharacterParam = searchParams.has("character");
  const characterParamIsValid =
    characterParam != null &&
    allCharacters.some((c) => c.id === characterParam);
  const [elementFilter, setElementFilter] = useState<Set<Element>>(
    () => new Set()
  );
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(
    () => new Set()
  );
  const [rarityFilter, setRarityFilter] = useState<Set<Rarity>>(
    () => new Set()
  );

  // Filter characters (use stats-based meta)
  const filteredCharacters = useMemo(() => {
    const hasSearch = searchQuery.trim().length > 0;
    return sortedCharacters.filter((c) => {
      const meta = getCharacterDisplayMeta(c, characterStats?.[c.id]);
      if (
        elementFilter.size > 0 &&
        (meta.element == null || !elementFilter.has(meta.element))
      )
        return false;
      if (
        weaponTypeFilter.size > 0 &&
        (meta.weaponType == null || !weaponTypeFilter.has(meta.weaponType))
      )
        return false;
      if (rarityFilter.size > 0 && !rarityFilter.has(meta.rarity)) return false;
      if (hasSearch) {
        const name = t.character(c.id);
        const skills = t.skills(c.id);
        const passives = t.passives(c.id);
        const constellations = t.constellations(c.id);
        const glossary = t.glossary(c.id);
        if (
          !characterMatchesSearch(
            c.id,
            searchQuery.trim(),
            name,
            skills,
            passives,
            constellations,
            glossary
          )
        )
          return false;
      }
      return true;
    });
  }, [
    sortedCharacters,
    characterStats,
    searchQuery,
    elementFilter,
    weaponTypeFilter,
    rarityFilter,
    t,
  ]);

  const setCharacterSearchParam = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("character", id);
          else next.delete("character");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (!hasCharacterParam) return;

    if (!characterParamIsValid) {
      setCharacterSearchParam(null);
      return;
    }

    if (selectedId !== characterParam) {
      setSelectedId(characterParam);
    }
  }, [
    characterParam,
    characterParamIsValid,
    hasCharacterParam,
    selectedId,
    setCharacterSearchParam,
    setSelectedId,
  ]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      setCharacterSearchParam(id);
    },
    [setCharacterSearchParam, setSelectedId]
  );

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setCharacterSearchParam(null);
  }, [setCharacterSearchParam, setSelectedId]);

  // On desktop, if the session has no selection yet, seed with the first
  // released character. Only runs once per mount so that clearing the
  // selection (e.g. via mobile "Back") doesn't immediately re-seed.
  const didSeedRef = useMemo(() => ({ current: false }), []);
  useEffect(() => {
    if (hasCharacterParam) return;
    if (didSeedRef.current) return;
    if (!isDesktop || !characterStats || filteredCharacters.length === 0) {
      return;
    }
    didSeedRef.current = true;
    if (selectedId) return;
    const firstReleased = filteredCharacters.find(
      (c) => characterStats[c.id]?.releaseDate
    );
    setSelectedId((firstReleased ?? filteredCharacters[0]).id);
  }, [
    isDesktop,
    selectedId,
    filteredCharacters,
    characterStats,
    hasCharacterParam,
    setSelectedId,
    didSeedRef,
  ]);

  const toolbar = (
    <ArchiveToolbar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={t.ui("archive.searchPlaceholder")}
    >
      <CharacterFilterChips
        elementFilter={elementFilter}
        onElementFilterChange={setElementFilter}
        weaponTypeFilter={weaponTypeFilter}
        onWeaponTypeFilterChange={setWeaponTypeFilter}
        rarityFilter={rarityFilter}
        onRarityFilterChange={setRarityFilter}
      />
    </ArchiveToolbar>
  );

  const detailPanel = selectedId ? (
    <CharacterDetailPanel
      key={selectedId}
      characterId={selectedId}
      characterStats={characterStats}
    />
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
      <Book className="h-12 w-12 mb-4 opacity-30" />
      <p>{t.ui("archive.noCharacterSelected")}</p>
    </div>
  );

  return (
    <SidebarDetailLayout
      header={toolbar}
      hasSelection={!!selectedId}
      onBack={handleBack}
      backLabel={t.ui("archive.characterLabel")}
      banner={<BuildsDefaultPresetPrompt />}
      sidebar={
        <CharacterListPanel
          characters={filteredCharacters}
          characterStats={characterStats}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      }
      mobileGrid={
        <CharacterGrid
          characters={filteredCharacters}
          characterStats={characterStats}
          onSelect={handleSelect}
        />
      }
    >
      {detailPanel}
    </SidebarDetailLayout>
  );
}
