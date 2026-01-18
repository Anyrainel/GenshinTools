import { ToolHeader } from "@/components/shared/ToolHeader";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

describe("ToolHeader", () => {
  it("renders home link", () => {
    render(<ToolHeader />);

    const homeLink = screen.getByRole("link", { name: /home|genshin/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renders navigation links for all tools", () => {
    render(<ToolHeader />);

    // Check main navigation links are present
    const links = screen.getAllByRole("link");
    // Should have links for: Home, Artifact Filter, Account Data, Tier List, Weapon Tier List, Team Builder
    expect(links.length).toBeGreaterThanOrEqual(5);
  });

  it("renders actions when provided", () => {
    render(
      <ToolHeader
        actions={
          <button type="button" data-testid="custom-action">
            Custom Action
          </button>
        }
      />
    );

    expect(screen.getByTestId("custom-action")).toBeInTheDocument();
  });

  it("renders theme switcher button", () => {
    render(<ToolHeader />);

    // Find theme button (has palette icon or "Theme" text)
    const themeButton = screen.getByRole("button", { name: /theme/i });
    expect(themeButton).toBeInTheDocument();
  });

  it("renders language toggle button", () => {
    render(<ToolHeader />);

    // Language button shows "中文" or "EN"
    const langButton = screen.getByRole("button", { name: /中文|en/i });
    expect(langButton).toBeInTheDocument();
  });

  it("opens theme dropdown when theme button is clicked", async () => {
    const user = userEvent.setup();
    render(<ToolHeader />);

    const themeButton = screen.getByRole("button", { name: /theme/i });
    await user.click(themeButton);

    // Should show theme options
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ToolHeader className="custom-header-class" />
    );

    const header = container.querySelector("header");
    expect(header).toHaveClass("custom-header-class");
  });
});
