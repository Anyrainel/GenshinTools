import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamCard } from "@/components/team-comp/TeamCard";
import { TeamRosterCard } from "@/components/team-comp/TeamRosterCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { weaponsById } from "@/data/gameResources";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { teamCompInputToComp } from "@/lib/team-comp/teamDeltas";
import { render } from "../../utils/render";

const pickers = vi.hoisted(
  () =>
    [] as {
      type: string;
      filter?: (item: { id: string }) => boolean;
    }[]
);

vi.mock("@/components/shared/ItemPicker", () => ({
  ItemPicker: (props: (typeof pickers)[number]) => {
    pickers.push(props);
    return null;
  },
}));

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

beforeEach(() => {
  pickers.length = 0;
});

const team = teamCompInputToComp({
  id: "readiness-team",
  name: "",
  characters: ["xingqiu", null, null, null],
  weapons: [null, null, null, null],
  artifacts: [null, null, null, null],
  reactions: [],
});

function Roster() {
  const { t } = useLanguage();
  return (
    <TeamRosterCard
      teamComp={team}
      setupConfig={{ combatOptions: {} }}
      updateTeamComp={vi.fn()}
      updateTeamSetupConfig={vi.fn()}
      accountData={null}
      characterStats={characterStatsResource.peek() ?? {}}
      weaponStats={weaponStatsResource.peek() ?? {}}
      isMobile={false}
      t={t}
    />
  );
}

describe("team picker calculator readiness", () => {
  it.each([
    "grid",
    "roster",
  ])("%s excludes unsupported entities while retaining implemented released and beta entities", (view) => {
    render(
      view === "grid" ? (
        <TeamCard teamComp={team} index={0} onUpdateComp={vi.fn()} />
      ) : (
        <Roster />
      )
    );
    const characterFilter = pickers.find(
      (picker) => picker.type === "character"
    )?.filter;
    const weaponFilter = pickers.find(
      (picker) => picker.type === "weapon"
    )?.filter;
    expect(characterFilter).toBeDefined();
    expect(weaponFilter).toBeDefined();
    for (const id of ["mitya", "valeriy", "missing_character"]) {
      expect(characterFilter?.({ id })).toBe(false);
    }
    expect(characterFilter?.({ id: "vesna" })).toBe(true);
    expect(weaponFilter?.(weaponsById.weapon_catalyst)).toBe(false);
    expect(weaponFilter?.(weaponsById.beyond_the_chrysalis)).toBe(true);
    expect(weaponFilter?.(weaponsById.prized_isshin_blade)).toBe(true);
  });
});
