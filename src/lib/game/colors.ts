import { ELEMENT_HEX } from "@/config/gameColors";
import type { Element } from "@/domain/enums";

/** Actual color values for canvas/charts; DOM callers use the class helpers. */
export function getElementHex(element: string): string | undefined {
  return Object.hasOwn(ELEMENT_HEX, element)
    ? ELEMENT_HEX[element as Element]
    : undefined;
}
