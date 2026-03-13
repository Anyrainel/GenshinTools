import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/data/types";
import { cn } from "@/lib/utils";
import newsEnRaw from "@/presets/updatelog/en.md?raw";
import newsZhRaw from "@/presets/updatelog/zh.md?raw";
import { Megaphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── News parser ────────────────────────────────────────────────────────

interface NewsSection {
  category: string;
  items: string[];
}

interface NewsEntry {
  date: string;
  sections: NewsSection[];
}

interface ParsedNews {
  roadmap: string[];
  entries: NewsEntry[];
}

function parseNews(raw: string): ParsedNews {
  const result: ParsedNews = { roadmap: [], entries: [] };
  let current: NewsEntry | null = null;
  let sec: NewsSection | null = null;
  let inRoadmap = false;

  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (t.startsWith("## ")) {
      // Flush previous entry
      if (current) {
        if (sec) current.sections.push(sec);
        result.entries.push(current);
      }
      const heading = t.slice(3).trim();
      if (heading === "roadmap") {
        inRoadmap = true;
        current = null;
        sec = null;
      } else {
        inRoadmap = false;
        current = { date: heading, sections: [] };
        sec = null;
      }
    } else if (t.startsWith("### ") && current) {
      if (sec) current.sections.push(sec);
      sec = { category: t.slice(4).trim(), items: [] };
    } else if (t.startsWith("- ")) {
      const item = t.slice(2);
      if (inRoadmap) {
        result.roadmap.push(item);
      } else if (sec) {
        sec.items.push(item);
      }
    }
  }
  if (current) {
    if (sec) current.sections.push(sec);
    result.entries.push(current);
  }
  return result;
}

const newsMap: Record<Language, ParsedNews> = {
  zh: parseNews(newsZhRaw),
  en: parseNews(newsEnRaw),
};

const SECTION_COLORS: Record<string, string> = {
  features: "text-emerald-400",
  fixes: "text-amber-400",
  roadmap: "text-sky-400",
};

// ── Graph types ────────────────────────────────────────────────────────

