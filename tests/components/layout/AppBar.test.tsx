import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home } from "lucide-react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBar } from "@/components/layout/AppBar";

const signIn = vi.fn();
const signOut = vi.fn();
const getIdTokenClaims = vi.fn();
let logtoState = {
  isAuthenticated: false,
  isLoading: false,
  error: undefined as Error | undefined,
};

// Mock dependencies
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    toggleLanguage: vi.fn(),
    t: {
      ui: (key: string) => key,
    },
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  THEME_IDS: ["default", "dark"],
  SELECTABLE_THEME_IDS: ["default", "dark"],
  useTheme: () => ({
    theme: "default",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/components/layout/appNavigation", () => ({
  getNavigationConfig: () => [
    { href: "/", label: "Home" },
    { href: "/other", label: "Other" },
  ],
}));

vi.mock("@logto/react", () => ({
  UserScope: { Email: "email" },
  useLogto: () => ({
    ...logtoState,
    signIn,
    signOut,
    getIdTokenClaims,
  }),
}));

describe("AppBar", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/");
    signIn.mockReset();
    signOut.mockReset();
    getIdTokenClaims.mockReset();
    logtoState = {
      isAuthenticated: false,
      isLoading: false,
      error: undefined,
    };
  });

  it("renders navigation links", () => {
    render(
      <BrowserRouter>
        <AppBar />
      </BrowserRouter>
    );

    // Check for logo/title
    expect(screen.getAllByAltText("Logo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("app.title").length).toBeGreaterThan(0);

    // Check desktop nav
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("renders actions", () => {
    const mockAction = vi.fn();
    const actions = [
      {
        key: "action1",
        icon: Home,
        label: "Action 1",
        onTrigger: mockAction,
        alwaysShow: true,
      },
    ];

    render(
      <BrowserRouter>
        <AppBar actions={actions} />
      </BrowserRouter>
    );

    const actionBtn = screen.getByText("Action 1");
    expect(actionBtn).toBeInTheDocument();
    fireEvent.click(actionBtn);
    expect(mockAction).toHaveBeenCalled();
  });

  it("renders tabs on desktop", () => {
    const mockTabChange = vi.fn();
    const tabs = [
      { value: "tab1", label: "Tab 1", icon: Home },
      { value: "tab2", label: "Tab 2" },
    ];

    render(
      <BrowserRouter>
        <AppBar tabs={tabs} activeTab="tab1" onTabChange={mockTabChange} />
      </BrowserRouter>
    );

    // Rendered in desktop view usually (hidden on mobile, but JSDOM default is usually wide enough or we assume visibility)
    // Note: The component uses `hidden md:block`. Window innerWidth in JSDOM defaults to 1024 often.
    // Let's verify Tab 1 is present.
    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Tab 2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Tab 2"));
    expect(mockTabChange).toHaveBeenCalledWith("tab2");
  });

  it("shows sign-in when the browser is signed out", async () => {
    render(
      <BrowserRouter>
        <AppBar />
      </BrowserRouter>
    );

    await userEvent.click(
      screen.getByRole("button", { name: "accountSystem.accountMenu" })
    );

    expect(screen.getByText("accountSystem.signIn")).toBeInTheDocument();
    expect(
      screen.queryByText("accountSystem.manageAccount")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("accountSystem.syncData")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("accountSystem.signOut")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("accountSystem.signIn"));

    expect(signIn).toHaveBeenCalledWith({
      redirectUri: "http://localhost:3000/callback",
      postRedirectUri: "http://localhost:3000/account",
    });
  });

  it("shows account management, sync, and sign-out when signed in", async () => {
    logtoState = {
      isAuthenticated: true,
      isLoading: false,
      error: undefined,
    };
    getIdTokenClaims.mockResolvedValue({
      sub: "user_1",
      name: "Traveler",
      email: "traveler@example.com",
    });

    render(
      <BrowserRouter>
        <AppBar />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(getIdTokenClaims).toHaveBeenCalled();
    });
    await userEvent.click(
      screen.getByRole("button", { name: "accountSystem.accountMenu" })
    );

    expect(screen.getByText("traveler@example.com")).toBeInTheDocument();
    expect(screen.queryByText("accountSystem.signIn")).not.toBeInTheDocument();
    expect(screen.getByText("accountSystem.manageAccount")).toBeInTheDocument();
    expect(screen.getByText("accountSystem.syncData")).toBeInTheDocument();
    expect(screen.getByText("accountSystem.signOut")).toBeInTheDocument();

    const manageLink = screen
      .getByText("accountSystem.manageAccount")
      .closest("a");
    expect(manageLink?.getAttribute("href")).toBe(
      "https://synz8r.logto.app/account/security?redirect=http%3A%2F%2Flocalhost%3A3000%2F"
    );

    const menuItems = screen
      .getAllByRole("menuitem")
      .map((item) => item.textContent);
    expect(menuItems.indexOf("accountSystem.manageAccount")).toBeLessThan(
      menuItems.indexOf("accountSystem.syncData")
    );
    expect(menuItems.at(-1)).toBe("accountSystem.signOut");

    await userEvent.click(screen.getByText("accountSystem.signOut"));

    expect(signOut).toHaveBeenCalledWith("http://localhost:3000/");
  });
});
