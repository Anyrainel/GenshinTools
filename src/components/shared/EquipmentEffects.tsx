import { useLanguage } from "@/contexts/LanguageContext";
import { useArtifactText, useWeaponText } from "@/hooks/useGameText";
import { cn } from "@/lib/utils";

export function WeaponEffect({
  weaponId,
  refinement,
  className,
}: {
  weaponId: string;
  refinement?: number;
  className?: string;
}) {
  const { t } = useLanguage();
  useWeaponText();
  const effectHtml = t.weaponEffect(weaponId, refinement);

  return effectHtml ? (
    <div
      className={cn(className, "leading-relaxed")}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Weapon effect HTML from game data pipeline
      dangerouslySetInnerHTML={{ __html: effectHtml }}
    />
  ) : null;
}

export function ArtifactSetEffects({
  setId,
  hideFourPieceEffect,
  className,
  labelClassName,
}: {
  setId: string;
  hideFourPieceEffect?: boolean;
  className?: string;
  labelClassName?: string;
}) {
  const { t } = useLanguage();
  useArtifactText();
  const effects = t.artifactEffects(setId);

  return (
    <div className="space-y-3">
      {(hideFourPieceEffect ? [0] : [0, 1]).map((index) => (
        <div key={index} className={cn(className, "leading-relaxed")}>
          <span className={cn("mr-1 font-medium", labelClassName)}>
            [{index === 0 ? 2 : 4}]
          </span>
          {effects[index] ? (
            <span
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Artifact effect HTML from game data pipeline
              dangerouslySetInnerHTML={{ __html: effects[index] }}
            />
          ) : (
            "???"
          )}
        </div>
      ))}
    </div>
  );
}

export function ArtifactHalfSetEffect({
  halfSetId,
  className,
  labelClassName,
}: {
  halfSetId: string | number;
  className?: string;
  labelClassName?: string;
}) {
  const { t } = useLanguage();

  return (
    <div className={cn(className, "leading-relaxed")}>
      <span className={cn("mr-1 font-medium", labelClassName)}>[2]</span>
      {t.artifactHalfSet(halfSetId)}
    </div>
  );
}
