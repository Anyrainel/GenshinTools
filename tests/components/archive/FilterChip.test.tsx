import { FilterChip } from "@/components/archive/FilterChip";
import { fireEvent, render, screen } from "../../utils/render";

describe("FilterChip", () => {
  it("renders children", () => {
    render(
      <FilterChip active={true} onClick={() => {}}>
        Pyro
      </FilterChip>
    );
    expect(screen.getByText("Pyro")).toBeInTheDocument();
  });

  it("applies active styles when active", () => {
    render(
      <FilterChip active={true} onClick={() => {}}>
        Active
      </FilterChip>
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-card");
    expect(button.className).not.toContain("opacity-40");
  });

  it("applies inactive styles when not active", () => {
    render(
      <FilterChip active={false} onClick={() => {}}>
        Inactive
      </FilterChip>
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("opacity-40");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <FilterChip active={true} onClick={onClick}>
        Click me
      </FilterChip>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
