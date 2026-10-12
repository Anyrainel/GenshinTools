import type { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { ComboFormula, ComboLine } from "@/domain/combat/damage/types";
import type {
  ComboCountOverrides,
  InvestmentCountChange,
  InvestmentCountTarget,
  TeamInvestment,
} from "./types";

/** Defaults are differences between adjacent constellation descriptors. Only
 * thresholds strictly above the configured start are eligible. */
export function getFutureInvestmentChanges(
  team: TeamBuild,
  starts: Record<string, number>,
  custom: InvestmentCountChange[] = []
): InvestmentCountChange[] {
  const changes = new Map<string, InvestmentCountChange>();
  const put = (change: InvestmentCountChange) => {
    const key = `${change.charId}|${change.constellation}|${change.formulaId}`;
    const previous = changes.get(key);
    changes.set(key, {
      ...change,
      delta: change.delta + (previous?.delta ?? 0),
    });
  };
  for (const [charId, start] of Object.entries(starts)) {
    for (let constellation = start + 1; constellation <= 6; constellation++) {
      const before = team.catalog.resolveCombo(charId, constellation - 1) ?? {};
      const after = team.catalog.resolveCombo(charId, constellation) ?? {};
      for (const formulaId of new Set([
        ...Object.keys(before),
        ...Object.keys(after),
      ])) {
        const delta = (after[formulaId] ?? 0) - (before[formulaId] ?? 0);
        if (delta !== 0) put({ charId, constellation, formulaId, delta });
      }
    }
  }
  for (const row of team.catalog.getReactionComboGrid()) {
    for (const bonus of row.bonus) {
      if (bonus.minC > (starts[bonus.charId] ?? 0) && bonus.delta !== 0)
        put({
          charId: bonus.charId,
          constellation: bonus.minC,
          formulaId: row.baseId,
          delta: bonus.delta,
        });
    }
  }
  for (const change of custom) {
    if (change.constellation > (starts[change.charId] ?? 0))
      changes.set(
        `${change.charId}|${change.constellation}|${change.formulaId}`,
        change
      );
  }
  return [...changes.values()].sort(
    (a, b) =>
      a.charId.localeCompare(b.charId) ||
      a.constellation - b.constellation ||
      a.formulaId.localeCompare(b.formulaId)
  );
}

export function getInvestmentFormulaCount(
  combo: ComboFormula,
  charId: string,
  formulaId: string
): number {
  return combo.lines
    .filter((line) =>
      formulaId.startsWith("rx-")
        ? line.formulaId.startsWith(`${formulaId}-`)
        : line.charId === charId && line.formulaId === formulaId
    )
    .reduce((sum, line) => sum + line.count, 0);
}

/** Absolute targets are additive new data. Old delta/exact maps retain their
 * old semantics. Later default/custom changes remain relative to this anchor. */
export function deriveAbsoluteInvestmentCombo(
  allocation: TeamInvestment,
  template: ComboFormula,
  team: TeamBuild,
  starts: Record<string, number>,
  changes: InvestmentCountChange[] = [],
  exact: ComboCountOverrides = {},
  targets: InvestmentCountTarget[] = [],
  singleObjective = false,
  ignoredIds: string[] = []
): ComboFormula {
  if (singleObjective) return template;
  const original = deriveFutureInvestmentCombo(
    allocation,
    template,
    team,
    starts,
    changes,
    exact
  );
  const latest = new Map<string, InvestmentCountTarget>();
  for (const target of targets) {
    if (
      target.constellation <= (starts[target.charId] ?? 0) ||
      target.constellation > (allocation[target.charId]?.constellation ?? 0)
    )
      continue;
    const key = `${target.charId}|${target.formulaId}`;
    if ((latest.get(key)?.constellation ?? 0) <= target.constellation)
      latest.set(key, target);
  }
  const offsets = new Map<
    string,
    { charId: string; formulaId: string; offset: number }
  >();
  for (const target of latest.values()) {
    const anchoredAllocation = Object.fromEntries(
      Object.entries(allocation).map(([id, state]) => [
        id,
        {
          ...state,
          constellation:
            id === target.charId
              ? target.constellation
              : (starts[id] ?? state.constellation),
        },
      ])
    );
    const anchored = deriveFutureInvestmentCombo(
      anchoredAllocation,
      template,
      team,
      starts,
      changes,
      exact
    );
    const key = target.formulaId.startsWith("rx-")
      ? target.formulaId
      : `${target.charId}|${target.formulaId}`;
    const previous = offsets.get(key)?.offset ?? 0;
    offsets.set(key, {
      charId: target.charId,
      formulaId: target.formulaId,
      offset:
        previous +
        target.count -
        getInvestmentFormulaCount(anchored, target.charId, target.formulaId),
    });
  }
  const lines = original.lines.map((line) => ({ ...line }));
  for (const { charId, formulaId, offset } of offsets.values()) {
    const matching = lines.filter((line) =>
      formulaId.startsWith("rx-")
        ? line.formulaId.startsWith(`${formulaId}-`)
        : line.charId === charId && line.formulaId === formulaId
    );
    const total = matching.reduce((sum, line) => sum + line.count, 0);
    const wanted = Math.max(0, total + offset);
    if (total > 0)
      for (const line of matching) line.count = (line.count / total) * wanted;
    else if (wanted > 0) {
      const row = team.catalog
        .getReactionComboGrid()
        .find((row) => row.baseId === formulaId);
      const owner = row?.onFieldCharId ?? charId;
      lines.push({
        charId: owner,
        formulaId: row ? `${formulaId}-${owner}` : formulaId,
        count: wanted,
      });
    }
  }
  const ignored = new Set(ignoredIds);
  return {
    ...template,
    lines: lines.filter(
      (line) =>
        line.count > 0 &&
        !ignored.has(line.charId) &&
        !team.catalog.formulaIndex
          ?.get(line.formulaId)
          ?.parts.some(
            (part) => part.statsCharId && ignored.has(part.statsCharId)
          )
    ),
  };
}

/** Authored baseline + future deltas, never descriptor totals from C0.
 * Legacy exact direct counts take precedence at precisely their saved C.
 * Legacy rx-char counts remain exact; legacy rx-delta replaces its default bump.
 * Single skill objectives keep exactly the selected skill/reaction/count. */
export function deriveFutureInvestmentCombo(
  allocation: TeamInvestment,
  template: ComboFormula,
  team: TeamBuild,
  starts: Record<string, number>,
  custom: InvestmentCountChange[] = [],
  exact: ComboCountOverrides = {},
  singleObjective = false,
  ignoredContributorIds: string[] = []
): ComboFormula {
  if (singleObjective) return template;
  const changes = getFutureInvestmentChanges(team, starts, custom).filter(
    (change) =>
      change.constellation <=
      (allocation[change.charId]?.constellation ?? starts[change.charId] ?? 0)
  );
  const lines: ComboLine[] = template.lines.map((line) => ({ ...line }));
  const directChanges = new Map<string, InvestmentCountChange>();
  for (const change of changes.filter((c) => !c.formulaId.startsWith("rx-"))) {
    const key = `${change.charId}|${change.formulaId}`;
    directChanges.set(key, {
      ...change,
      delta: (directChanges.get(key)?.delta ?? 0) + change.delta,
    });
  }
  // Counts are authored baseline + all eligible future deltas. Clamp once:
  // an earlier negative threshold must not erase a later positive adjustment.
  for (const change of directChanges.values()) {
    const matching = lines.filter(
      (line) =>
        line.charId === change.charId && line.formulaId === change.formulaId
    );
    const total = matching.reduce((sum, line) => sum + line.count, 0);
    if (!matching.length) {
      if (change.delta > 0)
        lines.push({
          charId: change.charId,
          formulaId: change.formulaId,
          count: change.delta,
        });
    } else if (total > 0) {
      // Preserve separately authored reaction variants' proportions.
      const target = Math.max(0, total + change.delta);
      for (const line of matching) line.count = (line.count / total) * target;
    } else {
      matching[0].count = Math.max(0, change.delta);
    }
  }
  for (const row of team.catalog.getReactionComboGrid()) {
    const matching = lines.filter(
      (line) =>
        row.eligible.has(line.charId) &&
        line.formulaId === `${row.baseId}-${line.charId}`
    );
    let delta = changes
      .filter((c) => c.formulaId === row.baseId)
      .reduce((sum, c) => sum + c.delta, 0);
    for (const bonus of row.bonus) {
      const replacement = exact[`_rx-delta|${bonus.charId}|${row.baseId}`];
      if (
        replacement !== undefined &&
        bonus.minC > (starts[bonus.charId] ?? 0) &&
        bonus.minC <= (allocation[bonus.charId]?.constellation ?? 0)
      )
        delta += replacement - bonus.delta;
    }
    const total = matching.reduce((sum, line) => sum + line.count, 0);
    let onField = matching.find((line) => line.charId === row.onFieldCharId);
    if (!onField && delta > 0) {
      onField = {
        charId: row.onFieldCharId,
        formulaId: `${row.baseId}-${row.onFieldCharId}`,
        count: 0,
      };
      lines.push(onField);
      matching.push(onField);
    }
    if (onField && onField.count + delta >= 0) onField.count += delta;
    else if (total > 0)
      for (const line of matching)
        line.count *= Math.max(0, total + delta) / total;
    for (const charId of row.eligible) {
      const count = exact[`_rx-char|${charId}|${row.baseId}`];
      if (count === undefined) continue;
      const line = matching.find((l) => l.charId === charId);
      if (line) line.count = count;
      else if (count > 0)
        lines.push({ charId, formulaId: `${row.baseId}-${charId}`, count });
    }
  }
  for (const line of lines) {
    if (line.formulaId.startsWith("rx-")) continue;
    const constellation =
      allocation[line.charId]?.constellation ?? starts[line.charId] ?? 0;
    const suffix = line.reaction?.reaction
      ? `${line.formulaId}:${line.reaction.reaction}`
      : line.formulaId;
    const count = exact[`${line.charId}|${constellation}|${suffix}`];
    if (count !== undefined) line.count = count;
  }
  // Previously saved exact entries can introduce lines absent at the baseline.
  for (const [key, count] of Object.entries(exact)) {
    const [charId, c, formulaId] = key.split("|");
    if (
      charId.startsWith("_rx-") ||
      Number(c) !== allocation[charId]?.constellation ||
      !formulaId ||
      formulaId.includes(":")
    )
      continue;
    if (
      count > 0 &&
      !lines.some((l) => l.charId === charId && l.formulaId === formulaId)
    )
      lines.push({ charId, formulaId, count });
  }
  const ignored = new Set(ignoredContributorIds);
  return {
    ...template,
    lines: lines.filter(
      (line) =>
        line.count > 0 &&
        !ignored.has(line.charId) &&
        !team.catalog.formulaIndex
          ?.get(line.formulaId)
          ?.parts.some(
            (part) => part.statsCharId && ignored.has(part.statsCharId)
          )
    ),
  };
}
