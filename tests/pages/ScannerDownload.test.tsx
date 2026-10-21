import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScannerDownload from "@/pages/ScannerDownload";

vi.mock("@/components/layout/AppBar", () => ({ AppBar: () => null }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: { ui: (key: string) => key } }),
}));

describe("Scanner download page", () => {
  it("offers the correct edition downloads and Genshin data files", () => {
    render(<ScannerDownload />);
    expect(
      screen.getByRole("link", { name: "scannerDownload.menu" })
    ).toHaveAttribute(
      "href",
      expect.stringContaining(
        "/GGScanner/releases/latest/download/GGScanner.exe"
      )
    );
    expect(
      screen.getByRole("link", { name: "scannerDownload.downloadOcr" })
    ).toHaveAttribute(
      "href",
      expect.stringContaining(
        "/GGScanner/releases/latest/download/GGScannerOCR.exe"
      )
    );
    for (const [name, path] of [
      ["gameData", "/good/genshin_scanner_data.json"],
      ["achievementData", "/good/mapping_achievements.json"],
    ]) {
      const link = screen.getByRole("link", {
        name: new RegExp(`scannerDownload\\.${name}`),
      });
      expect(link).toHaveAttribute("href", path);
      expect(link).toHaveAttribute("download");
    }
  });
});
