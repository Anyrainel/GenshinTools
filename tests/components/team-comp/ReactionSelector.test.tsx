import { ReactionSelector } from "@/components/team-comp/ReactionSelector";
import { preloadGameStats } from "@/data/gameStatsLoader";
import "@/lib/team-comp/index";
import {
  DirectFormula,
  TransformFormula,
} from "@/lib/team-comp/calc/damageFormula";
import { TeamMeta } from "@/lib/team-comp/calc/teamMeta";
import type { FormulaEntry } from "@/lib/team-comp/types";
import type { ReactionOverride } from "@/lib/team-comp/types";
import { render, screen } from "../../utils/render";

await preloadGameStats();

// ─── Fixtures ───

const pyroSkillTag = {
  element: "Pyro" as const,
  ability: "skill" as const,
  reaction: "none" as const,
};
const electroBurstTag = {
  element: "Electro" as const,
  ability: "burst" as const,
  reaction: "none" as const,
};
const geoSkillTag = {
  element: "Geo" as const,
  ability: "skill" as const,
  reaction: "none" as const,
};
const burningTag = {
  element: "Pyro" as const,
  ability: "skill" as const,
  reaction: "burning" as const,
};

/** 3-part Pyro skill (like Diluc E) */
const pyro3Part: FormulaEntry = {
  label: { zh: "E三段", en: "E (3 hits)" },
  parts: [
    { formula: new DirectFormula(1.2, pyroSkillTag) },
    { formula: new DirectFormula(1.3, pyroSkillTag) },
    { formula: new DirectFormula(1.5, pyroSkillTag) },
  ],
};

/** Single-part Pyro skill */
const pyro1Part: FormulaEntry = {
  label: { zh: "E", en: "E" },
  parts: [{ formula: new DirectFormula(2.0, pyroSkillTag) }],
};

/** 2-part Electro burst with multi-hit (like Yae Q) */
const electro2PartMultiHit: FormulaEntry = {
  label: { zh: "Q", en: "Q" },
  parts: [
    { formula: new DirectFormula(2.6, electroBurstTag) },
    { formula: new DirectFormula(3.3, electroBurstTag), hits: 3 },
  ],
};

/** Single-part Geo skill */
const geo1Part: FormulaEntry = {
  label: { zh: "E", en: "E" },
  parts: [{ formula: new DirectFormula(2.0, geoSkillTag) }],
};

/** Transformative reaction formula (should hide selector) */
const burningFormula: FormulaEntry = {
  label: { zh: "燃烧", en: "Burning" },
  parts: [{ formula: new TransformFormula(1.0, burningTag) }],
};

// Pyro + Hydro team (vaporize available)
const vapeTeamMeta = new TeamMeta(["hu_tao", "xingqiu"]);
// Electro + Dendro team (aggravate available)
const aggravateTeamMeta = new TeamMeta(["yae_miko", "nahida"]);
// Geo team (no amplifying reactions)
const geoTeamMeta = new TeamMeta(["zhongli", "arataki_itto"]);

const noopChange = () => {};

// ─── Display/Visibility Tests ───

