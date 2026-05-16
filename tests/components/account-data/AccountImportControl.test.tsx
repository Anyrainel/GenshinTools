import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { AccountImportControl } from "@/components/account-data/AccountImportControl";
import type { ControlHandle } from "@/components/shared/controlHandle";
import type { GOODData } from "@/lib/account-data/import/goodConversion";

// Mock dependencies
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
      format: (key: string, ...args: unknown[]) =>
        args.length ? `${key}(${args.join(",")})` : key,
    },
  }),
}));

const TestWrapper = ({
  onLocalImport = vi.fn(),
  onUidImport = vi.fn().mockResolvedValue(undefined),
}: {
  onLocalImport?: (data: GOODData, uid: string) => void;
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
      onHoyolabImport={async () => {}}
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

  it("renders GOOD and UID import cards", async () => {
    render(<TestWrapper />);
    await waitFor(() => {
      // goodTitle appears twice (h3 + sr-only description), use getAllByText
      expect(screen.getAllByText("import.goodTitle").length).toBeGreaterThan(0);
      expect(screen.getByText("import.uidTitle")).toBeInTheDocument();
    });
  });

  it("renders GOODScanner tool link", async () => {
    render(<TestWrapper />);
    await waitFor(() => {
      const link = screen.getByText("import.toolGoodScanner");
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "https://github.com/Anyrainel/GOODScanner/releases"
      );
    });
  });

  it("renders GOODCapture tool link instead of Irminsul", async () => {
    render(<TestWrapper />);
    await waitFor(() => {
      const link = screen.getByText("import.toolGoodCapture");
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "https://github.com/Anyrainel/GOODScanner/releases"
      );
      expect(screen.queryByText("import.toolIrminsul")).not.toBeInTheDocument();
      expect(screen.queryByText("irminsul.exe")).not.toBeInTheDocument();
    });
  });

  it("handles UID import", async () => {
    const onUidImport = vi.fn().mockResolvedValue(undefined);
    render(<TestWrapper onUidImport={onUidImport} />);

    await waitFor(() => {
      expect(
        screen.getAllByPlaceholderText("import.uidPlaceholder").length
      ).toBeGreaterThan(0);
    });

    // First UID input belongs to the Enka/GOOD card; second belongs to hoyolab.
    const input = screen.getAllByPlaceholderText("import.uidPlaceholder")[0];
    await userEvent.type(input, "123456789");

    const importBtn = screen.getAllByRole("button", {
      name: "import.action",
    })[0];
    await userEvent.click(importBtn);

    expect(onUidImport).toHaveBeenCalledWith("123456789", false); // Default clearData is false
  });

  it("handles UID import error", async () => {
    const onUidImport = vi.fn().mockRejectedValue(new Error("Network Error"));
    render(<TestWrapper onUidImport={onUidImport} />);

    await waitFor(() => {
      expect(
        screen.getAllByPlaceholderText("import.uidPlaceholder").length
      ).toBeGreaterThan(0);
    });

    // First UID input belongs to the Enka/GOOD card; second belongs to hoyolab.
    const input = screen.getAllByPlaceholderText("import.uidPlaceholder")[0];
    await userEvent.type(input, "123456789");

    const importBtn = screen.getAllByRole("button", {
      name: "import.action",
    })[0];
    await userEvent.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText("Network Error")).toBeInTheDocument();
    });
  });

  describe("format validation", () => {
    function uploadFile(input: HTMLInputElement, content: string) {
      const file = new File([content], "test.json", {
        type: "application/json",
      });
      fireEvent.change(input, { target: { files: [file] } });
    }

    function getFileInput() {
      return document.querySelector<HTMLInputElement>('input[type="file"]')!;
    }

    it("rejects non-GOOD format file", async () => {
      const onLocalImport = vi.fn();
      render(<TestWrapper onLocalImport={onLocalImport} />);

      await waitFor(() => {
        expect(screen.getAllByText("import.goodTitle").length).toBeGreaterThan(
          0
        );
      });

      const input = getFileInput();
      const badContent = JSON.stringify({
        version: "1",
        flower: [],
        feather: [],
      });
      uploadFile(input, badContent);

      await waitFor(() => {
        expect(screen.getByText("import.wrongFormat")).toBeInTheDocument();
      });
      expect(onLocalImport).not.toHaveBeenCalled();
    });

    it("allows GOOD format file", async () => {
      const onLocalImport = vi.fn();
      render(<TestWrapper onLocalImport={onLocalImport} />);

      await waitFor(() => {
        expect(screen.getAllByText("import.goodTitle").length).toBeGreaterThan(
          0
        );
      });

      const input = getFileInput();
      const goodContent = JSON.stringify({
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [],
      });
      uploadFile(input, goodContent);

      await waitFor(() => {
        expect(onLocalImport).toHaveBeenCalled();
      });
    });
  });
});
