import { charInfo } from "@/data/charInfo";
import type { CharacterSkill, SkillLevel } from "@/data/types";
import { SKILL_LEVELS } from "@/data/types";
import { getCharacterStatsSync } from "@/lib/gameStatsLoader";
import { renderTemplate } from "@/lib/talentRenderer";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";

const TALENT_SLOTS: ("A" | "E" | "Q")[] = ["A", "E", "Q"];

function getDefaultLevels(
  characterId: string,
  skillIndex: number
): [SkillLevel, SkillLevel] {
  const info = charInfo[characterId];
  const talent = TALENT_SLOTS[skillIndex] ?? "A";
  const buffed = info && (info.c3Talent === talent || info.c5Talent === talent);
  return buffed ? ["10", "13"] : ["6", "10"];
}

interface SkillCardProps {
  skill: CharacterSkill;
  characterId: string;
  skillIndex: number;
}

export function SkillCard({ skill, characterId, skillIndex }: SkillCardProps) {
  const defaultLevels = useMemo(
    () => getDefaultLevels(characterId, skillIndex),
    [characterId, skillIndex]
  );
  const [expanded, setExpanded] = useState(true);
  const [levels, setLevels] = useState<[SkillLevel, SkillLevel]>(defaultLevels);

  const talentSlot = TALENT_SLOTS[skillIndex] ?? "A";
  const talentParams = useMemo(() => {
    const stats = getCharacterStatsSync();
    return stats?.[characterId]?.talent?.[talentSlot] ?? null;
  }, [characterId, talentSlot]);

  const setLevelAt = (index: 0 | 1, value: SkillLevel) => {
    setLevels((prev) => {
      const next: [SkillLevel, SkillLevel] = [...prev];
      next[index] = value;
      return next;
    });
  };

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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div
              className="text-sm text-muted-foreground py-2 leading-relaxed skill-desc min-w-0"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Kit HTML from scraping pipeline
              dangerouslySetInnerHTML={{ __html: skill.descHtml }}
            />
            {skill.details.length > 0 && (
              <div className="overflow-x-auto">
                <table className="text-sm w-auto">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-1 pr-4 font-medium whitespace-nowrap">
                        {/* label */}
                      </th>
                      {[0, 1].map((colIndex) => (
                        <th
                          key={colIndex}
                          className="py-1 px-2 font-medium whitespace-nowrap text-center"
                        >
                          <div className="flex justify-end">
                            <LightweightSelect
                              value={levels[colIndex]}
                              onValueChange={(v) =>
                                setLevelAt(colIndex as 0 | 1, v as SkillLevel)
                              }
                            >
                              <LightweightSelectTrigger className="h-7 min-w-[4.5rem] w-12 font-medium bg-gradient-select">
                                <LightweightSelectValue placeholder="Lv." />
                              </LightweightSelectTrigger>
                              <LightweightSelectContent>
                                {SKILL_LEVELS.map((lv) => (
                                  <LightweightSelectItem key={lv} value={lv}>
                                    Lv.{lv}
                                  </LightweightSelectItem>
                                ))}
                              </LightweightSelectContent>
                            </LightweightSelect>
                          </div>
                        </th>
                      ))}
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
                        {levels.map((lv) => (
                          <td
                            key={lv}
                            className="py-1 px-2 text-right tabular-nums whitespace-nowrap"
                          >
                            {talentParams
                              ? renderTemplate(
                                  detail.template,
                                  talentParams[Number(lv) - 1] ?? []
                                )
                              : ""}
                          </td>
                        ))}
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
