import type { TaggedArtifact } from "@/components/account-data/InventoryArtifactGrid";
import type { TaggedWeapon } from "@/components/account-data/InventoryWeaponGrid";
import { ArtifactDataContent } from "@/components/shared/ArtifactDataHoverCard";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import type { useLanguage } from "@/contexts/LanguageContext";
import { Trash2 } from "lucide-react";

type T = ReturnType<typeof useLanguage>["t"];

interface WeaponDeleteDialogProps {
  weapon: TaggedWeapon | null;
  onClose: () => void;
  onDelete?: () => void;
  t: T;
}

export function WeaponDeleteDialog({
  weapon,
  onClose,
  onDelete,
  t,
}: WeaponDeleteDialogProps) {
  return (
    <ResponsiveDialog
      open={!!weapon}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {weapon ? t.weapon(weapon.key) : ""}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription asChild>
            <span>
              Lv. {weapon?.level}{" "}
              {weapon &&
                t
                  .ui("common.refinementFormat")
                  .replace("{0}", String(weapon.refinement))}
              {weapon?.equipped && ` \u2022 ${t.ui("accountData.equipped")}`}
            </span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {weapon && (
          <div className="flex justify-center py-2">
            <WeaponTooltip weaponId={weapon.key} />
          </div>
        )}

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.ui("common.cancel")}
          </Button>
          {weapon && !weapon.equipped && onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t.ui("common.delete")}
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

interface ArtifactDeleteDialogProps {
  artifact: TaggedArtifact | null;
  onClose: () => void;
  onDelete?: () => void;
  t: T;
}

export function ArtifactDeleteDialog({
  artifact,
  onClose,
  onDelete,
  t,
}: ArtifactDeleteDialogProps) {
  return (
    <ResponsiveDialog
      open={!!artifact}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {artifact ? t.artifact(artifact.setKey) : ""}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription asChild>
            <span>
              {artifact && t.slot(artifact.slotKey)} +{artifact?.level}
              {artifact?.equipped && ` \u2022 ${t.ui("accountData.equipped")}`}
            </span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {artifact && (
          <div className="flex justify-center py-2">
            <ArtifactDataContent
              artifact={artifact}
              slot={artifact.slotKey}
              showIcon
            />
          </div>
        )}

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.ui("common.cancel")}
          </Button>
          {artifact && !artifact.equipped && onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t.ui("common.delete")}
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
