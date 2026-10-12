/** Keep existing exact-per-C storage. Editing a visible transition changes its
 * interval through the next actual value transition, not merely the next key. */
export function setInvestmentErPoint(
  overrides: Record<string, number>,
  charId: string,
  constellation: number,
  baseEr: number,
  value: number | undefined
): Record<string, number> {
  const read = (c: number) => overrides[`${charId}|${c}`] ?? baseEr;
  const oldValue = read(constellation);
  let stop = constellation + 1;
  while (stop <= 6 && read(stop) === oldValue) stop++;
  const nextValue = value ?? read(constellation - 1);
  const next = { ...overrides };
  for (let c = constellation; c < stop; c++) {
    if (nextValue === baseEr) delete next[`${charId}|${c}`];
    else next[`${charId}|${c}`] = nextValue;
  }
  return next;
}
