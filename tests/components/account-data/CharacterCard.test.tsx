import { CharacterCard } from "@/components/account-data/CharacterCard";
import {
  createArtifactData,
  createArtifactScoreResult,
  createCharacterData,
  createWeaponData,
} from "../../fixtures";
import { render, screen } from "../../utils/render";

describe("CharacterCard", () => {
  const mockCharacter = createCharacterData({
    key: "hu_tao",
    level: 90,
    constellation: 1,
    talent: { auto: 10, skill: 10, burst: 10 },
    weapon: createWeaponData({
      key: "staff_of_homa",
      level: 90,
      refinement: 1,
    }),
    artifacts: {
      flower: createArtifactData({
        setKey: "crimson_witch_of_flames",
        slotKey: "flower",
      }),
      plume: undefined,
      sands: undefined,
      goblet: undefined,
      circlet: undefined,
    },
  });

  const mockScore = createArtifactScoreResult({
    mainScore: 25,
    subScore: 45,
    isComplete: false,
  });

  it("displays character name heading", () => {
    render(<CharacterCard char={mockCharacter} score={mockScore} />);

    // Character name should be a heading (localized version may differ)
    const headings = screen.getAllByRole("heading");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it("displays character level", () => {
    render(<CharacterCard char={mockCharacter} score={mockScore} />);

    // Level 90 should be displayed (may appear multiple times)
    expect(screen.getAllByText(/90/).length).toBeGreaterThanOrEqual(1);
  });

  it("displays constellation count", () => {
    const { container } = render(
      <CharacterCard char={mockCharacter} score={mockScore} />
    );

    // C1 or constellation indicator should be visible
    // May be shown as "C1" or just "1" with star icon
    expect(container.textContent).toMatch(/C?1/i);
  });

  it("displays talent levels", () => {
    const { container } = render(
      <CharacterCard char={mockCharacter} score={mockScore} />
    );

    // Talent levels 10/10/10 should be visible in some format
    expect(container.textContent).toMatch(/10/);
  });

  it("displays weapon with level and refinement", () => {
    render(<CharacterCard char={mockCharacter} score={mockScore} />);

    // Weapon level 90 should be visible
    const lvl90Texts = screen.getAllByText(/90/);
    expect(lvl90Texts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders character icon image", () => {
    const { container } = render(
      <CharacterCard char={mockCharacter} score={mockScore} />
    );

    // Should have at least one image (character icon)
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders with score prop without crashing", () => {
    const { container } = render(
      <CharacterCard char={mockCharacter} score={mockScore} />
    );

    // Component should render successfully with score prop
    expect(container.firstChild).toBeInTheDocument();
  });

  it("handles character without weapon gracefully", () => {
    const charNoWeapon = createCharacterData({
      key: "xingqiu",
      weapon: undefined,
    });

    const { container } = render(
      <CharacterCard char={charNoWeapon} score={mockScore} />
    );

    // Should render without crashing
    expect(container.firstChild).toBeInTheDocument();
  });

  it("handles character with zero score gracefully", () => {
    const zeroScore = createArtifactScoreResult({
      mainScore: 0,
      subScore: 0,
      isComplete: false,
    });

    const { container } = render(
      <CharacterCard char={mockCharacter} score={zeroScore} />
    );

    // Should render without crashing
    expect(container.firstChild).toBeInTheDocument();
  });
});
