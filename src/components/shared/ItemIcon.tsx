import type { Rarity, Slot } from "@/data/enums";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/gameResources";
import { cn, getAssetUrl } from "@/lib/utils";
import { Lock } from "lucide-react";
import { forwardRef } from "react";
import { getRarityColor } from "./colors";

/**
 * Resolve two artifact half-set IDs to distinct flower image paths.
 * For different half-sets: picks any 5★ artifact from each.
 * For identical half-sets: picks two different 5★ artifacts from that set.
 * Throws if a same-ID half-set maps to fewer than 2 five-star artifact sets.
 */
export function resolveHalfSetIcons(
  id1: string,
  id2: string
): [string, string] {
  const hs1 = artifactHalfSetsById[id1];
  const hs2 = artifactHalfSetsById[id2];

  const art1 = hs1?.setIds
    .map((id) => artifactsById[id])
    .find((a) => a?.rarity === 5);

  if (id1 !== id2) {
    const art2 = hs2?.setIds
      .map((id) => artifactsById[id])
      .find((a) => a?.rarity === 5);
    return [art1?.imagePaths.flower ?? "", art2?.imagePaths.flower ?? ""];
  }

  // Same half-set used twice — pick two distinct 5★ artifacts
  const art2 = hs1?.setIds
    .map((id) => artifactsById[id])
    .find((a) => a?.rarity === 5 && a.id !== art1?.id);

  if (!art1 || !art2) {
    throw new Error(
      `Half-set ${id1} maps to fewer than 2 five-star artifact sets`
    );
  }

  return [art1.imagePaths.flower, art2.imagePaths.flower];
}

/** Character ID prefixes that share the same portrait but need an element overlay */
const VARIANT_PREFIXES = ["traveler", "manekin"] as const;

/** Extract element name from variant character IDs (traveler_*, manekin_*, manekina_*) */
function getVariantElement(characterId?: string): string | null {
  if (!characterId) return null;
  if (!VARIANT_PREFIXES.some((p) => characterId.startsWith(p))) return null;
  const idx = characterId.lastIndexOf("_");
  return idx > 0 ? characterId.slice(idx + 1) : null;
}

interface ItemIconProps extends React.ComponentPropsWithoutRef<"div"> {
  // ── Domain resolution props ──
  /** Character ID — resolves imagePath, rarity, and variant element overlay */
  characterId?: string;
  /** Weapon ID — resolves imagePath, rarity */
  weaponId?: string;
  /** Artifact set ID — resolves imagePath (flower by default, or specific slot), rarity */
  artifactSetId?: string;
  /** Two half-set IDs for 2pc+2pc — resolves two distinct flower imagePaths */
  halfSetIds?: [string, string];
  /** Artifact slot — with artifactSetId, resolves that slot's image instead of flower */
  slot?: Slot;

  // ── Manual / override ──
  /** Raw image path — overrides domain resolution when provided */
  imagePath?: string;
  /** Second image path for manual split display (e.g. account-data 2pc+2pc with real set icons) */
  imagePath2?: string;
  /** Rarity for background color — overrides domain resolution when provided */
  rarity?: Rarity;

  // ── Add-on props ──
  /** Top-left badge — a number (constellation count) or a single unicode character (e.g. "⭐"). NOT formatted strings like "C1". */
  badge?: string | number;
  lock?: boolean;
  elementBadge?: string;
  /** Weapon type overlay badge (top-right, rounded with backdrop blur) */
  weaponTypeBadge?: string;
  level?: string;
  size?: ItemIconSize;
  frozen?: boolean;
}

// Explicit configuration for each size
// Tuned for visual balance and to avoid mixed-shorthand warnings
export const ICON_CONFIG = {
  xs: {
    icon: 40,
    radius: 6,
    corner: {
      size: 10,
      offset: 1,
      radius: 2,
      containerRadius: 2,
      fontSize: 8,
      lockIconSize: 7,
    },
    level: { height: 7, fontSize: 8, cornerFill: 6 },
  },
  sm: {
    icon: 48,
    radius: 8,
    corner: {
      size: 12,
      offset: 1.5,
      radius: 3,
      containerRadius: 3,
      fontSize: 10,
      lockIconSize: 8.5,
    },
    level: { height: 10, fontSize: 9, cornerFill: 8 },
  },
  md: {
    icon: 56,
    radius: 8,
    corner: {
      size: 14,
      offset: 1.75,
      radius: 3.5,
      containerRadius: 3,
      fontSize: 11,
      lockIconSize: 10,
    },
    level: { height: 11, fontSize: 10, cornerFill: 8 },
  },
  lg: {
    icon: 64, // Base size
    radius: 10,
    corner: {
      size: 16,
      offset: 2,
      radius: 4,
      containerRadius: 4,
      fontSize: 12,
      lockIconSize: 11,
    },
    level: { height: 11, fontSize: 11, cornerFill: 10 },
  },
  xl: {
    icon: 80,
    radius: 10,
    corner: {
      size: 20,
      offset: 2.5,
      radius: 5,
      containerRadius: 5,
      fontSize: 15,
      lockIconSize: 14,
    },
    level: { height: 14, fontSize: 13, cornerFill: 10 },
  },
} as const;

