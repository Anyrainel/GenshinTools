import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Settings } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ToolHeader } from '@/components/shared/ToolHeader';
import { ImportControl } from '@/components/shared/ImportControl';
import { ExportControl } from '@/components/shared/ExportControl';
import { ClearAllControl } from '@/components/shared/ClearAllControl';
import { PresetOption, TierListData, TierAssignment, TierCustomization } from '@/data/types';
import { useWeaponTierStore } from '@/stores/useWeaponTierStore';
import WeaponTierTable from '@/components/tier-list/WeaponTierTable';
import TierCustomizationDialog from '@/components/tier-list/TierCustomizationDialog';
import { weaponsById } from "@/data/constants";
import { toast } from 'sonner';

// Placeholder for weapon tier list presets
const presetModules = import.meta.glob<{ default: TierListData }>('@/presets/weapon-tier-list/*.json', { eager: false });

const WeaponTierListPage = () => {
  const { t, language, setLanguage } = useLanguage();

  const tierAssignments = useWeaponTierStore((state) => state.tierAssignments);
  const tierCustomization = useWeaponTierStore((state) => state.tierCustomization);
  const customTitle = useWeaponTierStore((state) => state.customTitle);
  const setTierAssignments = useWeaponTierStore((state) => state.setTierAssignments);
  const setTierCustomization = useWeaponTierStore((state) => state.setTierCustomization);
  const setCustomTitle = useWeaponTierStore((state) => state.setCustomTitle);
  const resetStoredTierList = useWeaponTierStore((state) => state.resetTierList);
  const loadTierListData = useWeaponTierStore((state) => state.loadTierListData);
  const author = useWeaponTierStore((state) => state.author);
  const description = useWeaponTierStore((state) => state.description);

  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);

  const prevAssignmentsRef = useRef<TierAssignment>(tierAssignments);
  const shouldShowAutoSaveRef = useRef(false);

  useEffect(() => {
    if (!shouldShowAutoSaveRef.current) {
      shouldShowAutoSaveRef.current = true;
      prevAssignmentsRef.current = tierAssignments;
      return;
    }

    const prev = prevAssignmentsRef.current;
    const curr = tierAssignments;

    const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
    const changes: { weaponId: string; fromTier?: string; toTier?: string }[] = [];

    allKeys.forEach(weaponId => {
      const prevAssignment = prev[weaponId];
      const currAssignment = curr[weaponId];

      if (currAssignment && (!prevAssignment || prevAssignment.tier !== currAssignment.tier)) {
        changes.push({
          weaponId,
          fromTier: prevAssignment?.tier,
          toTier: currAssignment.tier,
        });
      }
      else if (prevAssignment && !currAssignment) {
        changes.push({
          weaponId,
          fromTier: prevAssignment.tier,
        });
      }
    });

    if (changes.length > 0) {
      const change = changes[0];
      const weapon = weaponsById[change.weaponId];
      if (!weapon) return;

      // Use a generic message key or reuse characterMoved if acceptable
      // Ideally should add weaponMoved messages
      const localizedName = t.ui('weapon', weapon.id); // Fallback to ID if not found, usually name is in i18nGameData

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

  useEffect(() => {
    const loadPresetMetadata = async () => {
      const options = await Promise.all(
        Object.keys(presetModules).map(async (path) => {
          try {
            const loader = presetModules[path];
            const module = await loader();
            const payload = module?.default ?? (module as unknown as TierListData);

            if (payload.author && payload.description) {
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
            console.error(`Failed to load weapon tierlist preset metadata for ${path}:`, error);
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
      throw new Error(`Weapon TierList Preset not found for path: ${path}`);
    }

    const module = await loader();
    const payload = module?.default ?? (module as unknown as TierListData);
    // Add normalization if needed (like nameToIdMap)
    return payload;
  }, []);

  const handleImport = (importedData: TierListData) => {
    shouldShowAutoSaveRef.current = false;
    
    // Normalize logic if needed

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
      author,
      description
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
      
      useWeaponTierStore.getState().setMetadata(author, description);
      
      toast.success(t.ui('messages.tierListSaved'));
    } catch (error) {
      console.error('Error saving weapon tier list:', error);
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
      Object.keys(newAssignments).forEach(weaponId => {
        if (newAssignments[weaponId].tier === tier) {
          delete newAssignments[weaponId];
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

  const handleTierAssignment = (draggedWeaponId: string, dropTargetWeaponId: string | null, tier: string, direction: 'left' | 'right') => {
    setTierAssignments(prev => {
      const newAssignments = { ...prev };
      
      const targetTierWeapons = Object.entries(prev)
        .filter(([id, assignment]) => assignment.tier === tier && id !== draggedWeaponId)
        .map(([id, assignment]) => ({ id, ...assignment }))
        .sort((a, b) => a.position - b.position);

      let insertIndex = targetTierWeapons.length;

      if (dropTargetWeaponId) {
        const targetIndex = targetTierWeapons.findIndex(c => c.id === dropTargetWeaponId);
        if (targetIndex !== -1) {
          if (direction === 'left') {
            insertIndex = targetIndex;
          } else {
            insertIndex = targetIndex + 1;
          }
        }
      } else {
          if (direction === 'left') insertIndex = 0;
      }

      targetTierWeapons.splice(insertIndex, 0, {
        id: draggedWeaponId,
        tier: tier,
        position: 0 
      });

      targetTierWeapons.forEach((w, index) => {
        newAssignments[w.id] = { tier, position: index };
      });
      
      return newAssignments;
    });
  };

  const handleRemoveFromTiers = (weaponId: string) => {
    setTierAssignments(prev => {
      const newAssignments = { ...prev };
      const oldAssignment = prev[weaponId];
      const weapon = weaponsById[weaponId];
      if (!weapon) return prev;

      if (oldAssignment) {
        const typeWeapons = Object.entries(prev)
          .filter(([id, assignment]: [string, { tier: string; position: number }]) => {
            const w = weaponsById[id];
            return w?.type === weapon.type &&
              assignment.tier === oldAssignment.tier;
          })
          .map(([id, assignment]: [string, { tier: string; position: number }]) => ({
            id,
            position: assignment.position
          }))
          .sort((a, b) => a.position - b.position);

        delete newAssignments[weapon.id];

        let newPosition = 0;
        typeWeapons.forEach((card) => {
          if (card.id !== weapon.id) {
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
          title={t.ui('app.weaponTierListTitle')}
          actions={
            <>
              <ClearAllControl
                onConfirm={handleClear}
                dialogTitle={t.ui('resetConfirmDialog.title')}
                dialogDescription={t.ui('resetConfirmDialog.message')}
                confirmActionLabel={t.ui('resetConfirmDialog.confirm')}
              />

              <ImportControl<TierListData>
                options={presetOptions}
                loadPreset={loadPresetPayload}
                onApply={handleImport}
                onLocalImport={handleImport}
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
            <h1 className="text-2xl font-bold text-gray-200">{customTitle || t.ui('app.weaponTierListTitle')}</h1>
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
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-4 h-full">
            <WeaponTierTable
              tierAssignments={tierAssignments}
              tierCustomization={tierCustomization}
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

export default WeaponTierListPage;
