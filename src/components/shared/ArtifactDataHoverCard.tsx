import { ArrowRight, CircleHelp } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArtifactStatList } from "@/components/shared/ArtifactStatList";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { getRarityColor } from "./colors";

// ArtifactDataContent - Shared content component for single artifact display
interface ArtifactDataContentProps {
  artifact: ArtifactData;
  slot: Slot;
  showIcon?: boolean;
  compact?: boolean;
  /** When true, uses flex-1 to expand and fill available width equally */
  fillWidth?: boolean;
}

export function ArtifactDataContent({
  artifact,
  slot,
  showIcon = false,
  compact = false,
  fillWidth = false,
}: ArtifactDataContentProps) {
  const { t } = useLanguage();
  const name = t.artifact(artifact.setKey);
  const badge = artifact.astralMark ? "⭐" : undefined;
  const totalRolls = artifact.totalRolls;

  return (
    <div
      className={cn(
        "bg-slate-900 border-2 border-amber-500/50 rounded-lg overflow-hidden text-slate-100 shadow-xl",
        fillWidth
          ? "flex-1 basis-0"
          : compact
            ? "min-w-32"
            : showIcon
              ? "min-w-52"
              : "min-w-44"
      )}
    >
      {/* Header with optional icon */}
      <div
        className={cn(
          "border-b-2 border-amber-500/50",
          compact ? "p-2" : "p-3",
          showIcon && "flex items-center gap-3"
        )}
      >
        {showIcon && (
          <ItemIcon
            artifactSetId={artifact.setKey}
            slot={slot}
            rarity={artifact.rarity}
            badge={badge}
            lock={artifact.lock}
            level={`+${artifact.level}`}
            size="md"
          />
        )}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "font-bold truncate",
              compact ? "text-sm" : "text-base",
              getRarityColor(artifact.rarity, "text")
            )}
          >
            {name}
          </div>
          <div className="text-sm text-slate-400 capitalize">
            {t.slot(slot)}
          </div>
          {totalRolls !== undefined && (
            <div className="text-xs text-slate-500">
              {t
                .ui("accountData.totalRolls")
                .replace("{0}", totalRolls.toString())}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className={cn(compact ? "p-2" : "p-3")}>
        <ArtifactStatList artifact={artifact} compact={compact} />
      </div>
    </div>
  );
}

// ArtifactComparisonContent - Side-by-side before → after display
// When afterArtifact is undefined, shows a "?" placeholder
interface ArtifactComparisonContentProps {
  beforeArtifact?: ArtifactData;
  afterArtifact?: ArtifactData;
  slot: Slot;
  showIcons?: boolean;
  /** When true, uses compact sizing and equal-width flex layout for mobile */
  compact?: boolean;
}

/** Placeholder for unknown/missing artifact (e.g., FARM suggestions or EQUIP empty slots) */
function ArtifactPlaceholder({
  label,
  showIcon = false,
  compact = false,
  fillWidth = false,
}: {
  label: string;
  showIcon?: boolean;
  compact?: boolean;
  fillWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-slate-900 border-2 border-amber-500/50 rounded-lg overflow-hidden text-slate-100 shadow-xl flex flex-col items-center justify-center",
        fillWidth
          ? "flex-1 basis-0"
          : compact
            ? "min-w-32"
            : showIcon
              ? "min-w-52"
              : "min-w-44"
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-2",
          compact ? "p-4" : "p-6"
        )}
      >
        <CircleHelp
          className={cn(
            "text-muted-foreground",
            compact ? "w-8 h-8" : "w-12 h-12"
          )}
        />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function ArtifactComparisonContent({
  beforeArtifact,
  afterArtifact,
  slot,
  showIcons = false,
  compact = false,
}: ArtifactComparisonContentProps) {
  const { t } = useLanguage();
  return (
    <div className={cn("flex items-stretch gap-2", compact && "w-full")}>
      {beforeArtifact ? (
        <ArtifactDataContent
          artifact={beforeArtifact}
          slot={slot}
          showIcon={showIcons}
          compact={compact}
          fillWidth={compact}
        />
      ) : (
        <ArtifactPlaceholder
          label={t.ui("accountData.empty")}
          showIcon={showIcons}
          compact={compact}
          fillWidth={compact}
        />
      )}
      <div className="flex items-center justify-center px-1 shrink-0">
        <ArrowRight className="w-5 h-5 text-muted-foreground" />
      </div>
      {afterArtifact ? (
        <ArtifactDataContent
          artifact={afterArtifact}
          slot={slot}
          showIcon={showIcons}
          compact={compact}
          fillWidth={compact}
        />
      ) : (
        <ArtifactPlaceholder
          label={t.ui("accountData.upgrade")}
          showIcon={showIcons}
          compact={compact}
          fillWidth={compact}
        />
      )}
    </div>
  );
}

