import { ComputeSidebar } from "@/components/artifact-filter/ComputeSidebar";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
    },
  }),
}));

describe("ComputeSidebar", () => {
  it("renders search input", async () => {
    const onSearchChange = vi.fn();
    render(
      <ComputeSidebar
        searchQuery=""
        onSearchChange={onSearchChange}
        computeOptions={{}}
        onComputeOptionChange={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(
      "computeFilters.searchPlaceholder"
    );
    await userEvent.type(input, "test");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("renders compute options", async () => {
    const onComputeOptionChange = vi.fn();
    render(
      <ComputeSidebar
        searchQuery=""
        onSearchChange={vi.fn()}
        computeOptions={{
          skipCritBuilds: false, // unchecked
          expandElementalGoblet: true, // checked
        }}
        onComputeOptionChange={onComputeOptionChange}
      />
    );

    // Verify checked state for expandElementalGoblet
    // Note: Radix Checkbox uses button[role="checkbox"][data-state="checked"/"unchecked"]
    // But finding it via label is standard.
    // We will just verify we can click "skipCritBuilds" label to trigger change.

    const skipCritLabel = screen.getByText("computeFilters.skipCritBuilds");
    await userEvent.click(skipCritLabel);

    expect(onComputeOptionChange).toHaveBeenCalledWith("skipCritBuilds", true);
  });
});
