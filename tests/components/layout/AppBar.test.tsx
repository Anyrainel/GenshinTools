import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home } from "lucide-react";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppBar } from "@/components/layout/AppBar";
import { AppSessionProvider } from "@/contexts/AppSessionContext";

const signIn = vi.fn();
const signOut = vi.fn();
const getIdToken = vi.fn();
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
    getIdToken,
  }),
}));

describe("AppBar", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/");
    window.sessionStorage.clear();
    signIn.mockReset();
    signOut.mockReset();
    getIdToken.mockReset();
    getIdToken.mockResolvedValue("id-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "unauthenticated" }, { status: 401 })
      )
    );
    logtoState = {
      isAuthenticated: false,
      isLoading: false,
      error: undefined,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders navigation links", () => {
    renderAppBar(<AppBar />);

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

    renderAppBar(<AppBar actions={actions} />);

    const actionBtn = screen.getByText("Action 1");
    expect(actionBtn).toBeInTheDocument();
    fireEvent.click(actionBtn);
    expect(mockAction).toHaveBeenCalled();
  });

  it("renders one promoted page action and moves the rest into More", async () => {
    const primaryAction = vi.fn();
    const secondaryAction = vi.fn();
    const helpAction = vi.fn();
    const actions = [
      {
        key: "secondary",
        icon: Home,
        label: "Secondary",
        onTrigger: secondaryAction,
      },
      {
        key: "primary",
        icon: Home,
        label: "Primary",
        onTrigger: primaryAction,
        alwaysShow: true,
      },
      {
        key: "help",
        icon: Home,
        label: "Help",
        onTrigger: helpAction,
      },
    ];

    renderAppBar(<AppBar actions={actions} />);

    expect(screen.getByRole("button", { name: "Primary" })).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "accountSystem.accountMenu" })
    );

    expect(screen.queryByText("Secondary")).not.toBeInTheDocument();
    expect(screen.queryByText("Help")).not.toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: "common.more" }));

    expect(
      screen.getByRole("menuitem", { name: "Secondary" })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Help" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("menuitem", { name: "Secondary" }));

    expect(secondaryAction).toHaveBeenCalled();
    expect(primaryAction).not.toHaveBeenCalled();
    expect(helpAction).not.toHaveBeenCalled();
  });

  it("renders tabs on desktop", () => {
    const mockTabChange = vi.fn();
    const tabs = [
      { value: "tab1", label: "Tab 1", icon: Home },
      { value: "tab2", label: "Tab 2" },
    ];

    renderAppBar(
      <AppBar tabs={tabs} activeTab="tab1" onTabChange={mockTabChange} />
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
    renderAppBar(<AppBar />);

    await userEvent.click(
      screen.getByRole("button", { name: "accountSystem.accountMenu" })
    );

    expect(
      screen.getByRole("menuitem", { name: "accountSystem.signIn" })
    ).toBeInTheDocument();
    expect(screen.getByText("theme.switcherButton")).toBeInTheDocument();
    expect(screen.getByText("app.language")).toBeInTheDocument();
    expect(
      screen.queryByText("accountSystem.manageAccount")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("accountSystem.syncData")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("accountSystem.signOut")).not.toBeInTheDocument();

    const signInItem = screen.getByRole("menuitem", {
      name: "accountSystem.signIn",
    });
    await waitFor(() => expect(signInItem).toBeEnabled());
    await userEvent.click(signInItem);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith({
        redirectUri: "http://localhost:3000/callback",
        postRedirectUri: "http://localhost:3000/",
      });
    });
    expect(window.sessionStorage.getItem("logto:returnPath")).toBe("/");
  });

  it("can split account, theme, and language into standalone controls", async () => {
    renderAppBar(<AppBar standaloneUtilityActions />);

    const themeButton = screen.getByRole("button", {
      name: "theme.switcherButton",
    });
    const languageButton = screen.getByRole("button", {
      name: "app.language",
    });
    const accountButton = screen.getByRole("button", {
      name: "accountSystem.signIn",
    });

    expect(themeButton).toBeInTheDocument();
    expect(languageButton).toBeInTheDocument();
    expect(accountButton).toBeInTheDocument();
    expect(
      themeButton.compareDocumentPosition(languageButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      languageButton.compareDocumentPosition(accountButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await waitFor(() => expect(accountButton).toBeEnabled());
    await userEvent.click(accountButton);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith({
        redirectUri: "http://localhost:3000/callback",
        postRedirectUri: "http://localhost:3000/",
      });
    });
  });

  it("shows account management, sync, and sign-out when signed in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/auth/logout") {
          return Response.json({ ok: true });
        }
        return Response.json({
          id: "usr_1",
          displayName: "Traveler",
          email: "traveler@example.com",
          authMode: "logto",
          entitlements: ["cloud_sync"],
        });
      })
    );

    renderAppBar(<AppBar />);

    await waitFor(() => {
      expect(
        screen.getAllByText("traveler@example.com").length
      ).toBeGreaterThan(0);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "accountSystem.accountMenu" })
    );

    expect(screen.getAllByText("traveler@example.com").length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText("accountSystem.signIn")).not.toBeInTheDocument();
    expect(screen.getByText("accountSystem.manageAccount")).toBeInTheDocument();
    expect(screen.getByText("accountSystem.syncData")).toBeInTheDocument();
    expect(screen.getByText("accountSystem.signOut")).toBeInTheDocument();

    const manageLink = screen
      .getByText("accountSystem.manageAccount")
      .closest("a");
    expect(manageLink?.getAttribute("href")).toBe(
      "https://auth.ggartifact.com/account/security?redirect=http%3A%2F%2Flocalhost%3A3000%2F"
    );

    const menuItems = screen
      .getAllByRole("menuitem")
      .map((item) => item.textContent);
    expect(menuItems.indexOf("accountSystem.manageAccount")).toBeGreaterThan(
      menuItems.indexOf("accountSystem.syncData")
    );
    expect(menuItems.at(-2)).toBe("accountSystem.manageAccount");
    expect(menuItems.at(-1)).toBe("accountSystem.signOut");

    await userEvent.click(screen.getByText("accountSystem.signOut"));

    expect(signOut).toHaveBeenCalledWith("http://localhost:3000/");
  });
});

function renderAppBar(ui: ReactNode) {
  return render(
    <BrowserRouter>
      <AppSessionProvider>{ui}</AppSessionProvider>
    </BrowserRouter>
  );
}