interface GNode {
  x: number;
  y: number;
  edges: GEdge[];
}
interface GEdge {
  a: GNode;
  b: GNode;
  length: number;
  /** Flag direction: 0=above 1=right 2=below 3=left */
  flagSeg: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const S = 28;
const OFF = S / 2 + 4;
const SPEED = import.meta.env.DEV ? 600 : 60;

// ── Graph builder ──────────────────────────────────────────────────────

function buildGraph(
  container: HTMLElement,
  skipEl: HTMLElement
): { nodes: GNode[]; edges: GEdge[] } {
  const W = container.offsetWidth;
  const H = container.offsetHeight;
  const cRect = container.getBoundingClientRect();

  // Collect card rects relative to container.
  // Cards must have data-wn-card to be detected — never use fragile CSS selectors.
  const cardEls = container.querySelectorAll("[data-wn-card]");
  const cards: { x: number; y: number; r: number; b: number }[] = [];
  for (const el of cardEls) {
    if (el === skipEl || el.contains(skipEl) || skipEl.contains(el)) continue;
    const rect = el.getBoundingClientRect();
    cards.push({
      x: rect.left - cRect.left,
      y: rect.top - cRect.top,
      r: rect.right - cRect.left,
      b: rect.bottom - cRect.top,
    });
  }

  // Group into rows by y
  cards.sort((a, b) => a.y - b.y);
  const rows: (typeof cards)[] = [];
  for (const c of cards) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(c.y - last[0].y) < 10) last.push(c);
    else rows.push([c]);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);

  // Horizontal gaps between rows — track Y and clearance
  const MIN_INTERIOR_GAP = S * 0.75; // allow minor overlap, pacman stays centered
  const hGaps: { y: number; wide: boolean }[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const bot = Math.max(...rows[i].map((c) => c.b));
    const top = Math.min(...rows[i + 1].map((c) => c.y));
    hGaps.push({
      y: bot + (top - bot) * 0.5,
      wide: top - bot >= MIN_INTERIOR_GAP,
    });
  }

  // Vertical gap between columns (if 2+ column rows exist)
  const multiRows = rows.filter((r) => r.length > 1);
  let vGapX: number | null = null;
  let vGapYFrom = 0;
  let vGapYTo = 0;
  if (multiRows.length > 0) {
    vGapX = (multiRows[0][0].r + multiRows[0][1].x) / 2;
    const firstIdx = rows.indexOf(multiRows[0]);
    const lastIdx = rows.indexOf(multiRows[multiRows.length - 1]);
    vGapYFrom = firstIdx > 0 ? hGaps[firstIdx - 1].y : -OFF;
    vGapYTo = lastIdx < rows.length - 1 ? hGaps[lastIdx].y : H + OFF;
  }

  // ── Build nodes & edges ──
  const nodeMap = new Map<string, GNode>();
  const allEdges: GEdge[] = [];

  const getNode = (x: number, y: number): GNode => {
    const key = `${Math.round(x * 10)},${Math.round(y * 10)}`;
    let n = nodeMap.get(key);
    if (!n) {
      n = { x, y, edges: [] };
      nodeMap.set(key, n);
    }
    return n;
  };

  const addEdge = (a: GNode, b: GNode, flagSeg: number) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) return;
    const e: GEdge = { a, b, length: len, flagSeg };
    a.edges.push(e);
    b.edges.push(e);
    allEdges.push(e);
  };

  // Outer corners
  const TL = getNode(-OFF, -OFF);
  const TR = getNode(W + OFF, -OFF);
  const BL = getNode(-OFF, H + OFF);
  const BR = getNode(W + OFF, H + OFF);

  // Outer top & bottom
  addEdge(TL, TR, 0);
  addEdge(BL, BR, 2);

  // Outer left & right — always create junction nodes at every gap Y
  // so the pacman has turn-around points along the perimeter
  let prevL = TL;
  let prevR = TR;
  for (const gap of hGaps) {
    const L = getNode(-OFF, gap.y);
    const R = getNode(W + OFF, gap.y);
    addEdge(prevL, L, 3);
    addEdge(prevR, R, 1);
    prevL = L;
    prevR = R;
  }
  addEdge(prevL, BL, 3);
  addEdge(prevR, BR, 1);

  // Horizontal gap lanes — only for wide gaps
  for (const gap of hGaps) {
    if (!gap.wide) continue;
    const L = getNode(-OFF, gap.y);
    const R = getNode(W + OFF, gap.y);
    if (vGapX != null && gap.y >= vGapYFrom && gap.y <= vGapYTo) {
      const I = getNode(vGapX, gap.y);
      addEdge(L, I, 0);
      addEdge(I, R, 0);
    } else {
      addEdge(L, R, 0);
    }
  }

  // Vertical gap lane — only through wide gaps
  if (vGapX != null) {
    const vNodes: GNode[] = [];
    for (const gap of hGaps) {
      if (!gap.wide) continue;
      if (gap.y >= vGapYFrom && gap.y <= vGapYTo) {
        vNodes.push(getNode(vGapX, gap.y));
      }
    }
    for (let i = 0; i < vNodes.length - 1; i++) {
      addEdge(vNodes[i], vNodes[i + 1], 1);
    }
  }

  return { nodes: Array.from(nodeMap.values()), edges: allEdges };
}

// ── Styles ─────────────────────────────────────────────────────────────

const STYLES = `
@keyframes wn-chomp-top {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(-22deg); }
}
@keyframes wn-chomp-bot {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(22deg); }
}

`;

// ── Component ──────────────────────────────────────────────────────────

