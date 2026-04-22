import { SkillCard } from "@/components/archive/SkillCard";
import type { CharacterSkill } from "@/data/types";
import { vi } from "vitest";
import { fireEvent, render, screen } from "../../utils/render";

// hu_tao: c3Talent "E", c5Talent "Q" — so index 0 (A) = 6 vs 10, index 1 (E) / 2 (Q) = 10 vs 13
const CHAR_ID = "hu_tao";

// Mock talent params: 15 levels, each with 2 params
const mockTalentParams = Array.from({ length: 15 }, (_, lvIdx) => [
  0.5 + lvIdx * 0.1, // param1
  0.6 + lvIdx * 0.1, // param2
]);

// Mock getCharacterStatsSync to return talent data
vi.mock("@/data/gameStatsLoader", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/data/gameStatsLoader")>();
  return {
    ...actual,
    getCharacterStatsSync: () => ({
      hu_tao: {
        rarity: 5,
        element: "Pyro",
        weaponType: "Polearm",
        region: "Liyue",
        releaseDate: "2021-03-02",
        levels: {},
        talent: {
          A: mockTalentParams,
          E: mockTalentParams,
          Q: mockTalentParams,
        },
      },
    }),
  };
});

const mockSkillE: CharacterSkill = {
  name: "E. Guide to Afterlife",
  descHtml: "<b>Hu Tao</b> consumes HP to enter Paramita Papilio state.",
  details: [
    { label: "ATK Increase", template: "{param1:F1P}" },
    { label: "Blood Blossom DMG", template: "{param2:F1P}" },
  ],
};

const mockSkillA: CharacterSkill = {
  name: "Normal Attack",
  descHtml: "Favonius Bladework.",
  details: [
    { label: "1-Hit DMG", template: "{param1:F1P}" },
    { label: "2-Hit DMG", template: "{param2:F1P}" },
  ],
};

const mockSkillQ: CharacterSkill = {
  name: "Q. Spirit Soother",
  descHtml: "Releases a spirit.",
  details: [
    { label: "Skill DMG", template: "{param1:F1P}" },
    { label: "Low HP Bonus", template: "{param2:F1P}" },
  ],
};

describe("SkillCard", () => {
  it("renders skill name", () => {
    render(<SkillCard skill={mockSkillE} characterId={CHAR_ID} />);
    expect(screen.getByText("E. Guide to Afterlife")).toBeInTheDocument();
  });

  it("renders description by default (expanded)", () => {
    const { container } = render(
      <SkillCard skill={mockSkillE} characterId={CHAR_ID} />
    );
    const descDiv = container.querySelector(".skill-desc");
    expect(descDiv).toBeInTheDocument();
    expect(descDiv?.innerHTML).toContain("Paramita Papilio");
  });

  it("shows two level columns with rendered values", () => {
    render(<SkillCard skill={mockSkillA} characterId={CHAR_ID} />);
    // Default for A (non-buffed): Lv6 vs Lv10
    expect(screen.getByText("Lv.6")).toBeInTheDocument();
    expect(screen.getByText("Lv.10")).toBeInTheDocument();
    // Lv6 (idx 5): param1 = 0.5+5*0.1 = 1.0 → F1P → "100%"
    expect(screen.getByText("100%")).toBeInTheDocument();
    // Lv10 (idx 9): param1 = 0.5+9*0.1 = 1.4 → F1P → "140%"
    expect(screen.getByText("140%")).toBeInTheDocument();
  });

  it("shows 10 vs 13 for skill buffed by C3/C5", () => {
    render(<SkillCard skill={mockSkillE} characterId={CHAR_ID} />);
    expect(screen.getByText("Lv.10")).toBeInTheDocument();
    expect(screen.getByText("Lv.13")).toBeInTheDocument();
  });

  it("shows 10 vs 13 for burst (Q) when C5 boosts it", () => {
    render(<SkillCard skill={mockSkillQ} characterId={CHAR_ID} />);
    expect(screen.getByText("Lv.10")).toBeInTheDocument();
    expect(screen.getByText("Lv.13")).toBeInTheDocument();
  });

  it("collapses and expands on click", () => {
    const { container } = render(
      <SkillCard skill={mockSkillE} characterId={CHAR_ID} />
    );

    expect(container.querySelector(".skill-desc")).toBeInTheDocument();
    fireEvent.click(screen.getByText("E. Guide to Afterlife"));
    expect(container.querySelector(".skill-desc")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("E. Guide to Afterlife"));
    expect(container.querySelector(".skill-desc")).toBeInTheDocument();
  });

  it("renders no detail table when details array is empty", () => {
    const skill: CharacterSkill = {
      name: "Normal Attack",
      descHtml: "Just attacks.",
      details: [],
    };
    render(<SkillCard skill={skill} characterId={CHAR_ID} />);
    expect(screen.queryByText("Lv.10")).not.toBeInTheDocument();
  });
});
