import { AccountImportControl } from "@/components/account-data/AccountImportControl";
import type { ControlHandle } from "@/components/layout/AppBar";
import type { GOODData } from "@/lib/account-data/goodConversion";
import type { MonaData } from "@/lib/account-data/monaConversion";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
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
  onMonaImport = vi.fn(),
  onUidImport = vi.fn().mockResolvedValue(undefined),
}: {
  onLocalImport?: (data: GOODData, uid: string) => void;
  onMonaImport?: (data: MonaData, uid: string) => void;
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
      onMonaImport={onMonaImport}
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

  it("renders all three import cards", async () => {
    render(<TestWrapper />);
    await waitFor(() => {
      // goodTitle appears twice (h3 + sr-only description), use getAllByText
      expect(screen.getAllByText("import.goodTitle").length).toBeGreaterThan(0);
      expect(screen.getByText("import.monaTitle")).toBeInTheDocument();
      expect(screen.getByText("import.uidTitle")).toBeInTheDocument();
    });
  });

  it("renders Mona card description and tool link", async () => {
    render(<TestWrapper />);
    await waitFor(() => {
      expect(screen.getByText("import.monaDescription")).toBeInTheDocument();
      expect(screen.getByText("import.monaRequiresPC")).toBeInTheDocument();
      // yas tool link
      const yasLink = screen.getByText("import.toolYas");
      expect(yasLink.closest("a")).toHaveAttribute(
        "href",
        "https://github.com/1803233552/yas"
      );
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

  describe("format validation", () => {
    function uploadFile(input: HTMLInputElement, content: string) {
      const file = new File([content], "test.json", {
        type: "application/json",
      });
      fireEvent.change(input, { target: { files: [file] } });
    }

    function getFileInputs() {
      // Two file inputs: first is GOOD card, second is Mona card
      const inputs =
        document.querySelectorAll<HTMLInputElement>('input[type="file"]');
      return { goodInput: inputs[0], monaInput: inputs[1] };
    }

    it("rejects Mona format file uploaded to GOOD import", async () => {
      const onLocalImport = vi.fn();
      render(<TestWrapper onLocalImport={onLocalImport} />);

      await waitFor(() => {
        expect(screen.getByText("import.monaTitle")).toBeInTheDocument();
      });

      const { goodInput } = getFileInputs();
      const monaContent = JSON.stringify({
        version: "1",
        flower: [],
        feather: [],
      });
      uploadFile(goodInput, monaContent);

      await waitFor(() => {
        expect(screen.getByText("import.wrongFormatMona")).toBeInTheDocument();
      });
      expect(onLocalImport).not.toHaveBeenCalled();
    });

    it("rejects GOOD format file uploaded to Mona import", async () => {
      const onMonaImport = vi.fn();
      render(<TestWrapper onMonaImport={onMonaImport} />);

      await waitFor(() => {
        expect(screen.getByText("import.monaTitle")).toBeInTheDocument();
      });

      const { monaInput } = getFileInputs();
      const goodContent = JSON.stringify({
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [],
        artifacts: [],
      });
      uploadFile(monaInput, goodContent);

      await waitFor(() => {
        expect(screen.getByText("import.wrongFormatGOOD")).toBeInTheDocument();
      });
      expect(onMonaImport).not.toHaveBeenCalled();
    });

    it("allows GOOD format file in GOOD import", async () => {
      const onLocalImport = vi.fn();
      render(<TestWrapper onLocalImport={onLocalImport} />);

      await waitFor(() => {
        expect(screen.getByText("import.monaTitle")).toBeInTheDocument();
      });

      const { goodInput } = getFileInputs();
      const goodContent = JSON.stringify({
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [],
      });
      uploadFile(goodInput, goodContent);

      await waitFor(() => {
        expect(onLocalImport).toHaveBeenCalled();
      });
    });

    it("allows Mona format file in Mona import", async () => {
      const onMonaImport = vi.fn();
      render(<TestWrapper onMonaImport={onMonaImport} />);

      await waitFor(() => {
        expect(screen.getByText("import.monaTitle")).toBeInTheDocument();
      });

      const { monaInput } = getFileInputs();
      const monaContent = JSON.stringify({
        version: "1",
        flower: [
          {
            setName: "Test",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 1 },
            normalTags: [],
            omit: false,
            level: 0,
            star: 5,
            equip: null,
          },
        ],
      });
      uploadFile(monaInput, monaContent);

      await waitFor(() => {
        expect(onMonaImport).toHaveBeenCalled();
      });
    });
  });
});
