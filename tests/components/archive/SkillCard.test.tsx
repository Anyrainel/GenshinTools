import { SkillCard } from "@/components/archive/SkillCard";
import type { CharacterEffect, CharacterSkill } from "@/data/types";
import { fireEvent, render, screen } from "../../utils/render";

const makeConstellations = (...descs: string[]): CharacterEffect[] =>
  descs.map((d, i) => ({
    name: `C${i + 1}`,
    descHtml: d,
  }));

const mockSkill: CharacterSkill = {
  name: "E. Guide to Afterlife",
  descHtml: "<b>Hu Tao</b> consumes HP to enter Paramita Papilio state.",
  details: [
    { label: "ATK Increase", lv6: "80%", lv10: "100%", lv13: "115%" },
    { label: "Blood Blossom DMG", lv6: "100%", lv10: "130%", lv13: "150%" },
  ],
};

const mockSkillNoLv6: CharacterSkill = {
  name: "Q. Spirit Soother",
  descHtml: "Releases a spirit.",
  details: [
    { label: "Skill DMG", lv6: "", lv10: "500%", lv13: "600%" },
    { label: "Low HP Bonus", lv6: "", lv10: "700%", lv13: "800%" },
  ],
};

describe("SkillCard", () => {
  it("renders skill name", () => {
    render(<SkillCard skill={mockSkill} constellations={null} />);
    expect(screen.getByText("E. Guide to Afterlife")).toBeInTheDocument();
  });

  it("renders description by default (expanded)", () => {
    const { container } = render(
      <SkillCard skill={mockSkill} constellations={null} />
    );
    const descDiv = container.querySelector(".skill-desc");
    expect(descDiv).toBeInTheDocument();
    expect(descDiv?.innerHTML).toContain("Paramita Papilio");
  });

  it("renders detail table with Lv.6 and Lv.10 columns", () => {
    render(<SkillCard skill={mockSkill} constellations={null} />);
    expect(screen.getByText("Lv.6")).toBeInTheDocument();
    expect(screen.getByText("Lv.10")).toBeInTheDocument();
    expect(screen.getByText("ATK Increase")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("Blood Blossom DMG")).toBeInTheDocument();
  });

  it("hides Lv.13 column when no constellations boost this skill", () => {
    render(<SkillCard skill={mockSkill} constellations={null} />);
    expect(screen.queryByText("Lv.13")).not.toBeInTheDocument();
  });

  it("shows Lv.13 column when C3 boosts this skill", () => {
    // C3 (index 2) references the skill name (without prefix)
    const constellations = makeConstellations(
      "C1 desc",
      "C2 desc",
      "Increases Guide to Afterlife by 3 levels",
      "C4 desc",
      "C5 desc",
      "C6 desc"
    );
    render(<SkillCard skill={mockSkill} constellations={constellations} />);
    expect(screen.getByText("Lv.13")).toBeInTheDocument();
    expect(screen.getByText("115%")).toBeInTheDocument();
  });

  it("shows Lv.13 column when C5 boosts this skill", () => {
    // C5 (index 4) references the skill name
    const constellations = makeConstellations(
      "C1 desc",
      "C2 desc",
      "C3 desc",
      "C4 desc",
      "Increases Guide to Afterlife by 3 levels",
      "C6 desc"
    );
    render(<SkillCard skill={mockSkill} constellations={constellations} />);
    expect(screen.getByText("Lv.13")).toBeInTheDocument();
  });

  it("hides Lv.6 column when skill details have no lv6 data", () => {
    render(<SkillCard skill={mockSkillNoLv6} constellations={null} />);
    expect(screen.queryByText("Lv.6")).not.toBeInTheDocument();
    expect(screen.getByText("Lv.10")).toBeInTheDocument();
  });

  it("collapses and expands on click", () => {
    const { container } = render(
      <SkillCard skill={mockSkill} constellations={null} />
    );

    // Initially expanded
    expect(container.querySelector(".skill-desc")).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText("E. Guide to Afterlife"));
    expect(container.querySelector(".skill-desc")).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(screen.getByText("E. Guide to Afterlife"));
    expect(container.querySelector(".skill-desc")).toBeInTheDocument();
  });

  it("renders no detail table when details array is empty", () => {
    const skill: CharacterSkill = {
      name: "Normal Attack",
      descHtml: "Just attacks.",
      details: [],
    };
    render(<SkillCard skill={skill} constellations={null} />);
    expect(screen.queryByText("Lv.10")).not.toBeInTheDocument();
  });
});
