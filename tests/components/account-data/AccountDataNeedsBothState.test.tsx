import { AccountDataNeedsBothState } from "@/components/account-data/AccountDataNeedsBothState";
import { render, screen } from "../../utils/render";

describe("AccountDataNeedsBothState", () => {
  it("shows import button when account data is missing", () => {
    const onOpenImport = vi.fn();
    render(
      <AccountDataNeedsBothState
        needsAccountData={true}
        needsBuilds={false}
        onOpenImport={onOpenImport}
      />
    );

    const btn = screen.getByRole("button", { name: /Import Account Data/ });
    btn.click();
    expect(onOpenImport).toHaveBeenCalledOnce();

    // Should not show builds link when only account data is missing
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows builds link when only builds are missing", () => {
    render(
      <AccountDataNeedsBothState
        needsAccountData={false}
        needsBuilds={true}
        onOpenImport={vi.fn()}
      />
    );

    const link = screen.getByRole("link", { name: /Configure Builds/ });
    expect(link).toHaveAttribute("href", "/artifact-filter/configure");

    // Import button should not show
    expect(
      screen.queryByRole("button", { name: /Import Account Data/ })
    ).toBeNull();
  });

  it("shows both buttons when both are missing", () => {
    const onOpenImport = vi.fn();
    render(
      <AccountDataNeedsBothState
        needsAccountData={true}
        needsBuilds={true}
        onOpenImport={onOpenImport}
      />
    );

    // Primary: import account data
    expect(
      screen.getByRole("button", { name: /Import Account Data/ })
    ).toBeInTheDocument();

    // Secondary: builds link
    expect(
      screen.getByRole("link", { name: /Configure Builds/ })
    ).toBeInTheDocument();
  });

  it("always shows title and description", () => {
    render(
      <AccountDataNeedsBothState
        needsAccountData={true}
        needsBuilds={true}
        onOpenImport={vi.fn()}
      />
    );

    expect(
      screen.getByText("Account Data & Builds Required")
    ).toBeInTheDocument();
  });
});
