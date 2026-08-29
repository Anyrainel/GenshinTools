import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { render, screen } from "../../utils/render";

const OPTIONS = ["pyro", "hydro", "cryo"] as const;
type Option = (typeof OPTIONS)[number];

const LABELS: Record<Option, string> = {
  pyro: "Pyro",
  hydro: "Hydro",
  cryo: "Cryo",
};

function FilterChipGroupHarness({
  initialSelected = [],
}: {
  initialSelected?: Option[];
}) {
  const [selected, setSelected] = useState<Set<Option>>(
    () => new Set(initialSelected)
  );

  return (
    <>
      <output data-testid="selected-values">
        {[...selected].sort().join(",")}
      </output>
      <FilterChipGroup
        label="Filter by element"
        options={OPTIONS}
        selectedValues={selected}
        onSelectedValuesChange={setSelected}
        getKey={(option) => option}
        getLabel={(option) => LABELS[option]}
        collapsible
      />
    </>
  );
}

describe("FilterChipGroup collapsible selections", () => {
  it("hides option chips while collapsed when there is no explicit selection", () => {
    render(<FilterChipGroupHarness />);

    expect(
      screen.getByRole("button", { name: /filter by element/i })
    ).toBeInTheDocument();
    for (const label of Object.values(LABELS)) {
      expect(
        screen.queryByRole("button", { name: label })
      ).not.toBeInTheDocument();
    }
  });

  it("keeps only explicitly selected chips visible while collapsed", () => {
    render(<FilterChipGroupHarness initialSelected={["pyro", "hydro"]} />);

    expect(screen.getByRole("button", { name: "Pyro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hydro" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cryo" })
    ).not.toBeInTheDocument();
  });

  it("clears a visible selected chip without expanding the group", async () => {
    const user = userEvent.setup();
    render(<FilterChipGroupHarness initialSelected={["pyro"]} />);

    await user.click(screen.getByRole("button", { name: "Pyro" }));

    expect(screen.getByTestId("selected-values")).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("button", { name: "Pyro" })
    ).not.toBeInTheDocument();
  });

  it("shows every option after expanding", async () => {
    const user = userEvent.setup();
    render(<FilterChipGroupHarness initialSelected={["pyro"]} />);

    await user.click(
      screen.getByRole("button", { name: /filter by element/i })
    );

    for (const label of Object.values(LABELS)) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
