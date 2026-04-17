import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type {
  AnalyzerResult,
  CharInvestment,
  TeamInvestment,
} from "@/lib/team-comp/analyzer/types";
import { getAssetUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

// ─── Types ───

type GraphNode = {
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

type EdgeLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isBest: boolean;
};

// ─── Build graph from optimizer DAG ───

function buildGraph(result: AnalyzerResult): {
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

function computeRows(nodes: GraphNode[], edges: GraphEdge[]): Row[] {
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

// ─── Component ───

const NODE_GAP = 8;

interface AnalyzerSequenceProps {
  result: AnalyzerResult;
  charIds: string[];
}

export function AnalyzerSequence({ result, charIds }: AnalyzerSequenceProps) {
  const { t } = useLanguage();

  const { nodes: graphNodes, edges: graphEdges } = useMemo(
    () => buildGraph(result),
    [result]
  );
  const rows = useMemo(
    () => computeRows(graphNodes, graphEdges),
    [graphNodes, graphEdges]
  );

  // Parent lookup for diff display
  const parentMap = useMemo(() => {
    const map = new Map<string, GraphNode[]>();
    const nodeById = new Map<string, GraphNode>();
    for (const n of graphNodes) nodeById.set(n.id, n);
    for (const e of graphEdges) {
      const parent = nodeById.get(e.from);
      if (!parent) continue;
      const list = map.get(e.to) ?? [];
      list.push(parent);
      map.set(e.to, list);
    }
    return map;
  }, [graphNodes, graphEdges]);

  // Measure node positions for edges
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [edgeLines, setEdgeLines] = useState<EdgeLine[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();

    const lines: EdgeLine[] = [];
    for (const edge of graphEdges) {
      const fromEl = nodeRefs.current.get(edge.from);
      const toEl = nodeRefs.current.get(edge.to);
      if (!fromEl || !toEl) continue;
      const fR = fromEl.getBoundingClientRect();
      const tR = toEl.getBoundingClientRect();
      lines.push({
        x1: fR.left + fR.width / 2 - cRect.left,
        y1: fR.bottom - cRect.top,
        x2: tR.left + tR.width / 2 - cRect.left,
        y2: tR.top - cRect.top,
        isBest: edge.isBest,
      });
    }
    setEdgeLines(lines);
  }, [rows, graphEdges]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t.ui("teamComp.analyzerNoSteps")}
      </p>
    );
  }

  const fmtC = (n: number) => t.format("common.constellationFormat", n);
  const fmtR = (n: number) => t.format("common.refinementFormat", n);

  return (
    <div ref={containerRef} className="relative overflow-x-auto">
      {/* SVG edge overlay */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%", zIndex: 0 }}
      >
        {edgeLines.map((line, i) => (
          <line
            key={`e${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={
              line.isBest ? "rgb(217 119 6)" : "hsl(var(--muted-foreground))"
            }
            strokeWidth={1.5}
            strokeDasharray={line.isBest ? undefined : "4 2"}
          />
        ))}
      </svg>

      {/* Rows */}
      <div className="relative w-fit min-w-full" style={{ zIndex: 1 }}>
        {rows.map((row) => (
          <div
            key={row.jin}
            className="flex justify-center items-center py-1.5 w-fit min-w-full"
            style={{ gap: NODE_GAP }}
          >
            {row.nodes.map((node) => {
              const parents = parentMap.get(node.id) ?? [];
              const changedCids =
                parents.length === 0
                  ? charIds
                  : charIds.filter((cid) => {
                      const cur = node.allocation[cid];
                      if (!cur) return false;
                      return parents.some((p) => {
                        const pi = p.allocation[cid];
                        if (!pi) return true;
                        return (
                          pi.constellation !== cur.constellation ||
                          pi.is5StarWeapon !== cur.is5StarWeapon ||
                          (pi.is5StarWeapon &&
                            cur.is5StarWeapon &&
                            pi.refinement !== cur.refinement)
                        );
                      });
                    });

              const tooltip = charIds
                .filter((cid) => node.allocation[cid])
                .map((cid) => {
                  const inv = node.allocation[cid]!;
                  return `${t.character(cid)} ${fmtC(inv.constellation)}${fmtR(inv.is5StarWeapon ? inv.refinement : 0)}`;
                })
                .join("\n");

              return (
                <div
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(node.id, el);
                    else nodeRefs.current.delete(node.id);
                  }}
                  title={tooltip}
                  className={cn(
                    "flex items-center gap-1 p-1 rounded border text-xs leading-none whitespace-nowrap",
                    node.isBest
                      ? "border-amber-600 bg-card"
                      : "border-muted-foreground bg-card"
                  )}
                >
                  <span className="font-mono font-bold text-amber-400 shrink-0">
                    {node.jin}
                  </span>
                  {changedCids.map((cid) => {
                    const inv = node.allocation[cid];
                    if (!inv) return null;
                    return (
                      <CharState
                        key={cid}
                        charId={cid}
                        inv={inv}
                        fmtC={fmtC}
                        fmtR={fmtR}
                      />
                    );
                  })}
                  <span
                    className={cn(
                      "font-mono shrink-0",
                      node.isBest ? "text-emerald-400" : "text-slate-400"
                    )}
                  >
                    {node.damagePct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Per-character state chip: [icon] C2R1 ───

function CharState({
  charId,
  inv,
  fmtC,
  fmtR,
}: {
  charId: string;
  inv: CharInvestment;
  fmtC: (n: number) => string;
  fmtR: (n: number) => string;
}) {
  const char = charactersById[charId];

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {char && (
        <img
          src={getAssetUrl(char.imagePath)}
          alt={charId}
          className="w-6 h-6 rounded-full"
          style={{ imageRendering: "auto" }}
        />
      )}
      <span className="font-mono text-[11px]">
        {fmtC(inv.constellation)}
        {fmtR(inv.is5StarWeapon ? inv.refinement : 0)}
      </span>
    </div>
  );
}
