import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { RARITY_GRADIENTS } from "@/config/gameColors";

// Custom images must not be merged away as if they were background colors.
const mergeClasses = extendTailwindMerge({
  extend: {
    classGroups: { "bg-image": [{ bg: Object.keys(RARITY_GRADIENTS) }] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return mergeClasses(clsx(inputs));
}
