import userEvent from "@testing-library/user-event";
import { ArtifactSlotGrid } from "@/components/team-comp/ArtifactSlotGrid";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { createArtifactData } from "../../fixtures";
import { render, screen } from "../../utils/render";

function setMatchMedia(matchesFor: (query: string) => boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: matchesFor(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  setMatchMedia(() => true);
});

function TestGrid({
  onSwap,
}: {
  onSwap?: (slot: Slot, artifact: ArtifactData) => void;
}) {
  const { t } = useLanguage();
  const artifact = createArtifactData({
    id: "swap-target",
    setKey: "emblem_of_severed_fate",
    slotKey: "flower",
  });

  return (
    <ArtifactSlotGrid
      artifactsObj={{ flower: artifact }}
      t={t}
      onSwap={onSwap}
    />
  );
}

describe("ArtifactSlotGrid", () => {
  it("opens artifact details when rendered read-only", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TestGrid />);

    await user.click(screen.getByRole("img"));

    expect(screen.getByText("Artifact Details")).toBeInTheDocument();
  });

  it("only calls swap when rendered editable", async () => {
    const user = userEvent.setup({ delay: null });
    const onSwap = vi.fn();
    render(<TestGrid onSwap={onSwap} />);

    await user.click(screen.getByRole("button"));

    expect(onSwap).toHaveBeenCalledWith(
      "flower",
      expect.objectContaining({ id: "swap-target" })
    );
    expect(screen.queryByText("Artifact Details")).not.toBeInTheDocument();
  });

  it("shows artifact hover details when rendered editable on desktop", async () => {
    setMatchMedia((query) => !query.includes("max-width: 768px"));
    const user = userEvent.setup({ delay: null });
    render(<TestGrid onSwap={vi.fn()} />);

    await user.hover(screen.getByRole("button"));

    expect(
      await screen.findByText("Emblem of Severed Fate")
    ).toBeInTheDocument();
  });
});
