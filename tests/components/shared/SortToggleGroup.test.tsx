import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SortToggleGroup } from "@/components/shared/SortToggleGroup";
import type { SortDirection } from "@/domain/enums";
import { render, screen, waitFor } from "../../utils/render";

const OPTIONS = [
  { value: "off", label: "No sorting" },
  { value: "asc", label: "Sort ascending" },
  { value: "desc", label: "Sort descending" },
] as const;

function SortToggleHarness({
  initialValue = "off",
  disabled = false,
  disabledTooltip,
  onChange,
}: {
  initialValue?: SortDirection;
  disabled?: boolean;
  disabledTooltip?: string;
  onChange?: (value: SortDirection) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <SortToggleGroup
      value={value}
      onChange={(nextValue) => {
        onChange?.(nextValue);
        setValue(nextValue);
      }}
      disabled={disabled}
      disabledTooltip={disabledTooltip}
    />
  );
}

function expectSelected(value: SortDirection) {
  for (const option of OPTIONS) {
    const button = screen.getByRole("radio", { name: option.label });
    const selected = option.value === value;
    expect(button).toHaveAttribute("aria-checked", String(selected));
    // The highlight reads this attribute; tooltip state must not replace it.
    expect(button).toHaveAttribute("data-state", selected ? "on" : "off");
  }
}

describe("SortToggleGroup", () => {
  beforeEach(() => {
    localStorage.setItem("app_language", "en");
  });

  it.each(OPTIONS)(
    "marks the controlled $value choice as selected",
    ({ value }) => {
      render(<SortToggleHarness initialValue={value} />);

      expectSelected(value);
    }
  );

  it("switches selection between ascending, descending, and no sorting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortToggleHarness onChange={onChange} />);

    for (const value of ["asc", "desc", "off"] as const) {
      const option = OPTIONS.find((option) => option.value === value)!;
      await user.click(screen.getByRole("radio", { name: option.label }));

      expect(onChange).toHaveBeenLastCalledWith(value);
      expectSelected(value);
    }
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("keeps a selected choice when it is clicked again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortToggleHarness initialValue="desc" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Sort descending" }));

    expect(onChange).not.toHaveBeenCalled();
    expectSelected("desc");
  });

  it("preserves selection while tooltips open on hover and keyboard focus", async () => {
    const user = userEvent.setup();
    render(<SortToggleHarness initialValue="asc" />);

    const off = screen.getByRole("radio", { name: "No sorting" });
    await user.hover(off);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("No sorting");
    expectSelected("asc");

    await user.unhover(off);
    await user.pointer({
      target: document.body,
      coords: { clientX: 500, clientY: 500 },
    });
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
    expectSelected("asc");

    await user.tab();
    expect(screen.getByRole("radio", { name: "Sort ascending" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Sort ascending"
    );
    expectSelected("asc");
  });

  it("moves keyboard focus with arrows and selects with Space", async () => {
    const user = userEvent.setup();
    render(<SortToggleHarness />);

    await user.tab();
    expect(screen.getByRole("radio", { name: "No sorting" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Sort ascending" })).toHaveFocus();
    expectSelected("off");

    await user.keyboard(" ");
    expectSelected("asc");
    await user.keyboard("{ArrowRight} ");
    expect(
      screen.getByRole("radio", { name: "Sort descending" })
    ).toHaveFocus();
    expectSelected("desc");
  });

  it("prevents disabled controls from changing the selected choice", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SortToggleHarness initialValue="asc" disabled onChange={onChange} />
    );

    for (const option of OPTIONS) {
      const button = screen.getByRole("radio", { name: option.label });
      expect(button).toBeDisabled();
      await user.click(button);
    }

    expect(onChange).not.toHaveBeenCalled();
    expectSelected("asc");
  });

  it("shows the reason a sort group is disabled", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SortToggleHarness
        disabled
        disabledTooltip="Import account data to sort by score"
      />
    );

    const hintTrigger = container.querySelector(".cursor-help");
    expect(hintTrigger).toBeInTheDocument();
    await user.hover(hintTrigger!);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Import account data to sort by score"
    );
    expectSelected("off");
  });
});
