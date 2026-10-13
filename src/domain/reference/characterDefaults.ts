export function defaultCharacterConstellation(
  charId: string,
  accountConstellation?: number
): number {
  return accountConstellation ?? (charId.startsWith("traveler_") ? 6 : 0);
}
