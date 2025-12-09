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
import { cn } from '@/lib/utils';
import { LAYOUT, BUTTONS } from '@/constants/theme';
import { loadPresetMetadata, loadPresetPayload } from '@/lib/presetLoader';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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
  const showRarity5 = useWeaponTierStore((state) => state.showRarity5);
  const showRarity4 = useWeaponTierStore((state) => state.showRarity4);
  const showRarity3 = useWeaponTierStore((state) => state.showRarity3);
  const setShowRarity5 = useWeaponTierStore((state) => state.setShowRarity5);
  const setShowRarity4 = useWeaponTierStore((state) => state.setShowRarity4);
  const setShowRarity3 = useWeaponTierStore((state) => state.setShowRarity3);

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
      const localizedName = t.weaponName(weapon.id); // Fallback to ID if not found, usually name is in i18nGameData

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
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetPayload(presetModules, path);
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

  const handleAssignmentsChange = (newAssignments: TierAssignment) => {
    setTierAssignments(newAssignments);
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
                loadPreset={loadPreset}
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

        <div className={cn(LAYOUT.HEADER_BORDER, 'z-40 flex-shrink-0 sticky top-0')}>
          <div className="container mx-auto flex items-center gap-4 py-4">
            <h1 className="text-2xl font-bold text-gray-200">{customTitle || t.ui('app.weaponTierListTitle')}</h1>
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCustomizeDialogOpen(true)}
                className={BUTTONS.CUSTOMIZE}
              >
                <Settings className="w-4 h-4" />
                {t.ui('buttons.customize')}
              </Button>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rarity-5"
                    checked={showRarity5}
                    onCheckedChange={(checked) => setShowRarity5(checked === true)}
                  />
                  <Label htmlFor="rarity-5" className="text-sm text-gray-200 cursor-pointer">
                    {t.ui('buttons.includeRarity5')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rarity-4"
                    checked={showRarity4}
                    onCheckedChange={(checked) => setShowRarity4(checked === true)}
                  />
                  <Label htmlFor="rarity-4" className="text-sm text-gray-200 cursor-pointer">
                    {t.ui('buttons.includeRarity4')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rarity-3"
                    checked={showRarity3}
                    onCheckedChange={(checked) => setShowRarity3(checked === true)}
                  />
                  <Label htmlFor="rarity-3" className="text-sm text-gray-200 cursor-pointer">
                    {t.ui('buttons.includeRarity3')}
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-4 h-full">
            <WeaponTierTable
              tierAssignments={tierAssignments}
              tierCustomization={tierCustomization}
              onAssignmentsChange={handleAssignmentsChange}
              showRarity5={showRarity5}
              showRarity4={showRarity4}
              showRarity3={showRarity3}
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
