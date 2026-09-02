import { render, screen } from "@testing-library/react";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";

const mediaQueryState = vi.hoisted(() => ({ isDesktop: true }));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => mediaQueryState.isDesktop,
}));

vi.mock("@/hooks/useGlobalScroll", () => ({
  useGlobalScroll: () => undefined,
}));

function renderLayout(hasSelection: boolean) {
  return render(
    <SidebarDetailLayout
      header={<div data-testid="header">Header</div>}
      sidebar={<div>Sidebar</div>}
      mobileGrid={<div>Mobile grid</div>}
      hasSelection={hasSelection}
      onBack={vi.fn()}
      backLabel="Back"
    >
      <div data-testid="detail">Detail</div>
    </SidebarDetailLayout>
  );
}

describe("SidebarDetailLayout", () => {
  it("leaves room for header focus rings on desktop", () => {
    mediaQueryState.isDesktop = true;

    renderLayout(false);

    expect(screen.getByTestId("header").parentElement).toHaveClass("pt-px");
  });

  it("leaves room for header focus rings in the mobile browse view", () => {
    mediaQueryState.isDesktop = false;

    renderLayout(false);

    expect(screen.getByTestId("header").parentElement).toHaveClass("pt-px");
  });

  it("leaves room for focus rings in the mobile detail view", () => {
    mediaQueryState.isDesktop = false;

    renderLayout(true);

    expect(screen.getByTestId("detail").parentElement).toHaveClass("pt-px");
  });
});
