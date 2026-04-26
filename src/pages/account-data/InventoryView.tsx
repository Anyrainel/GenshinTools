import { ChevronDown, ChevronRight, Monitor } from "lucide-react";
import { useCallback, useState } from "react";
import type { TaggedArtifact } from "@/components/account-data/InventoryArtifactGrid";
import {
  getInventoryArtifactTotalCount,
  InventoryArtifactSection,
} from "@/components/account-data/InventoryArtifactSection";
import { InventoryCharacterSection } from "@/components/account-data/InventoryCharacterSection";
import {
  ArtifactDeleteDialog,
  WeaponDeleteDialog,
} from "@/components/account-data/InventoryDeleteDialogs";
import type { TaggedWeapon } from "@/components/account-data/InventoryWeaponGrid";
import {
  getInventoryWeaponTotalCount,
  InventoryWeaponSection,
} from "@/components/account-data/InventoryWeaponSection";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ArtifactScannerDialog } from "@/components/shared/ArtifactScannerDialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AccountData } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface InventoryViewProps {
  data: AccountData;
  isEditMode?: boolean;
  onDeleteWeapon?: (weaponId: string) => void;
  onDeleteArtifact?: (artifactId: string) => void;
}

type ScanTarget = "characters" | "weapons" | "artifacts";

export function InventoryView({
  data,
  isEditMode = false,
  onDeleteWeapon,
  onDeleteArtifact,
}: InventoryViewProps) {
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const iconSize = isMobile ? "lg" : "xl";

  const [selectedWeapon, setSelectedWeapon] = useState<TaggedWeapon | null>(
    null
  );
  const [selectedArtifact, setSelectedArtifact] =
    useState<TaggedArtifact | null>(null);
  const [scannerOpen, setScannerOpen] = useState<false | ScanTarget>(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<ScanTarget, boolean>
  >(() => ({
    characters: false,
    weapons: true,
    artifacts: true,
  }));

  const toggleSection = useCallback((section: ScanTarget) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const handleWeaponClick = useCallback(
    (w: TaggedWeapon) => {
      if (isEditMode) setSelectedWeapon(w);
    },
    [isEditMode]
  );

  const handleArtifactClick = useCallback(
    (a: TaggedArtifact) => {
      if (isEditMode) setSelectedArtifact(a);
    },
    [isEditMode]
  );

  const handleDeleteWeapon = useCallback(() => {
    if (selectedWeapon && onDeleteWeapon) {
      onDeleteWeapon(selectedWeapon.id);
      setSelectedWeapon(null);
    }
  }, [selectedWeapon, onDeleteWeapon]);

  const handleDeleteArtifact = useCallback(() => {
    if (selectedArtifact && onDeleteArtifact) {
      onDeleteArtifact(selectedArtifact.id);
      setSelectedArtifact(null);
    }
  }, [selectedArtifact, onDeleteArtifact]);

  return (
    <ScrollLayout bodyClassName="space-y-6">
      <InventorySection
        title={t.ui("accountData.characters")}
        count={data.characters.length}
        expanded={expandedSections.characters}
        onToggle={() => toggleSection("characters")}
        onSync={() => setScannerOpen("characters")}
        syncLabel={t.ui("scanner.syncFromGame")}
      >
        <InventoryCharacterSection
          characters={data.characters}
          iconSize={iconSize}
        />
      </InventorySection>

      <InventorySection
        title={t.ui("accountData.weapons")}
        count={getInventoryWeaponTotalCount(data)}
        expanded={expandedSections.weapons}
        onToggle={() => toggleSection("weapons")}
        onSync={() => setScannerOpen("weapons")}
        syncLabel={t.ui("scanner.syncFromGame")}
      >
        <InventoryWeaponSection
          data={data}
          iconSize={iconSize}
          isEditMode={isEditMode}
          onWeaponClick={handleWeaponClick}
        />
      </InventorySection>

      <InventorySection
        title={t.ui("accountData.artifacts")}
        count={getInventoryArtifactTotalCount(data)}
        expanded={expandedSections.artifacts}
        onToggle={() => toggleSection("artifacts")}
        onSync={() => setScannerOpen("artifacts")}
        syncLabel={t.ui("scanner.syncFromGame")}
      >
        <InventoryArtifactSection
          data={data}
          iconSize={iconSize}
          isEditMode={isEditMode}
          onArtifactClick={handleArtifactClick}
        />
      </InventorySection>

      <WeaponDeleteDialog
        weapon={selectedWeapon}
        onClose={() => setSelectedWeapon(null)}
        onDelete={
          selectedWeapon && !selectedWeapon.equipped && onDeleteWeapon
            ? handleDeleteWeapon
            : undefined
        }
        t={t}
      />

      <ArtifactDeleteDialog
        artifact={selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
        onDelete={
          selectedArtifact && !selectedArtifact.equipped && onDeleteArtifact
            ? handleDeleteArtifact
            : undefined
        }
        t={t}
      />

      <ArtifactScannerDialog
        open={scannerOpen !== false}
        onOpenChange={(o) => {
          if (!o) setScannerOpen(false);
        }}
        defaultTarget={scannerOpen || "artifacts"}
      />
    </ScrollLayout>
  );
}

function InventorySection({
  title,
  count,
  expanded,
  onToggle,
  onSync,
  syncLabel,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onSync: () => void;
  syncLabel: string;
  children: React.ReactNode;
}) {
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-2">
        <button
          type="button"
          className="flex min-w-0 items-center gap-1.5 rounded-md text-foreground/90 hover:text-foreground"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <ChevronIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h3 className="text-lg font-semibold">
            {title}{" "}
            <span className="text-muted-foreground ml-1 text-base font-normal">
              ({count})
            </span>
          </h3>
        </button>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={onSync}
        >
          <Monitor className="h-4 w-4" />
          {syncLabel}
        </Button>
      </div>
      {expanded && children}
    </div>
  );
}
