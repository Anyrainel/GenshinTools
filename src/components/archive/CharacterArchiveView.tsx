import { BuildsDefaultPresetPrompt } from "@/components/artifact-builds/BuildsDefaultPresetPrompt";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  elementResourcesByName,
  getSortedCharacters,
  weaponResourcesByName,
} from "@/data/constants";
import type {
  CharacterResource,
  Element,
  Rarity,
  WeaponType,
} from "@/data/types";
import { elements, weaponTypes } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useIsOwned } from "@/hooks/useOwnership";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { characterMatchesSearch } from "@/lib/search";
import { cn, getAssetUrl } from "@/lib/utils";
import { Book } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArchiveToolbar } from "./ArchiveToolbar";
import { CharacterDetailPanel } from "./CharacterDetailPanel";
import { FilterChip } from "./FilterChip";

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
    characterStats: ReturnType<typeof useGameStats>["characterStats"];
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
          imagePath={character.imagePath}
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
  characterStats: ReturnType<typeof useGameStats>["characterStats"];
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
  characterStats: ReturnType<typeof useGameStats>["characterStats"];
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
            <ItemIcon imagePath={c.imagePath} rarity={meta.rarity} size="sm" />
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
  const { characterStats } = useGameStats();
  const sortedCharacters = useMemo(
    () => getSortedCharacters(characterStats ?? null),
    [characterStats]
  );
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("character");
  const [searchQuery, setSearchQuery] = useState("");
  const [elementFilter, setElementFilter] = useState<Element[]>([]);
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<WeaponType[]>([]);
  const [rarityFilter, setRarityFilter] = useState<Rarity[]>([]);

  // Filter characters (use stats-based meta)
  const filteredCharacters = useMemo(() => {
    const hasSearch = searchQuery.trim().length > 0;
    return sortedCharacters.filter((c) => {
      // Hide manekin characters unless actively searching
      if (!hasSearch && c.id.startsWith("manekin")) return false;
      const meta = getCharacterDisplayMeta(c, characterStats?.[c.id]);
      if (
        elementFilter.length > 0 &&
        (meta.element == null || !elementFilter.includes(meta.element))
      )
        return false;
      if (
        weaponTypeFilter.length > 0 &&
        (meta.weaponType == null || !weaponTypeFilter.includes(meta.weaponType))
      )
        return false;
      if (rarityFilter.length > 0 && !rarityFilter.includes(meta.rarity))
        return false;
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

  const handleSelect = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("character", id);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleBack = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("character");
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  // Auto-select first character on desktop if none selected
  useEffect(() => {
    if (isDesktop && !selectedId && filteredCharacters.length > 0) {
      handleSelect(filteredCharacters[0].id);
    }
  }, [isDesktop, selectedId, filteredCharacters, handleSelect]);

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
