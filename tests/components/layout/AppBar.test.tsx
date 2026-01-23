import { AppBar } from "@/components/layout/AppBar";
import { fireEvent, render, screen } from "@testing-library/react";
import { Home } from "lucide-react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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
  useTheme: () => ({
    theme: "default",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/config/appNavigation", () => ({
  getNavigationConfig: () => [
    { href: "/", label: "Home" },
    { href: "/other", label: "Other" },
  ],
}));

describe("AppBar", () => {
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
});
