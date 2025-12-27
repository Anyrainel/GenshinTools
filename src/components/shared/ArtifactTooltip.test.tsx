import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ArtifactTooltip } from "./ArtifactTooltip";

// Mock data
vi.mock("@/data/constants", () => ({
  artifactsById: {
    crimson_witch: {
      id: "crimson_witch",
      rarity: 5,
    },
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      artifact: (id: string) => `Name: ${id}`,
      artifactEffects: (id: string) => [`Effect 1: ${id}`, `Effect 2: ${id}`],
    },
  }),
}));

describe("ArtifactTooltip", () => {
  it("renders artifact details", () => {
    render(<ArtifactTooltip setId="crimson_witch" />);

    expect(screen.getByText("Name: crimson_witch")).toBeInTheDocument();
    expect(screen.getByText("Effect 1: crimson_witch")).toBeInTheDocument();
    expect(screen.getByText("Effect 2: crimson_witch")).toBeInTheDocument();
  });

  it("hides 4-piece effect when requested", () => {
    render(<ArtifactTooltip setId="crimson_witch" hideFourPieceEffect />);

    expect(screen.getByText("Effect 1: crimson_witch")).toBeInTheDocument();
    expect(screen.queryByText("Effect 2: crimson_witch")).not.toBeInTheDocument();
  });

  it("returns null for unknown artifact", () => {
    const { container } = render(<ArtifactTooltip setId="unknown" />);
    expect(container.firstChild).toBeNull();
  });
});