export type ItemIconSize = keyof typeof ICON_CONFIG;

// Legacy export for backward compatibility
// eslint-disable-next-line react-refresh/only-export-components
export const SIZE_CLASSES = {
  xs: "w-10 h-10 rounded-sm",
  sm: "w-12 h-12 rounded-sm",
  md: "w-14 h-14 rounded-sm",
  lg: "w-16 h-16 rounded-md",
  xl: "w-20 h-20 rounded-md",
} as const;

export const ItemIcon = forwardRef<HTMLDivElement, ItemIconProps>(
  (
    {
      characterId,
      weaponId,
      artifactSetId,
      halfSetIds,
      slot,
      imagePath: rawImagePath,
      imagePath2: rawImagePath2,
      rarity: rawRarity,
      badge,
      lock,
      elementBadge,
      weaponTypeBadge,
      level,
      size = "lg",
      frozen,
      className,
      style,
      ...props
    },
    ref
  ) => {
    // ── Domain resolution ──
    // Explicit imagePath/rarity always override resolved values.
    let imagePath: string;
    let imagePath2 = rawImagePath2;
    let rarity: Rarity;

    if (rawImagePath !== undefined) {
      // Manual mode — caller provided an explicit path
      imagePath = rawImagePath;
      rarity = rawRarity ?? 1;
    } else if (halfSetIds) {
      const [p1, p2] = resolveHalfSetIcons(halfSetIds[0], halfSetIds[1]);
      imagePath = p1;
      imagePath2 = p2;
      rarity = rawRarity ?? 5;
    } else if (characterId) {
      const char = charactersById[characterId];
      imagePath = char?.imagePath ?? "";
      rarity = rawRarity ?? char?.rarity ?? 1;
    } else if (weaponId) {
      const weapon = weaponsById[weaponId];
      imagePath = weapon?.imagePath ?? "";
      rarity = rawRarity ?? weapon?.rarity ?? 1;
    } else if (artifactSetId) {
      const art = artifactsById[artifactSetId];
      imagePath = (slot ? art?.imagePaths[slot] : art?.imagePaths.flower) ?? "";
      rarity = rawRarity ?? art?.rarity ?? 1;
    } else {
      imagePath = "";
      rarity = rawRarity ?? 1;
    }

    // ── Double-icon mode: split layout for 2pc+2pc artifact sets ──
    if (imagePath2 !== undefined) {
      const config = ICON_CONFIG[size] || ICON_CONFIG.lg;
      const iconSize = config.icon;
      const borderRadius = config.radius;
      return (
        <div
          ref={ref}
          className={cn(
            "overflow-hidden relative flex-shrink-0 border-2 border-[#b27330] bg-[#3a2d13]",
            frozen && "ring-2 ring-cyan-400/60",
            className
          )}
          style={{
            ...style,
            width: iconSize,
            height: iconSize,
            borderRadius,
          }}
          {...props}
        >
          <div className="absolute inset-0 bg-[#b27330]" />
          <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] z-10">
            <img
              src={getAssetUrl(imagePath)}
              className="w-full h-full object-cover"
              alt={imagePath}
              draggable={false}
            />
          </div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] z-20">
            <img
              src={getAssetUrl(imagePath2)}
              className="w-full h-full object-cover"
              alt={imagePath2}
              draggable={false}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-5">
            <div className="w-[1px] h-[200%] bg-black/20 rotate-45" />
          </div>
        </div>
      );
    }

    // ── Single-icon mode ──
    const config = ICON_CONFIG[size];
    const effectiveConfig = config || ICON_CONFIG.lg;

    const {
      icon: iconSize,
      radius: borderRadius,
      corner,
      level: levelConfig,
    } = effectiveConfig;

    const showBadge = badge !== undefined;
    const showLock = lock;
    const showElement = !!elementBadge && !showLock;
    const showLevel = !!level;

    // Calculate total height (icon + visible level bar portion)
    const totalHeight = showLevel ? iconSize + levelConfig.height : iconSize;

    // Wrapper style
    const wrapperStyle: React.CSSProperties = {
      ...style,
      width: iconSize,
      height: totalHeight,
    };

    // Inner container (helper for layout)
    const innerStyle: React.CSSProperties = {
      width: iconSize,
      height: totalHeight,
    };

    // Icon element
    const iconElement = (
      <div
        className={cn(
          "relative overflow-hidden flex-shrink-0 select-none",
          getRarityColor(rarity, "bg"),
          frozen && "ring-2 ring-cyan-400/60"
        )}
        style={{
          width: iconSize,
          height: iconSize,
          // Use distinct properties to avoid "mixed shorthand" warning
          borderTopLeftRadius: showBadge
            ? corner.containerRadius
            : borderRadius,
          borderTopRightRadius:
            showLock || showElement ? corner.containerRadius : borderRadius,
          borderBottomRightRadius: borderRadius,
          borderBottomLeftRadius: borderRadius,
        }}
      >
        <img
          src={getAssetUrl(imagePath)}
          alt={imagePath}
          className="w-full h-full object-cover"
          style={{ transform: "scale(1.1)" }}
          draggable={false}
        />

        {/* Lock indicator - top right */}
        {showLock && (
          <div
            className="absolute flex items-center justify-center bg-red-900/90 shadow-sm"
            style={{
              width: corner.size,
              height: corner.size,
              top: corner.offset,
              right: corner.offset,
              borderRadius: corner.radius,
            }}
          >
            <Lock
              className="text-red-300"
              style={{
                width: corner.lockIconSize,
                height: corner.lockIconSize,
              }}
              strokeWidth={2.5}
            />
          </div>
        )}

        {/* Badge - top left */}
        {showBadge && (
          <div
            className="absolute bg-[#4a3b2a] text-[#eccf83] font-semibold text-center leading-none flex items-center justify-center"
            style={{
              width: corner.size,
              height: corner.size,
              top: corner.offset,
              left: corner.offset,
              fontSize: corner.fontSize,
              borderRadius: corner.radius,
            }}
          >
            {badge}
          </div>
        )}

        {/* Element badge - top right (alternative to lock) */}
        {showElement && (
          <div
            className="absolute flex items-center justify-center bg-black/60 shadow-sm"
            style={{
              width: corner.size,
              height: corner.size,
              top: corner.offset,
              right: corner.offset,
              borderRadius: corner.radius,
            }}
          >
            <img
              src={getAssetUrl(elementBadge)}
              alt="element"
              style={{
                width: corner.lockIconSize,
                height: corner.lockIconSize,
              }}
              className="object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* Weapon type badge - top right (rounded with backdrop blur) */}
        {weaponTypeBadge && !showLock && !showElement && (
          <div className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center">
            <div className="relative bg-black/30 rounded-full backdrop-blur-sm">
              <img
                src={getAssetUrl(weaponTypeBadge)}
                alt="weapon type"
                className="w-5 h-5 object-contain filter brightness-125 contrast-150 drop-shadow-lg"
                draggable={false}
              />
            </div>
          </div>
        )}

        {/* Variant element overlay - bottom center (traveler/manekin/manekina) */}
        {(() => {
          const el = getVariantElement(characterId);
          if (!el) return null;
          const badgeSize = Math.round(iconSize * 0.34);
          return (
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-full"
              style={{ width: badgeSize, height: badgeSize, padding: 1 }}
            >
              <img
                src={getAssetUrl(`element/${el}.webp`)}
                className="w-full h-full object-contain"
                alt={el}
                draggable={false}
              />
            </div>
          );
        })()}
      </div>
    );

    // If no level, just return the icon
    if (!showLevel) {
      return (
        <div
          ref={ref}
          className={cn("flex-shrink-0 block", className)}
          style={wrapperStyle}
          {...props}
        >
          <div style={innerStyle}>{iconElement}</div>
        </div>
      );
    }

    // With level: flex column layout
    // Level bar overlaps behind icon's rounded corners via negative margin
    return (
      <div
        ref={ref}
        className={cn("flex-shrink-0 block", className)}
        style={wrapperStyle}
        {...props}
      >
        <div className="flex flex-col" style={innerStyle}>
          {/* Icon on top - elevated with z-index */}
          <div className="relative z-10">{iconElement}</div>
          {/* Level bar - overlaps behind icon's rounded corners */}
          <div
            className="flex items-end justify-center bg-[#f5f0e6] font-bold text-[#3d3d3d] leading-none select-none"
            style={{
              width: iconSize,
              height: levelConfig.height + levelConfig.cornerFill,
              marginTop: -levelConfig.cornerFill,
              paddingBottom: 1,
              fontSize: levelConfig.fontSize,
              borderBottomLeftRadius: borderRadius,
              borderBottomRightRadius: borderRadius,
            }}
          >
            {level}
          </div>
        </div>
      </div>
    );
  }
);

ItemIcon.displayName = "ItemIcon";
