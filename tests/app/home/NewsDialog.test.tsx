import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewsDialog from "@/app/home/NewsDialog";
import { useGreetingStore } from "@/stores/useGreetingStore";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en", t: { ui: (key: string) => key } }),
}));

vi.mock("@/components/shared/WhatsNew", () => ({
  newsMap: {
    en: {
      entries: [
        {
          date: "2026-10-21",
          sections: [
            {
              category: "features",
              items: ["Download [GGScanner](/download-scanner)."],
            },
          ],
        },
      ],
    },
  },
  openWhatsNew: vi.fn(),
  SECTION_COLORS: {},
}));

function CurrentPath() {
  return <output>{useLocation().pathname}</output>;
}

function DialogHarness({ onDismiss }: { onDismiss: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {open && (
        <NewsDialog
          latestDate="2026-10-21"
          onDismiss={() => {
            setOpen(false);
            onDismiss();
          }}
        />
      )}
      <CurrentPath />
    </>
  );
}

beforeEach(() => {
  useGreetingStore.setState({ lastSeenUpdate: null });
});

describe("latest update dialog", () => {
  it("renders the download link, navigates, and acknowledges the update", () => {
    const onDismiss = vi.fn();
    render(
      <MemoryRouter>
        <DialogHarness onDismiss={onDismiss} />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: "GGScanner" });
    expect(link).toHaveAttribute("href", "/download-scanner");
    expect(screen.getByRole("dialog")).toHaveTextContent("Download GGScanner.");
    fireEvent.click(link);
    expect(screen.getByRole("status")).toHaveTextContent("/download-scanner");
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useGreetingStore.getState().lastSeenUpdate).toBe("2026-10-21");
  });
});
