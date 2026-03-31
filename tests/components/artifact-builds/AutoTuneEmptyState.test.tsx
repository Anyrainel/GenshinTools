import { AutoTuneEmptyState } from "@/components/artifact-builds/AutoTuneEmptyState";
import { render, screen } from "../../utils/render";

describe("AutoTuneEmptyState", () => {
  it("shows link to builds page when no builds exist", () => {
    render(
      <AutoTuneEmptyState
        hasBuilds={false}
        hasTeams={true}
        onShowAll={vi.fn()}
      />
    );

    const link = screen.getByRole("link", { name: /Configure Builds/ });
    expect(link).toHaveAttribute("href", "/artifact-filter?tab=configure");

    // Should not show "Show All" button
    expect(screen.queryByText("All DPS Builds")).toBeNull();
  });

  it("shows link to teams page when no teams exist", () => {
    render(
      <AutoTuneEmptyState
        hasBuilds={true}
        hasTeams={false}
        onShowAll={vi.fn()}
      />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/team-comp?tab=damage");
  });

  it("shows both links when neither builds nor teams exist", () => {
    render(
      <AutoTuneEmptyState
        hasBuilds={false}
        hasTeams={false}
        onShowAll={vi.fn()}
      />
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/artifact-filter?tab=configure");
    expect(links[1]).toHaveAttribute("href", "/team-comp?tab=damage");
  });

  it("shows 'Show All' button when builds and teams both exist", () => {
    const onShowAll = vi.fn();
    render(
      <AutoTuneEmptyState
        hasBuilds={true}
        hasTeams={true}
        onShowAll={onShowAll}
      />
    );

    const btn = screen.getByRole("button", { name: /All DPS Builds/ });
    btn.click();
    expect(onShowAll).toHaveBeenCalledOnce();

    // Should not show navigation links
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("always shows title and description", () => {
    render(
      <AutoTuneEmptyState
        hasBuilds={false}
        hasTeams={false}
        onShowAll={vi.fn()}
      />
    );

    expect(screen.getByText("Auto Tune Substat Weights")).toBeInTheDocument();
  });
});