describe("ReactionSelector — visibility", () => {
  it("renders gate pills for Pyro character with Hydro teammate", () => {
    render(
      <ReactionSelector
        formulaEntry={pyro3Part}
        element="Pyro"
        reactionOverride={{}}
        onReactionChange={noopChange}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
      />
    );
    // Should show "None" and "Vaporize" at minimum
    expect(screen.getByRole("button", { name: /direct/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /vaporize/i })).toBeDefined();
  });

  it("hides entirely for Geo element (no eligible reactions)", () => {
    const { container } = render(
      <ReactionSelector
        formulaEntry={geo1Part}
        element="Geo"
        reactionOverride={{}}
        onReactionChange={noopChange}
        teamMeta={geoTeamMeta}
        charId="zhongli"
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("hides for transformative reaction formula", () => {
    const { container } = render(
      <ReactionSelector
        formulaEntry={burningFormula}
        element="Pyro"
        reactionOverride={{}}
        onReactionChange={noopChange}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("does NOT show per-part controls when gate is 'none'", () => {
    render(
      <ReactionSelector
        formulaEntry={pyro3Part}
        element="Pyro"
        reactionOverride={{ reaction: "none" }}
        onReactionChange={noopChange}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
      />
    );
    // Circled indices should not appear
    expect(screen.queryByText("①")).toBeNull();
  });

  it("does NOT show per-part controls for single-part formula", () => {
    render(
      <ReactionSelector
        formulaEntry={pyro1Part}
        element="Pyro"
        reactionOverride={{ reaction: "vaporize" }}
        onReactionChange={noopChange}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
      />
    );
    expect(screen.queryByText("①")).toBeNull();
  });

  it("shows per-part controls for multi-part formula with active gate", () => {
    render(
      <ReactionSelector
        formulaEntry={pyro3Part}
        element="Pyro"
        reactionOverride={{ reaction: "vaporize" }}
        onReactionChange={noopChange}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
      />
    );
    // Should show checkboxes and scaling labels for each part
    expect(screen.getByText(/120%/)).toBeDefined();
    expect(screen.getByText(/130%/)).toBeDefined();
    expect(screen.getByText(/150%/)).toBeDefined();
  });

  it("shows scaling labels for each part", () => {
    render(
      <ReactionSelector
        formulaEntry={pyro3Part}
        element="Pyro"
        reactionOverride={{ reaction: "vaporize" }}
        onReactionChange={noopChange}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
      />
    );
    // Parts have multipliers 120%, 130%, 150%
    expect(screen.getByText(/120%/)).toBeDefined();
    expect(screen.getByText(/130%/)).toBeDefined();
    expect(screen.getByText(/150%/)).toBeDefined();
  });

  it("does NOT show hit count dropdown for single-hit parts", () => {
    render(
      <ReactionSelector
        formulaEntry={pyro3Part}
        element="Pyro"
        reactionOverride={{ reaction: "vaporize" }}
        onReactionChange={noopChange}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
      />
    );
    // No "×" separator should appear (all parts are single-hit)
    expect(screen.queryByText("×")).toBeNull();
  });

  it("shows hit count dropdown for multi-hit parts", () => {
    render(
      <ReactionSelector
        formulaEntry={electro2PartMultiHit}
        element="Electro"
        reactionOverride={{ reaction: "aggravate" }}
        onReactionChange={noopChange}
        teamMeta={aggravateTeamMeta}
        charId="yae_miko"
      />
    );
    // Part 1 has 3 hits → should show "×" and a dropdown
    expect(screen.getByText("×")).toBeDefined();
  });

  it("does NOT show per-part controls in compact mode", () => {
    render(
      <ReactionSelector
        formulaEntry={pyro3Part}
        element="Pyro"
        reactionOverride={{ reaction: "vaporize" }}
        onReactionChange={noopChange}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
        compact
      />
    );
    expect(screen.queryByText("①")).toBeNull();
  });
});

// ─── Callback Tests ───

describe("ReactionSelector — callbacks", () => {
  it("gate change resets partReactions and partHits", () => {
    let captured: ReactionOverride | null = null;
    render(
      <ReactionSelector
        formulaEntry={pyro3Part}
        element="Pyro"
        reactionOverride={{
          reaction: "vaporize",
          rxnParts: { 1: "none" },
          rxnPartHits: { 0: 1 },
        }}
        onReactionChange={(o) => {
          captured = o;
        }}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
      />
    );
    // Click "None" gate pill
    screen.getByRole("button", { name: /direct/i }).click();
    expect(captured).toEqual({
      reaction: "none",
      partReactions: undefined,
      partHits: undefined,
    });
  });

  it("unchecking a part sets partReactions[idx] = 'none'", () => {
    let captured: ReactionOverride | null = null;
    render(
      <ReactionSelector
        formulaEntry={pyro3Part}
        element="Pyro"
        reactionOverride={{ reaction: "vaporize" }}
        onReactionChange={(o) => {
          captured = o;
        }}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
      />
    );
    // Find checkboxes — they are button elements with the checkbox styling
    const checkboxes = screen
      .getAllByRole("button")
      .filter((el) => el.classList.contains("w-4"));
    expect(checkboxes.length).toBe(3);
    // Click second checkbox to uncheck part 1
    checkboxes[1].click();
    expect(captured).not.toBeNull();
    expect(captured!.rxnParts).toEqual({ 1: "none" });
  });

  it("re-checking a disabled part removes it from partReactions", () => {
    let captured: ReactionOverride | null = null;
    render(
      <ReactionSelector
        formulaEntry={pyro3Part}
        element="Pyro"
        reactionOverride={{
          reaction: "vaporize",
          rxnParts: { 1: "none" },
        }}
        onReactionChange={(o) => {
          captured = o;
        }}
        teamMeta={vapeTeamMeta}
        charId="hu_tao"
      />
    );
    const checkboxes = screen
      .getAllByRole("button")
      .filter((el) => el.classList.contains("w-4"));
    // Part 1 is unchecked, click to re-check
    checkboxes[1].click();
    expect(captured).not.toBeNull();
    expect(captured!.rxnParts).toBeUndefined(); // empty → undefined
  });
});
