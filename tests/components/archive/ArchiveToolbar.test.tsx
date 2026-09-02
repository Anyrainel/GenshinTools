import { describe, expect, it, vi } from "vitest";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { render, screen } from "../../utils/render";

function toolbar(searchQuery: string) {
  return (
    <ArchiveToolbar
      searchQuery={searchQuery}
      onSearchChange={vi.fn()}
      searchPlaceholder="Search items..."
    >
      <button type="button">Example filter</button>
    </ArchiveToolbar>
  );
}

describe("ArchiveToolbar filter scope", () => {
  it("disables its filter controls only for non-whitespace search", () => {
    const { rerender } = render(toolbar("   "));

    expect(
      screen.getByRole("button", { name: "Example filter" })
    ).toBeEnabled();

    rerender(toolbar(" moon "));

    expect(
      screen.getByRole("button", { name: "Example filter" })
    ).toBeDisabled();
  });
});
