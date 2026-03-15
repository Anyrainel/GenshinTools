import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import { TeamPickerGrid } from "@/components/shared/TeamPickerGrid";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AccountData } from "@/data/types";
import { useState } from "react";

interface TeamEditDialogProps {
  open: boolean;
  onSave: (team: {
    characters: (string | null)[];
    weapons: (string | null)[];
    artifacts: (ArtifactConfig | null)[];
  }) => void;
  onCancel: () => void;
  initialCharacters: (string | null)[];
  initialWeapons: (string | null)[];
  initialArtifacts: (ArtifactConfig | null)[];
  accountData: AccountData | null;
}

export function TeamEditDialog({
  open,
  onSave,
  onCancel,
  initialCharacters,
  initialWeapons,
  initialArtifacts,
  accountData,
}: TeamEditDialogProps) {
  const { t } = useLanguage();

  const [characters, setCharacters] =
    useState<(string | null)[]>(initialCharacters);
  const [weapons, setWeapons] = useState<(string | null)[]>(initialWeapons);
  const [artifacts, setArtifacts] =
    useState<(ArtifactConfig | null)[]>(initialArtifacts);

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <ResponsiveDialogContent className="md:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("buildCard.autoTuneEditTeam")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription asChild>
            <span>{t.ui("buildCard.autoTuneEditTeamDesc")}</span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="py-2">
          <TeamPickerGrid
            characters={characters}
            weapons={weapons}
            artifacts={artifacts}
            onChange={(patch) => {
              if (patch.characters) setCharacters(patch.characters);
              if (patch.weapons) setWeapons(patch.weapons);
              if (patch.artifacts) setArtifacts(patch.artifacts);
            }}
            accountData={accountData}
            triggerSize="sm"
            gap="sm"
          />
        </div>

        <ResponsiveDialogFooter>
          <div className="flex gap-2 w-full justify-end">
            <Button variant="outline" onClick={onCancel}>
              {t.ui("common.cancel")}
            </Button>
            <Button onClick={() => onSave({ characters, weapons, artifacts })}>
              {t.ui("buildCard.autoTuneSaveTeam")}
            </Button>
          </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