export function WhatsNew({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const news = useMemo(() => newsMap[t.lang], [t.lang]);

  const containerRef = useRef<HTMLDivElement>(null);
  const pacRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const hFlagRef = useRef<HTMLDivElement>(null);
  const vFlagRef = useRef<HTMLDivElement>(null);

  // Navigation state (refs to avoid re-renders)
  const graphRef = useRef<{ nodes: GNode[]; edges: GEdge[] }>({
    nodes: [],
    edges: [],
  });
  const navRef = useRef<{
    edge: GEdge | null;
    progress: number; // 0→1 from a→b
    dir: 1 | -1;
  }>({ edge: null, progress: 0, dir: 1 });
  const hoveredRef = useRef(false);
  const graphVersionRef = useRef(0);

  const rebuildGraph = useCallback(() => {
    const el = containerRef.current;
    const pac = pacRef.current;
    if (!el || !pac) return;
    const g = buildGraph(el, pac);
    graphRef.current = g;
    graphVersionRef.current++;
    // Pick a random starting edge
    if (g.edges.length > 0) {
      const e = g.edges[Math.floor(Math.random() * g.edges.length)];
      navRef.current = { edge: e, progress: Math.random(), dir: 1 };
    }
  }, []);

  useEffect(() => {
    // Build graph initially (slight delay for layout)
    const initTimeout = setTimeout(rebuildGraph, 100);

    // Rebuild on resize
    const ro = new ResizeObserver(() => rebuildGraph());
    if (containerRef.current) ro.observe(containerRef.current);

    let rafId: number;
    let lastTime = 0;

    const animate = (time: number) => {
      const pac = pacRef.current;
      const body = bodyRef.current;
      const hFlag = hFlagRef.current;
      const vFlag = vFlagRef.current;
      const nav = navRef.current;

      if (!pac || !body || !hFlag || !vFlag || !nav.edge) {
        rafId = requestAnimationFrame(animate);
        lastTime = time;
        return;
      }

      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
      lastTime = time;

      const edge = nav.edge;

      // Advance position
      if (!hoveredRef.current && edge.length > 0) {
        nav.progress += (nav.dir * SPEED * dt) / edge.length;
      }

      // Reached a junction?
      if (nav.progress >= 1 || nav.progress <= 0) {
        const arrived = nav.progress >= 1 ? edge.b : edge.a;
        nav.progress = nav.progress >= 1 ? 1 : 0;

        // Pick a random outgoing edge (prefer not going back)
        const options = arrived.edges.filter((e) => e !== edge);
        const next =
          options.length > 0
            ? options[Math.floor(Math.random() * options.length)]
            : edge; // dead end → reverse

        if (next === edge) {
          // Reverse on same edge
          nav.dir = (nav.dir * -1) as 1 | -1;
        } else {
          nav.edge = next;
          const fromA = next.a === arrived;
          nav.progress = fromA ? 0 : 1;
          nav.dir = fromA ? 1 : -1;
        }
      }

      // Compute position
      const p = nav.progress;
      const cx = nav.edge.a.x + (nav.edge.b.x - nav.edge.a.x) * p;
      const cy = nav.edge.a.y + (nav.edge.b.y - nav.edge.a.y) * p;

      // Movement direction vector
      const dx = nav.dir * (nav.edge.b.x - nav.edge.a.x);
      const dy = nav.dir * (nav.edge.b.y - nav.edge.a.y);

      pac.style.left = `${cx - S / 2}px`;
      pac.style.top = `${cy - S / 2}px`;

      // Pacman facing: mouth opens in travel direction, eye stays on top.
      // Clear rotate (separate CSS property) to avoid conflict with transform.
      body.style.rotate = "";
      if (Math.abs(dx) >= Math.abs(dy)) {
        // Horizontal: right = default, left = mirror horizontally
        body.style.transform = dx >= 0 ? "" : "scaleX(-1)";
      } else {
        // Vertical: down = 90°, up = -90°
        body.style.transform = dy > 0 ? "rotate(90deg)" : "rotate(-90deg)";
      }

      // Flag — show horizontal or vertical variant, hide the other.
      const GAP = 6;
      const isH = Math.abs(dx) >= Math.abs(dy);

      hFlag.style.display = isH ? "" : "none";
      vFlag.style.display = isH ? "none" : "";

      if (isH) {
        const fx = dx >= 0 ? cx - S / 2 - GAP : cx + S / 2 + GAP;
        hFlag.style.left = `${fx}px`;
        hFlag.style.top = `${cy}px`;
        hFlag.style.transform =
          dx >= 0 ? "translateX(-100%) translateY(-50%)" : "translateY(-50%)";
      } else {
        const fy = dy > 0 ? cy - S / 2 - GAP : cy + S / 2 + GAP;
        vFlag.style.left = `${cx}px`;
        vFlag.style.top = `${fy}px`;
        vFlag.style.transform =
          dy > 0 ? "translateX(-50%) translateY(-100%)" : "translateX(-50%)";
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      clearTimeout(initTimeout);
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [rebuildGraph]);

  return (
    <>
      <style>{STYLES}</style>

      <Sheet open={open} onOpenChange={setOpen}>
        <div ref={containerRef} className="relative flex flex-col gap-8">
          {children}

          {/* Flag labels — two pre-rendered variants, one shown at a time */}
          <div
            ref={hFlagRef}
            onClick={() => setOpen(true)}
            onMouseEnter={() => {
              hoveredRef.current = true;
            }}
            onMouseLeave={() => {
              hoveredRef.current = false;
            }}
            className="absolute z-30 cursor-pointer text-[11px] font-bold text-primary-foreground bg-primary px-2 py-0.5 rounded shadow-md whitespace-nowrap"
            style={{ writingMode: "horizontal-tb" }}
          >
            {t.ui("whatsNew.title")}
          </div>
          <div
            ref={vFlagRef}
            onClick={() => setOpen(true)}
            onMouseEnter={() => {
              hoveredRef.current = true;
            }}
            onMouseLeave={() => {
              hoveredRef.current = false;
            }}
            className="absolute z-30 cursor-pointer text-[11px] font-bold text-primary-foreground bg-primary py-2 px-0.5 rounded shadow-md whitespace-nowrap tracking-[0.15em]"
            style={{ writingMode: "vertical-rl", display: "none" }}
          >
            {t.ui("whatsNew.title")}
          </div>

          {/* Pacman */}
          <button
            type="button"
            ref={pacRef}
            onClick={() => setOpen(true)}
            onMouseEnter={() => {
              hoveredRef.current = true;
            }}
            onMouseLeave={() => {
              hoveredRef.current = false;
            }}
            className="absolute z-30 cursor-pointer"
            style={{
              width: S,
              height: S,
              filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.5))",
            }}
            title={t.ui("whatsNew.title")}
          >
            {/* Rotating pacman body */}
            <div ref={bodyRef} className="w-full h-full relative">
              <div
                className="absolute left-0 right-0 top-0 h-1/2 bg-primary rounded-t-full"
                style={{
                  transformOrigin: "center bottom",
                  animation: "wn-chomp-top 0.35s ease-in-out infinite",
                }}
              />
              <div
                className="absolute left-0 right-0 bottom-0 h-1/2 bg-primary rounded-b-full"
                style={{
                  transformOrigin: "center top",
                  animation: "wn-chomp-bot 0.35s ease-in-out infinite",
                }}
              />
              <div className="absolute w-[4px] h-[4px] bg-background rounded-full top-[4px] left-[55%]" />
            </div>
          </button>
        </div>

        {/* Sheet panel */}
        <SheetContent
          side="right"
          className="w-[min(400px,85vw)] p-0 flex flex-col"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              {t.ui("whatsNew.title")}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-5 py-4 space-y-6">
              {/* Roadmap — always at the top */}
              {news.roadmap.length > 0 && (
                <article>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-border/50" />
                    <span
                      className={cn(
                        "text-xs font-semibold shrink-0",
                        SECTION_COLORS.roadmap
                      )}
                    >
                      {t.ui("whatsNew.roadmap")}
                    </span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>
                  <ul className="space-y-1">
                    {news.roadmap.map((item, i) => (
                      <li
                        key={i}
                        className="text-sm text-foreground/80 leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-muted-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              )}

              {/* Dated entries */}
              {news.entries.map((entry) => (
                <article key={entry.date}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {entry.date}
                    </span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>
                  <div className="space-y-3">
                    {entry.sections.map((section) => (
                      <div key={section.category}>
                        <h3
                          className={cn(
                            "text-sm font-semibold mb-1.5",
                            SECTION_COLORS[section.category] ??
                              "text-foreground"
                          )}
                        >
                          {section.category === "features"
                            ? t.ui("whatsNew.features")
                            : section.category === "fixes"
                              ? t.ui("whatsNew.fixes")
                              : section.category === "roadmap"
                                ? t.ui("whatsNew.roadmap")
                                : section.category}
                        </h3>
                        <ul className="space-y-1">
                          {section.items.map((item, i) => (
                            <li
                              key={i}
                              className="text-sm text-foreground/80 leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-muted-foreground"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
