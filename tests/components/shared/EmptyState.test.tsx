import { Download, ExternalLink, Scale } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { render, screen } from "../../utils/render";

describe("EmptyState", () => {
  it("renders icon, title, and description", () => {
    render(
      <EmptyState
        icon={Scale}
        title="No Data"
        description="Import some data to get started."
      />
    );

    expect(screen.getByText("No Data")).toBeInTheDocument();
    expect(
      screen.getByText("Import some data to get started.")
    ).toBeInTheDocument();
  });

  it("renders without description", () => {
    render(<EmptyState icon={Scale} title="Empty" />);

    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  it("renders a primary action button with onClick", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Scale}
        title="Empty"
        action={{ label: "Import", icon: Download, onClick }}
      />
    );

    const btn = screen.getByRole("button", { name: /Import/ });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders a primary action as a link when href is provided", () => {
    render(
      <EmptyState
        icon={Scale}
        title="Empty"
        action={{
          label: "Go to Builds",
          icon: ExternalLink,
          href: "/artifact-filter",
        }}
      />
    );

    const link = screen.getByRole("link", { name: /Go to Builds/ });
    expect(link).toHaveAttribute("href", "/artifact-filter");
  });

  it("renders both primary and secondary actions", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Scale}
        title="Empty"
        action={{ label: "Primary", onClick }}
        secondaryAction={{ label: "Secondary", href: "/other" }}
      />
    );

    expect(screen.getByRole("button", { name: /Primary/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Secondary/ })).toBeInTheDocument();
  });

  it("renders children below the standard layout", () => {
    render(
      <EmptyState icon={Scale} title="Empty">
        <p data-testid="custom">Custom content</p>
      </EmptyState>
    );

    expect(screen.getByTestId("custom")).toBeInTheDocument();
    expect(screen.getByText("Custom content")).toBeInTheDocument();
  });

  it("applies custom icon and glow colors", () => {
    const { container } = render(
      <EmptyState
        icon={Scale}
        iconColor="text-cyan-500"
        glowColor="bg-cyan-500/20"
        title="Frozen"
      />
    );

    // Check the glow div has custom color
    const glowDiv = container.querySelector(".bg-cyan-500\\/20");
    expect(glowDiv).toBeInTheDocument();

    // Check the icon has custom color
    const iconSvg = container.querySelector(".text-cyan-500");
    expect(iconSvg).toBeInTheDocument();
  });

  it("omits CTA section when no actions provided", () => {
    render(<EmptyState icon={Scale} title="Empty" />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
