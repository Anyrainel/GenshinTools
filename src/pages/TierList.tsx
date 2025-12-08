import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Settings } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ToolHeader } from '@/components/shared/ToolHeader';
import { ImportControl } from '@/components/shared/ImportControl';
import { ExportControl } from '@/components/shared/ExportControl';
import { ClearAllControl } from '@/components/shared/ClearAllControl'; // Updated import
import { PresetOption, TierListData, TierAssignment, TierCustomization } from '@/data/types'; // Import necessary types
import { useTierStore } from '@/stores/useTierStore';
import TierTable from '@/components/tier-list/TierTable'; // Renamed component
import TierCustomizationDialog from '@/components/tier-list/TierCustomizationDialog';
import { charactersById } from '@/data/resources';
import { toast } from 'sonner';

// Helper to build name to ID map (from old TierList.tsx)
import { i18nGameData } from '@/data/i18n-game';
const nameToIdMap: Record<string, string> = {};
Object.entries(i18nGameData.characters).forEach(([id, names]) => {
  const nameRecord = names as Record<string, string>;
  if (nameRecord.en) nameToIdMap[nameRecord.en] = id;
});

// For TierList Presets - if they exist, otherwise we'll need to create a system
// Assuming presets will be in a similar structure to artifact presets for now.
// However, the original request didn't mention tier list presets, so for now
// I'll make this placeholder.
const presetModules = import.meta.glob<{ default: TierListData }>('@/presets/tier-list/*.json', { eager: false }); // Placeholder for tierlist specific presets

// Helper to generate ID from name (mirrors scrape_hoyolab.py logic)
const generateId = (name: string): string => {
  return name.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');
};

