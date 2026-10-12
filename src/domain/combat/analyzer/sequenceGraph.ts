import type { AnalyzerResult, TeamInvestment } from "./types";

export type GraphNode = {
  id: string;
  jin: number;
  allocation: TeamInvestment;
  damage: number;
  damagePct: number;
  isBest: boolean;
};
type GraphEdge = {
  from: string;
  to: string;
  isBest: boolean;
};
type Row = {
  jin: number;
  nodes: GraphNode[];
};
export type EdgeLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isBest: boolean;
};
// ─── Build graph from optimizer DAG ───
export function buildGraph(result: AnalyzerResult): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const { dag, bestAtTier } = result;
  if (dag.nodes.length === 0) return { nodes: [], edges: [] };

  const baseDmg = bestAtTier.get(dag.baselineJin)?.damage ?? 1;
  const pct = (d: number) => (baseDmg > 0 ? (d / baseDmg) * 100 : 100);
  const bestIds = new Set<string>();
  for (const n of bestAtTier.values()) bestIds.add(n.id);

  const nodes = dag.nodes.map((n) => ({
    id: n.id,
    jin: n.jin,
    allocation: n.allocation,
    damage: n.damage,
    damagePct: pct(n.damage),
    isBest: bestIds.has(n.id),
  }));

  const edges = dag.edges.map((e) => ({
    from: e.fromId,
    to: e.toId,
    isBest: bestIds.has(e.fromId) && bestIds.has(e.toId),
  }));

  return { nodes, edges };
}
// ─── Row layout with barycenter crossing minimization ───
export function computeRows(nodes: GraphNode[], edges: GraphEdge[]): Row[] {
  // Group nodes by 金
  const byJin = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const list = byJin.get(n.jin) ?? [];
    list.push(n);
    byJin.set(n.jin, list);
  }

  const jins = [...byJin.keys()].sort((a, b) => a - b);
  const rows: Row[] = jins.map((jin) => ({ jin, nodes: byJin.get(jin)! }));

  if (rows.length <= 1) return rows;

  // Parent lookup: childId → parentIds
  const parentIds = new Map<string, string[]>();
  for (const e of edges) {
    const list = parentIds.get(e.to) ?? [];
    list.push(e.from);
    parentIds.set(e.to, list);
  }

  // Track each node's index within its row
  const nodeIdx = new Map<string, number>();
  for (let i = 0; i < rows[0].nodes.length; i++) {
    nodeIdx.set(rows[0].nodes[i].id, i);
  }

  // Barycenter heuristic: sort each row by average parent position in prev row
  for (let ri = 1; ri < rows.length; ri++) {
    const row = rows[ri];
    const scored = row.nodes.map((node) => {
      const pids = parentIds.get(node.id) ?? [];
      const positions = pids
        .map((pid) => nodeIdx.get(pid))
        .filter((idx): idx is number => idx !== undefined);
      const bary =
        positions.length > 0
          ? positions.reduce((a, b) => a + b, 0) / positions.length
          : Number.POSITIVE_INFINITY;
      return { node, bary };
    });

    scored.sort((a, b) => a.bary - b.bary);
    rows[ri].nodes = scored.map((s) => s.node);
    for (let i = 0; i < rows[ri].nodes.length; i++) {
      nodeIdx.set(rows[ri].nodes[i].id, i);
    }
  }

  return rows;
}
