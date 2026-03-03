import {
  ErrorBoundary,
  PageErrorBoundary,
  SectionErrorBoundary,
} from "@/components/shared/ErrorBoundary";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

// A component that throws when `shouldThrow` is true
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test explosion");
  }
  return <div>All good</div>;
}

// Suppress React's noisy error boundary console output during tests
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("shows error UI when a child throws", () => {
    render(
      <ErrorBoundary errorTitle="Oops">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByText("All good")).not.toBeInTheDocument();
    expect(screen.getByText("Oops")).toBeInTheDocument();
    expect(screen.getByText("Test explosion")).toBeInTheDocument();
  });

  it("shows default error title when none provided", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows custom default message when no error message", () => {
    // Component that throws an error without a message
    const ThrowEmpty: React.FC = () => {
      throw new Error();
    };

    render(
      <ErrorBoundary errorDefaultMsg="Fallback message">
        <ThrowEmpty />
      </ErrorBoundary>
    );

    expect(screen.getByText("Fallback message")).toBeInTheDocument();
  });

  it("shows clear button when onClearData is provided", () => {
    render(
      <ErrorBoundary onClearData={() => {}} clearLabel="Clear Account Data">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole("button", { name: /Clear Account Data/i })
    ).toBeInTheDocument();
  });

  it("shows the specific clear label, not a generic one", () => {
    render(
      <ErrorBoundary onClearData={() => {}} clearLabel="Clear Builds">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole("button", { name: /Clear Builds/i })
    ).toBeInTheDocument();
  });

  it("does not show clear button when onClearData is not provided", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // Only the home button should exist
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent(/Home/i);
  });

  it("calls onClearData when clear button is clicked", async () => {
    const user = userEvent.setup();
    const mockClear = vi.fn();

    // Mock reload since the handler calls window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary onClearData={mockClear} clearLabel="Clear Data">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole("button", { name: /Clear Data/i }));
    expect(mockClear).toHaveBeenCalledOnce();
    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("shows home button when no onClearData in full-page mode", () => {
    render(
      <ErrorBoundary homeLabel="Return to Home">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole("button", { name: /Return to Home/i })
    ).toBeInTheDocument();
  });
});

describe("ErrorBoundary section mode", () => {
  it("renders compact layout in section mode", () => {
    const { container } = render(
      <ErrorBoundary isSection errorTitle="Section Error">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Section Error")).toBeInTheDocument();
    // Section mode uses max-w-sm (compact), full page uses max-w-md
    expect(container.querySelector(".max-w-sm")).toBeInTheDocument();
  });

  it("shows home button in section mode when no onClearData", () => {
    render(
      <ErrorBoundary isSection homeLabel="Home">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: /Home/i })).toBeInTheDocument();
  });

  it("hides home button in section mode when onClearData is provided", () => {
    render(
      <ErrorBoundary isSection onClearData={() => {}} clearLabel="Clear">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // Only clear button, no home button
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent(/Clear/i);
  });
});

describe("PageErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <PageErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </PageErrorBoundary>
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("catches errors and shows localized error UI", () => {
    render(
      <PageErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </PageErrorBoundary>
    );

    // Should show the i18n error title (defaults to English "Something went wrong")
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test explosion")).toBeInTheDocument();
  });

  it("passes custom clearLabel to the error UI", () => {
    render(
      <PageErrorBoundary onClearData={() => {}} clearLabel="Clear Account Data">
        <ThrowingChild shouldThrow={true} />
      </PageErrorBoundary>
    );

    expect(
      screen.getByRole("button", { name: /Clear Account Data/i })
    ).toBeInTheDocument();
  });

  it("falls back to generic clear label when no clearLabel given", () => {
    render(
      <PageErrorBoundary onClearData={() => {}}>
        <ThrowingChild shouldThrow={true} />
      </PageErrorBoundary>
    );

    // Should use t.ui("common.clear") which is "Clear" in English
    expect(screen.getByRole("button", { name: /Clear/i })).toBeInTheDocument();
  });
});

describe("SectionErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <SectionErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </SectionErrorBoundary>
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("catches errors and shows compact error UI", () => {
    const { container } = render(
      <SectionErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </SectionErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    // Section mode uses compact styling
    expect(container.querySelector(".max-w-sm")).toBeInTheDocument();
  });
});
