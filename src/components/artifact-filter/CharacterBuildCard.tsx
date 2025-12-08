import { memo, useCallback, useMemo } from 'react';
import { Character } from '@/data/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBuildsStore } from '@/stores/useBuildsStore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TitleCard } from './TitleCard';
import { BuildCard } from './BuildCard';

interface CharacterBuildCardProps {
  character: Character;
}

// Empty array constant to avoid creating new arrays on each render
const EMPTY_BUILD_IDS: string[] = [];

function CharacterBuildCardComponent({ character }: CharacterBuildCardProps) {
  const { t } = useLanguage();
  const isHidden = useBuildsStore((state) => !!state.hiddenCharacters[character.id]);

  // Use useMemo with shallow comparison for array to prevent re-renders on reference changes
  const buildIdsFromStore = useBuildsStore((state) => state.characterToBuildIds[character.id]);
  const buildIds = useMemo(() => buildIdsFromStore ?? EMPTY_BUILD_IDS, [buildIdsFromStore]);

  const newBuild = useBuildsStore((state) => state.newBuild);
  const copyBuild = useBuildsStore((state) => state.copyBuild);
  const removeBuild = useBuildsStore((state) => state.removeBuild);

  const handleAddBuild = useCallback(() => {
    newBuild(character.id);
  }, [newBuild, character.id]);

  const handleDeleteBuild = useCallback((buildId: string) => {
    removeBuild(character.id, buildId);
  }, [removeBuild, character.id]);

  const handleDuplicateBuild = useCallback((buildId: string) => {
    copyBuild(character.id, buildId);
  }, [copyBuild, character.id]);

  return (
    <Card className="bg-gradient-artifact">
      <CardHeader className="pb-3 pt-5">
        <TitleCard character={character} />
      </CardHeader>

      <CardContent className="pb-3">
        {isHidden ? (
          <div className="text-center pb-2 text-muted-foreground text-xs italic select-none">
            {t.ui('characterCard.hiddenNotice')}
          </div>
        ) : (
            <div className="space-y-2">
              {buildIds.length === 0 ? (
                <div className="text-center py-2 text-muted-foreground">
                  <Button onClick={handleAddBuild} variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" />
                    {t.ui('characterCard.addFirstBuild')}
                  </Button>
                </div>
              ) : (
                <>
                  {buildIds.map((buildId, index) => {
                    // Memoize inline callbacks to prevent BuildCard re-renders
                    const handleDelete = () => handleDeleteBuild(buildId);
                    const handleDuplicate = () => handleDuplicateBuild(buildId);

                    return (
                      <BuildCard
                        key={buildId}
                        buildId={buildId}
                        buildIndex={index + 1}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        element={character.element}
                      />
                    );
                  })}

                  <Button onClick={handleAddBuild} variant="outline" size="sm" className="w-full gap-2">
                    <Plus className="w-4 h-4" />
                    {t.ui('characterCard.addBuild')}
                  </Button>
                </>
              )}
            </div>
        )}
      </CardContent>
    </Card>
  );
}

export const CharacterBuildCard = memo(CharacterBuildCardComponent, (prev, next) => {
  // Only re-render if character ID changes (character object should be stable from resources array)
  return prev.character.id === next.character.id;
});
