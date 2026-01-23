import { MixedSetTooltip } from "@/components/shared/MixedSetTooltip";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      artifactHalfSet: (id: number) => `HalfSet Effect ${id}`,
      ui: (key: string) => key,
    },
  }),
}));

vi.mock("@/data/constants", () => ({
  artifactHalfSetsById: {
    101: { id: 101, setIds: ["SetA", "SetB"] },
    102: { id: 102, setIds: ["SetC"] },
  },
  artifactIdToHalfSetId: {
    SetA: 101,
    SetB: 101,
    SetC: 102,
  },
  artifactsById: {
    SetA: { id: "SetA", imagePaths: { flower: "path/to/flowerA.png" } },
    SetB: { id: "SetB", imagePaths: { flower: "path/to/flowerB.png" } },
    SetC: { id: "SetC", imagePaths: { flower: "path/to/flowerC.png" } },
  },
}));

// Mock utils
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  getAssetUrl: (path: string) => path,
}));

describe("MixedSetTooltip", () => {
  it("renders using IDs", () => {
    render(<MixedSetTooltip id1={101} id2={102} />);

    expect(screen.getByText("buildCard.2pc+2pc")).toBeInTheDocument();
    expect(screen.getByText("HalfSet Effect 101")).toBeInTheDocument();
    expect(screen.getByText("HalfSet Effect 102")).toBeInTheDocument();

    // Check for images
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(3); // SetA, SetB, SetC
  });

  it("renders using set names", () => {
    render(<MixedSetTooltip set1="SetA" set2="SetC" />);

    expect(screen.getByText("HalfSet Effect 101")).toBeInTheDocument();
    expect(screen.getByText("HalfSet Effect 102")).toBeInTheDocument();
  });

  it("renders null if IDs are invalid", () => {
    const { container } = render(<MixedSetTooltip id1={999} id2={102} />);
    expect(container).toBeEmptyDOMElement();
  });
});
