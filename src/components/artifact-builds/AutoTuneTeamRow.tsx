import { ItemIcon } from "@/components/shared/ItemIcon";
import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import type { AccountData, Rarity } from "@/data/types";
import type { Team } from "@/stores/useTeamStore";
import { buildTeamLabel } from "./AutoTuneDialog";

interface AutoTuneTeamRowProps {
  team: Team;
  characterId: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  accountData: AccountData | null;
}

export function AutoTuneTeamRow({
  team,
  characterId,
  enabled,
  onToggle,
  accountData,
}: AutoTuneTeamRowProps) {
  const { t } = useLanguage();

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is a controlled component inside the label
    <label className="flex items-start gap-2 px-1.5 py-1.5 rounded border border-border/30 hover:bg-muted/20 cursor-pointer w-fit">
      <Checkbox
        checked={enabled}
        onCheckedChange={(checked) => onToggle(!!checked)}
        className="mt-0.5 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium mb-1 truncate text-muted-foreground">
          {team.name || buildTeamLabel(team, t)}
        </div>
        {/* 4×3 grid: row 1 = characters, row 2 = weapons, row 3 = artifacts */}
        <div className="grid grid-cols-4 gap-x-1.5 gap-y-1 justify-items-center">
          {[0, 1, 2, 3].map((idx) => {
            const charId = team.characters[idx];
            const charRes = charId ? charactersById[charId] : null;
            const isTarget = charId === characterId;
            const constellation = charId
              ? resolveConstellation(charId, team, accountData)
              : undefined;
            return (
              <div
                key={`c${idx}`}
                className={isTarget ? "ring-1 ring-primary/50 rounded" : ""}
              >
                {charRes ? (
                  <ItemIcon
                    imagePath={charRes.imagePath}
                    rarity={charRes.rarity}
                    size="sm"
                    characterId={charId!}
                    badge={constellation}
                  />
                ) : (
                  <div className="w-[48px] h-[48px] rounded bg-muted/40 border border-dashed border-border/30" />
                )}
              </div>
            );
          })}
          {[0, 1, 2, 3].map((idx) => {
            const charId = team.characters[idx];
            const weaponId = team.weapons[idx];
            const wpnRes = weaponId ? weaponsById[weaponId] : null;
            const refinement =
              weaponId && charId
                ? resolveRefinement(charId, weaponId, team, accountData)
                : undefined;
            return (
              <div key={`w${idx}`} className="flex justify-center">
                {wpnRes ? (
                  <ItemIcon
                    imagePath={wpnRes.imagePath}
                    rarity={wpnRes.rarity}
                    size="xs"
                    badge={refinement}
                  />
                ) : (
                  <div className="w-[40px] h-[40px] rounded bg-muted/40 border border-dashed border-border/30" />
                )}
              </div>
            );
          })}
          {[0, 1, 2, 3].map((idx) => {
            const art = resolveArtifact(team.artifacts[idx]);
            return (
              <div key={`a${idx}`} className="flex justify-center">
                {art ? (
                  <ItemIcon
                    imagePath={art.imagePath}
                    rarity={art.rarity as Rarity}
                    size="xs"
                  />
                ) : (
                  <div className="w-[40px] h-[40px] rounded bg-muted/40 border border-dashed border-border/30" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </label>
  );
}

/** Resolve constellation using the same logic as buildTeamConfigs */
function resolveConstellation(
  charId: string,
  team: Team,
  accountData: AccountData | null
): number {
  if (team.opts?.[`${charId}.overrideConstellation`] !== undefined) {
    return Number(team.opts[`${charId}.overrideConstellation`]);
  }
  const acctChar = accountData?.characters.find((c) => c.key === charId);
  return acctChar ? acctChar.constellation : 0;
}

/** Resolve refinement using the same logic as buildTeamConfigs */
function resolveRefinement(
  charId: string,
  weaponId: string,
  team: Team,
  accountData: AccountData | null
): number {
  if (team.opts?.[`${charId}.overrideRefinement`] !== undefined) {
    return Number(team.opts[`${charId}.overrideRefinement`]);
  }
  if (accountData) {
    const refinements: number[] = [];
    for (const c of accountData.characters) {
      if (c.weapon?.key === weaponId) refinements.push(c.weapon.refinement);
    }
    for (const w of accountData.extraWeapons) {
      if (w.key === weaponId) refinements.push(w.refinement);
    }
    if (refinements.length > 0) return Math.max(...refinements);
  }
  return 1;
}

function resolveArtifact(
  config: ArtifactConfig | null
): { imagePath: string; rarity: number } | null {
  if (!config) return null;
  if (config.type === "4pc") {
    const art = artifactsById[config.setId];
    if (art?.imagePaths?.flower)
      return { imagePath: art.imagePaths.flower, rarity: art.rarity };
  }
  if (config.type === "2pc+2pc") {
    const halfSet = artifactHalfSetsById[String(config.id1)];
    if (halfSet?.setIds?.[0]) {
      const art = artifactsById[halfSet.setIds[0]];
      if (art?.imagePaths?.flower)
        return { imagePath: art.imagePaths.flower, rarity: art.rarity };
    }
  }
  return null;
}
