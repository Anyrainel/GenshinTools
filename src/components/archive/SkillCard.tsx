import type { CharacterEffect, CharacterSkill } from "@/data/types";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

/** Strip the E./Q. prefix (and optional space) from a skill name for constellation matching */
function stripSkillPrefix(name: string): string {
  return name.replace(/^[EQ]\.\s*/, "");
}

interface SkillCardProps {
  skill: CharacterSkill;
  constellations: CharacterEffect[] | null;
}

export function SkillCard({ skill, constellations }: SkillCardProps) {
  const [expanded, setExpanded] = useState(true);

  // Lv.13 is only reachable when the 3rd or 5th constellation boosts this skill
  const showLv13 = useMemo(() => {
    if (!constellations) return false;
    const bare = stripSkillPrefix(skill.name);
    if (!bare) return false;
    return [constellations[2], constellations[4]].some((c) =>
      c?.descHtml.includes(bare)
    );
  }, [skill.name, constellations]);

  return (
    <div className="rounded-lg bg-card/50 border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors cursor-pointer"
      >
        <span className="flex-1 text-left font-semibold text-sm">
          {skill.name}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/30">
          {/* Side-by-side on wide screens: desc left, detail table right — equal halves */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div
              className="text-sm text-muted-foreground py-2 leading-relaxed skill-desc min-w-0"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Kit HTML from scraping pipeline
              dangerouslySetInnerHTML={{ __html: skill.descHtml }}
            />
            {/* Detail table — fit content, centered, scrollable */}
            {skill.details.length > 0 && (
              <div className="overflow-x-auto">
                <table className="text-sm w-auto mx-auto">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-1 pr-4 font-medium whitespace-nowrap">
                        {/* label */}
                      </th>
                      {skill.details[0]?.lv6 && (
                        <th className="text-right py-1 px-2 font-medium whitespace-nowrap">
                          Lv.6
                        </th>
                      )}
                      <th className="text-right py-1 px-2 font-medium whitespace-nowrap">
                        Lv.10
                      </th>
                      {showLv13 && (
                        <th className="text-right py-1 px-2 font-medium whitespace-nowrap">
                          Lv.13
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {skill.details.map((detail, di) => (
                      <tr
                        key={di}
                        className="border-b border-border/10 last:border-0"
                      >
                        <td className="py-1 pr-4 text-muted-foreground whitespace-nowrap">
                          {detail.label}
                        </td>
                        {detail.lv6 && (
                          <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap">
                            {detail.lv6}
                          </td>
                        )}
                        <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap">
                          {detail.lv10}
                        </td>
                        {showLv13 && (
                          <td className="py-1 px-2 text-right tabular-nums font-medium text-foreground whitespace-nowrap">
                            {detail.lv13}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
