import { AccountImportControl } from "@/components/account-data/AccountImportControl";
import type { ControlHandle } from "@/components/layout/AppBar";
import type { GOODData } from "@/lib/account-data/goodConversion";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useRef, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
    },
  }),
}));

const TestWrapper = ({
  onLocalImport = vi.fn(),
  onUidImport = vi.fn().mockResolvedValue(undefined),
}: {
  onLocalImport?: (data: GOODData) => void;
  onUidImport?: (uid: string, clear: boolean) => Promise<void>;
}) => {
  const ref = useRef<ControlHandle>(null);

  useEffect(() => {
    // Open on mount for simplicity in testing content
    ref.current?.open();
  }, []);

  return (
    <AccountImportControl
      ref={ref}
      onLocalImport={onLocalImport}
      onUidImport={onUidImport}
    />
  );
};

describe("AccountImportControl", () => {
  it("renders dialog content when opened", async () => {
    render(<TestWrapper />);
    await waitFor(() => {
      expect(screen.getByText("import.titleAccountData")).toBeInTheDocument();
    });
  });

  it("handles UID import", async () => {
    const onUidImport = vi.fn().mockResolvedValue(undefined);
    render(<TestWrapper onUidImport={onUidImport} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("import.uidPlaceholder")
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("import.uidPlaceholder");
    await userEvent.type(input, "123456789");

    const importBtn = screen.getByRole("button", { name: "import.action" });
    await userEvent.click(importBtn);

    expect(onUidImport).toHaveBeenCalledWith("123456789", false); // Default clearData is false
  });

  it("handles UID import error", async () => {
    const onUidImport = vi.fn().mockRejectedValue(new Error("Network Error"));
    render(<TestWrapper onUidImport={onUidImport} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("import.uidPlaceholder")
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("import.uidPlaceholder");
    await userEvent.type(input, "123456789");

    const importBtn = screen.getByRole("button", { name: "import.action" });
    await userEvent.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText("Network Error")).toBeInTheDocument();
    });
  });
});
