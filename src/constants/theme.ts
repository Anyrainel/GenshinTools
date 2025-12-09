// TierList specific theme constants
export const TIER_COLORS = {
    S: 'bg-tier-s/70',
    A: 'bg-tier-a/70',
    B: 'bg-tier-b/70',
    C: 'bg-tier-c/70',
    D: 'bg-tier-d/70',
    Pool: 'bg-tier-pool/85',
} as const;

export const TIER_BG_COLORS = {
    S: 'bg-tier-bg-s/40',
    A: 'bg-tier-bg-a/40',
    B: 'bg-tier-bg-b/40',
    C: 'bg-tier-bg-c/40',
    D: 'bg-tier-bg-d/40',
    Pool: 'bg-tier-bg-pool/40',
} as const;

export const RARITY_COLORS = {
    1: 'bg-rarity-1',
    2: 'bg-rarity-2',
    3: 'bg-rarity-3',
    4: 'bg-rarity-4',
    5: 'bg-rarity-5',
} as const;

export const TEXT_RARITY_COLORS = {
    1: 'text-rarity-1',
    2: 'text-rarity-2',
    3: 'text-rarity-3',
    4: 'text-rarity-4',
    5: 'text-rarity-5',
} as const;

export const ELEMENT_COLORS = {
    Pyro: 'bg-element-pyro/60',
    Hydro: 'bg-element-hydro/60',
    Electro: 'bg-element-electro/60',
    Cryo: 'bg-element-cryo/60',
    Anemo: 'bg-element-anemo/60',
    Geo: 'bg-element-geo/60',
    Dendro: 'bg-element-dendro/60',
} as const;

export const LAYOUT = {
    TIER_LABEL_WIDTH: 'w-12',
    MIN_ROW_HEIGHT: 'min-h-[5rem]',
    GRID_BORDER: 'border-r border-b border-gray-600 bg-clip-padding',
    CENTER_BOX: 'flex items-center justify-center p-2',
    LABEL_TEXT: 'text-center break-words font-bold text-gray-100',
} as const;

export const COLORS = {
    DARK_BG: 'bg-gray-900',
    DARK_BG_SECONDARY: 'bg-gray-800',
    DARK_BORDER: 'border-gray-700',
    DARK_BORDER_SECONDARY: 'border-gray-600',
    TEXT_WHITE: 'text-white',
    TEXT_GRAY: 'text-gray-200',
    TEXT_GRAY_PLACEHOLDER: 'placeholder-gray-400',
} as const;

export const BUTTONS = {
    DESTRUCTIVE: 'bg-red-600 hover:bg-red-700 text-white',
    PRIMARY: 'bg-blue-600 hover:bg-blue-700 text-white',
    OUTLINE_DARK: 'border-gray-600 text-gray-200 hover:bg-gray-700',
    SECONDARY: 'bg-gray-600 hover:bg-gray-700 text-white',
} as const;