// ArtifactDataHoverCard - Single artifact hover card (used in InventoryView)
interface ArtifactDataHoverCardProps {
  artifact: ArtifactData;
  slot: Slot;
  children: ReactNode;
  side?: "left" | "right" | "top" | "bottom";
}

export function ArtifactDataHoverCard({
  artifact,
  slot,
  children,
  side = "right",
}: ArtifactDataHoverCardProps) {
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isPinned, setIsPinned] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isOpen = isPinned || isHovering;

  // Click-outside detection when pinned
  useEffect(() => {
    if (!isPinned) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutsideTrigger = !triggerRef.current?.contains(target);
      const isOutsideContent = !contentRef.current?.contains(target);

      if (isOutsideTrigger && isOutsideContent) {
        setIsPinned(false);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isPinned]);

  const handleOpenChange = (open: boolean) => {
    if (isPinned) return;
    setIsHovering(open);
  };

  // Mobile: Use Drawer
  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="bg-slate-950/95 border-t border-white/10">
          {/* Accessible title/description (visually hidden) */}
          <DrawerTitle className="sr-only">
            {t.ui("accountData.artifactDetails")}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {t.artifact(artifact.setKey)} - {t.slot(slot)}
          </DrawerDescription>
          <div className="p-4 pt-0 safe-area-bottom flex justify-center">
            <ArtifactDataContent artifact={artifact} slot={slot} showIcon />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Use HoverCard with click-to-pin
  return (
    <HoverCard openDelay={200} open={isOpen} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        ref={contentRef}
        side={side}
        className="w-auto p-0 border-none bg-slate-900 shadow-xl"
      >
        <ArtifactDataContent artifact={artifact} slot={slot} />
      </HoverCardContent>
    </HoverCard>
  );
}

// ArtifactComparisonHoverCard - Before→After hover card (used in InsightList)
// Either side is optional: omit beforeArtifact for EQUIP (empty→artifact)
interface ArtifactComparisonHoverCardProps {
  /** The current/equipped artifact (optional - when missing, shows only the after artifact) */
  beforeArtifact?: ArtifactData;
  /** The upgrade/new artifact (optional - when missing, shows only the before artifact) */
  afterArtifact?: ArtifactData;
  slot: Slot;
  children: ReactNode;
  /** Label for the current artifact (e.g., "Current") */
  currentLabel?: string;
  /** Label for the upgrade artifact (e.g., "Upgrade") */
  upgradeLabel?: string;
}

export function ArtifactComparisonHoverCard({
  beforeArtifact,
  afterArtifact,
  slot,
  children,
  currentLabel,
  upgradeLabel,
}: ArtifactComparisonHoverCardProps) {
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isPinned, setIsPinned] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isOpen = isPinned || isHovering;

  // Click-outside detection when pinned
  useEffect(() => {
    if (!isPinned) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutsideTrigger = !triggerRef.current?.contains(target);
      const isOutsideContent = !contentRef.current?.contains(target);

      if (isOutsideTrigger && isOutsideContent) {
        setIsPinned(false);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isPinned]);

  const handleOpenChange = (open: boolean) => {
    if (isPinned) return;
    setIsHovering(open);
  };

  const defaultCurrentLabel = t.ui("accountData.current");
  const defaultUpgradeLabel = t.ui("accountData.upgrade");

  // Mobile: Use Drawer
  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <div className="cursor-pointer">{children}</div>
        </DrawerTrigger>
        <DrawerContent className="bg-slate-950/95 border-t border-white/10">
          {/* Accessible title/description (visually hidden) */}
          <DrawerTitle className="sr-only">
            {t.ui("accountData.artifactDetails")}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {`${currentLabel ?? defaultCurrentLabel} → ${upgradeLabel ?? defaultUpgradeLabel}`}
          </DrawerDescription>
          <div className="p-4 pt-0 safe-area-bottom w-full">
            {/* Labels - centered */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">
                {currentLabel ?? defaultCurrentLabel}
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {upgradeLabel ?? defaultUpgradeLabel}
              </span>
            </div>
            {/* Comparison - full width */}
            <ArtifactComparisonContent
              beforeArtifact={beforeArtifact}
              afterArtifact={afterArtifact}
              slot={slot}
              showIcons
              compact
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Use HoverCard with click-to-pin
  return (
    <HoverCard openDelay={200} open={isOpen} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        ref={contentRef}
        side="top"
        align="center"
        className="w-auto max-w-none p-3 bg-slate-950/95 border border-slate-700 rounded-lg"
      >
        <ArtifactComparisonContent
          beforeArtifact={beforeArtifact}
          afterArtifact={afterArtifact}
          slot={slot}
          showIcons={false}
          compact={false}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
