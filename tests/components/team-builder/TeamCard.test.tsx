import { TeamCard } from "@/components/team-builder/TeamCard";
import type { Team } from "@/stores/useTeamStore";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

const mockTeam: Team = {
  id: "team-1",
  name: "Hu Tao Vape",
  characters: ["hu_tao", "xingqiu", "zhongli", null],
  weapons: [null, null, null, null],
  artifacts: [null, null, null, null],
};

describe("TeamCard", () => {
  const mockOnUpdate = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnCopy = vi.fn();

  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockOnDelete.mockClear();
    mockOnCopy.mockClear();
  });

  it("displays team name in input field", () => {
    render(
      <TeamCard
        team={mockTeam}
        index={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onCopy={mockOnCopy}
      />
    );

    const input = screen.getByDisplayValue("Hu Tao Vape");
    expect(input).toBeInTheDocument();
  });

  it("calls onUpdate when team name is changed", async () => {
    const user = userEvent.setup();
    render(
      <TeamCard
        team={mockTeam}
        index={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onCopy={mockOnCopy}
      />
    );

    const input = screen.getByDisplayValue("Hu Tao Vape");
    await user.clear(input);
    await user.type(input, "New Team Name");

    // Should call onUpdate with name field
    expect(mockOnUpdate).toHaveBeenCalled();
    const lastCall =
      mockOnUpdate.mock.calls[mockOnUpdate.mock.calls.length - 1][0];
    expect(lastCall.name).toBeDefined();
  });

  it("renders element icons only for non-null characters", () => {
    const { container } = render(
      <TeamCard
        team={mockTeam}
        index={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onCopy={mockOnCopy}
      />
    );

    // 3 characters with elements (hu_tao, xingqiu, zhongli), 1 is null
    // Should have element images for the 3 existing characters
    const elementImgs = container.querySelectorAll("img[alt]");
    expect(elementImgs.length).toBeGreaterThanOrEqual(3);
  });

  it("renders empty placeholder for null character slots", () => {
    const emptyTeam: Team = {
      id: "team-2",
      name: "Empty",
      characters: [null, null, null, null],
      weapons: [null, null, null, null],
      artifacts: [null, null, null, null],
    };

    const { container } = render(
      <TeamCard
        team={emptyTeam}
        index={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onCopy={mockOnCopy}
      />
    );

    // Empty character slots should still render placeholders (rounded divs)
    const placeholders = container.querySelectorAll(".rounded-full");
    expect(placeholders.length).toBeGreaterThan(0);
  });
});