const TierListPage = () => {
  const { t, language, setLanguage } = useLanguage();

  const tierAssignments = useTierStore((state) => state.tierAssignments);
  const tierCustomization = useTierStore((state) => state.tierCustomization);
  const customTitle = useTierStore((state) => state.customTitle);
  const setTierAssignments = useTierStore((state) => state.setTierAssignments);
  const setTierCustomization = useTierStore((state) => state.setTierCustomization);
  const setCustomTitle = useTierStore((state) => state.setCustomTitle);
  const resetStoredTierList = useTierStore((state) => state.resetTierList);
  const loadTierListData = useTierStore((state) => state.loadTierListData);
  const showWeapons = useTierStore((state) => state.showWeapons);
  const setShowWeapons = useTierStore((state) => state.setShowWeapons);
  const showTravelers = useTierStore((state) => state.showTravelers);
  const setShowTravelers = useTierStore((state) => state.setShowTravelers);
  const author = useTierStore((state) => state.author);
  const description = useTierStore((state) => state.description);


  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);

  // Show toast when tier assignments change (auto-save) - This logic was in TierList.tsx, moving here.
  // Track previous assignments to detect changes
  const prevAssignmentsRef = useRef<TierAssignment>(tierAssignments);
  // Track if we should show auto-save toast (skip on initial load and manual load)
  const shouldShowAutoSaveRef = useRef(false);

  useEffect(() => {
    // Skip on initial mount
    if (!shouldShowAutoSaveRef.current) {
      shouldShowAutoSaveRef.current = true;
      prevAssignmentsRef.current = tierAssignments;
      return;
    }

    const prev = prevAssignmentsRef.current;
    const curr = tierAssignments;

    // Find what changed
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
    const changes: { characterId: string; fromTier?: string; toTier?: string }[] = [];

    allKeys.forEach(characterId => {
      const prevAssignment = prev[characterId];
      const currAssignment = curr[characterId];

      // Character was added or moved
      if (currAssignment && (!prevAssignment || prevAssignment.tier !== currAssignment.tier)) {
        changes.push({
          characterId,
          fromTier: prevAssignment?.tier,
          toTier: currAssignment.tier,
        });
      }
      // Character was removed
      else if (prevAssignment && !currAssignment) {
        changes.push({
          characterId,
          fromTier: prevAssignment.tier,
        });
      }
    });

    // Show toast for changes
    if (changes.length > 0) {
      const change = changes[0];
      const character = charactersById[change.characterId];
      if (!character) return;

      const localizedName = t.character(character.id);

      if (change.toTier) {
        const tierLabel = change.toTier === 'Pool' ? t.ui('tiers.Pool') : change.toTier;
        toast.success(t.format('messages.characterMoved', localizedName, tierLabel), {
          duration: 2000,
        });
      } else {
        toast.success(t.format('messages.characterRemoved', localizedName), {
          duration: 2000,
        });
      }
    }

    prevAssignmentsRef.current = tierAssignments;
  }, [tierAssignments, t, language]);

  // Load preset metadata on mount (adapted from ArtifactFilter)
  useEffect(() => {
    const loadPresetMetadata = async () => {
      const options = await Promise.all(
        Object.keys(presetModules).map(async (path) => {
          try {
            const loader = presetModules[path];
            const module = await loader();
            const payload = module?.default ?? (module as unknown as TierListData);

            // Use author and description if available, otherwise fallback to filename
            if (payload.author && payload.description) { // Need to add author/description to TierListData for this to work
              return {
                path,
                label: `[${payload.author}] ${payload.description}`,
                author: payload.author,
                description: payload.description
              };
            } else {
              const fileName = path.split('/').pop() || path;
              const label = fileName.replace(/\.json$/i, '').replace(/[-_]+/g, ' ');
              return { path, label: label.trim() || fileName };
            }
          } catch (error) {
            console.error(`Failed to load tierlist preset metadata for ${path}:`, error);
            const fileName = path.split('/').pop() || path;
            const label = fileName.replace(/\.json$/i, '').replace(/[-_]+/g, ' ');
            return { path, label: label.trim() || fileName };
          }
        })
      );

      setPresetOptions(options.sort((a, b) => a.label.localeCompare(b.label)));
    };

    loadPresetMetadata();
  }, []);

  const loadPresetPayload = useCallback(async (path: string) => {
    const loader = presetModules[path];
    if (!loader) {
      throw new Error(`TierList Preset not found for path: ${path}`);
    }

    const module = await loader();
    const payload = module?.default ?? (module as unknown as TierListData);

    // Backward compatibility for old format: character name to ID mapping
    const normalizedAssignments: TierAssignment = {};
    if (payload.tierAssignments) {
        Object.entries(payload.tierAssignments).forEach(([key, value]) => {
            if (charactersById[key]) {
                normalizedAssignments[key] = value as { tier: string; position: number };
            } else {
                // Try to generate ID from the key (assuming it's an English name)
                const generatedId = generateId(key);
                if (charactersById[generatedId]) {
                   normalizedAssignments[generatedId] = value as { tier: string; position: number };
                } else if (nameToIdMap[key]) {
                   // Fallback to direct name map if available
                   const id = nameToIdMap[key];
                   if (charactersById[id]) {
                      normalizedAssignments[id] = value as { tier: string; position: number };
                   }
                }
            }
        });
        payload.tierAssignments = normalizedAssignments;
    }

    return payload;
  }, []);

  const handleImport = (importedData: TierListData) => {
    shouldShowAutoSaveRef.current = false; // Disable auto-save toast for manual import
    
    // Normalize imported data assignments
    const normalizedAssignments: TierAssignment = {};
    if (importedData.tierAssignments) {
        Object.entries(importedData.tierAssignments).forEach(([key, value]) => {
            if (charactersById[key]) {
                normalizedAssignments[key] = value as { tier: string; position: number };
            } else {
                // Try to generate ID from the key (assuming it's an English name)
                const generatedId = generateId(key);
                if (charactersById[generatedId]) {
                   normalizedAssignments[generatedId] = value as { tier: string; position: number };
                } else if (nameToIdMap[key]) {
                   // Fallback to direct name map if available
                   const id = nameToIdMap[key];
                   if (charactersById[id]) {
                      normalizedAssignments[id] = value as { tier: string; position: number };
                   }
                }
            }
        });
        importedData.tierAssignments = normalizedAssignments;
    }

    loadTierListData({
      tierAssignments: importedData.tierAssignments,
      tierCustomization: importedData.tierCustomization,
      customTitle: importedData.customTitle || '',
    });
    if (importedData.language && importedData.language !== language) {
      setLanguage(importedData.language);
    }
    toast.success(t.ui('messages.tierListLoaded'));
  };

  const handleExport = (author: string, description: string) => {
    const data: TierListData = {
      tierAssignments,
      tierCustomization,
      customTitle: customTitle || undefined,
      language,
      author, // Add author to export data
      description // Add description to export data
    };
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `[${author}] ${description}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      // Save metadata to store
      useTierStore.getState().setMetadata(author, description);
      
      toast.success(t.ui('messages.tierListSaved'));
    } catch (error) {
      console.error('Error saving tier list:', error);
      toast.error(t.ui('messages.tierListSaveFailed'));
    }
  };

  const handleClear = () => {
    resetStoredTierList();
    toast.info(t.ui('messages.tierListReset'));
  };

  const handleTierCustomizationSave = (customization: TierCustomization, newCustomTitle?: string) => {
    const newAssignments = { ...tierAssignments };
    const hiddenTiers = Object.keys(customization).filter(tier => customization[tier]?.hidden);

    hiddenTiers.forEach(tier => {
      Object.keys(newAssignments).forEach(characterId => {
        if (newAssignments[characterId].tier === tier) {
          delete newAssignments[characterId];
        }
      });
    });

    setTierAssignments(newAssignments);
    setTierCustomization(customization);
    if (newCustomTitle !== undefined) {
      setCustomTitle(newCustomTitle);
    }
    toast.success(t.ui('messages.customizationsSaved'));
    setIsCustomizeDialogOpen(false);
  };

  const handleTierAssignment = (draggedCharacterId: string, dropTargetCharacterId: string | null, tier: string, direction: 'left' | 'right') => {
    setTierAssignments(prev => {
      const newAssignments = { ...prev };
      
      // 1. Get all characters currently in the target tier (excluding the dragged one)
      // We map to an array of { id, assignment } to make sorting and splicing easier
      const targetTierChars = Object.entries(prev)
        .filter(([id, assignment]) => assignment.tier === tier && id !== draggedCharacterId)
        .map(([id, assignment]) => ({ id, ...assignment }))
        .sort((a, b) => a.position - b.position);

      // 2. Determine insertion index
      let insertIndex = targetTierChars.length; // Default to end

      if (dropTargetCharacterId) {
        const targetIndex = targetTierChars.findIndex(c => c.id === dropTargetCharacterId);
        if (targetIndex !== -1) {
          if (direction === 'left') {
            insertIndex = targetIndex;
          } else {
            insertIndex = targetIndex + 1;
          }
        }
      } else {
          // If dropping on empty container or specifically requesting end
          if (direction === 'left') insertIndex = 0;
      }

      // 3. Insert dragged character
      targetTierChars.splice(insertIndex, 0, {
        id: draggedCharacterId,
        tier: tier,
        position: 0 // Placeholder, will be updated
      });

      // 4. Re-assign positions for the entire tier
      targetTierChars.forEach((char, index) => {
        newAssignments[char.id] = { tier, position: index };
      });
      
      // If the character was moved from a DIFFERENT tier, we technically should re-index the source tier
      // to prevent gaps, but gaps aren't fatal in this logic (sort handles them). 
      // However, removing the old assignment is implicit because we overwrite newAssignments[draggedCharacterId].
      // If it was in a different tier before, the overwrite handles the "move".
      
      return newAssignments;
    });
  };

  const handleRemoveFromTiers = (characterId: string) => {
    setTierAssignments(prev => {
      const newAssignments = { ...prev };
      const oldAssignment = prev[characterId];
      const character = charactersById[characterId];
      if (!character) return prev;

      if (oldAssignment) {
        const elementChars = Object.entries(prev)
          .filter(([id, assignment]: [string, { tier: string; position: number }]) => {
            const char = charactersById[id];
            return char?.element === character.element &&
              assignment.tier === oldAssignment.tier;
          })
          .map(([id, assignment]: [string, { tier: string; position: number }]) => ({
            id,
            position: assignment.position
          }))
          .sort((a, b) => a.position - b.position);

        delete newAssignments[character.id];

        // Re-position remaining characters in the tier
        let newPosition = 0;
        elementChars.forEach((card) => {
          if (card.id !== character.id) {
            newAssignments[card.id] = {
              tier: oldAssignment.tier,
              position: newPosition
            };
            newPosition++;
          }
        });
      }
      return newAssignments;
    });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-screen bg-gradient-mystical text-foreground flex flex-col overflow-hidden">
        <ToolHeader
          title={t.ui('app.tierListTitle')}
          actions={
            <>
              <ClearAllControl
                onConfirm={handleClear}
                dialogTitle={t.ui('resetConfirmDialog.title')}
                dialogDescription={t.ui('resetConfirmDialog.message')}
                confirmActionLabel={t.ui('resetConfirmDialog.confirm')}
              />

              <ImportControl<TierListData> // Specify type for ImportControl
                options={presetOptions}
                loadPreset={loadPresetPayload}
                onApply={handleImport}
                onLocalImport={handleImport} // Use handleImport for local file import as well
                dialogTitle={t.ui('tierList.importDialogTitle')}
                dialogDescription={t.ui('tierList.importDialogDescription')}
                confirmTitle={t.ui('tierList.presetConfirmTitle')}
                confirmDescription={t.ui('tierList.presetConfirmDescription')}
                confirmActionLabel={t.ui('tierList.presetConfirmAction')}
                loadErrorText={t.ui('tierList.loadError')}
                emptyListText={t.ui('tierList.noPresets')}
                importFromFileText={t.ui('tierList.importFromFile')}
              />

              <ExportControl
                onExport={handleExport}
                dialogTitle={t.ui('tierList.exportDialogTitle')}
                dialogDescription={t.ui('tierList.exportDialogDescription')}
                authorLabel={t.ui('tierList.exportAuthorLabel')}
                authorPlaceholder={t.ui('tierList.exportAuthorPlaceholder')}
                descriptionLabel={t.ui('tierList.exportDescriptionLabel')}
                descriptionPlaceholder={t.ui('tierList.exportDescriptionPlaceholder')}
                authorRequiredError={t.ui('tierList.exportAuthorRequired')}
                descriptionRequiredError={t.ui('tierList.exportDescriptionRequired')}
                confirmActionLabel={t.ui('tierList.exportConfirmAction')}
                defaultAuthor={author}
                defaultDescription={description}
              />
            </>
          }
        />

        <div className="border-b border-border/50 bg-card/20 backdrop-blur-sm z-40 flex-shrink-0 sticky top-0">
          <div className="container mx-auto flex items-center gap-4 py-4">
            <h1 className="text-2xl font-bold text-gray-200">{customTitle || t.ui('app.tierListTitle')}</h1>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCustomizeDialogOpen(true)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white gap-2"
              >
                <Settings className="w-4 h-4" />
                {t.ui('buttons.customize')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWeapons(!showWeapons)}
                className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600 gap-2"
              >
                {showWeapons ? t.ui('buttons.hideWeapons') : t.ui('buttons.showWeapons')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTravelers(!showTravelers)}
                className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600 gap-2"
              >
                {showTravelers ? t.ui('buttons.hideTravelers') : t.ui('buttons.showTravelers')}
              </Button>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-hidden">
          <div className="w-full px-4 h-full">
            <TierTable
              tierAssignments={tierAssignments}
              tierCustomization={tierCustomization}
              showTravelers={showTravelers}
              onTierAssignment={handleTierAssignment}
              onRemoveFromTiers={handleRemoveFromTiers}
            />
          </div>
        </main>
        
        <TierCustomizationDialog
          isOpen={isCustomizeDialogOpen}
          onClose={() => setIsCustomizeDialogOpen(false)}
          onSave={handleTierCustomizationSave}
          initialCustomization={tierCustomization}
          initialCustomTitle={customTitle}
        />
      </div>
    </TooltipProvider>
  );
};

export default TierListPage;
