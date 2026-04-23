import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ComputeSidebar } from "@/components/artifact-builds/ComputeSidebar";

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

  it("renders compute options with algorithm selector", async () => {
    const onComputeOptionChange = vi.fn();
    render(
      <ComputeSidebar
        searchQuery=""
        onSearchChange={vi.fn()}
        computeOptions={{
          mergeAlgorithm: "bruteForce",
          expandElementalGoblet: true,
        }}
        onComputeOptionChange={onComputeOptionChange}
      />
    );

    // Verify the algorithm selector label renders
    expect(
      screen.getByText("computeFilters.mergeAlgorithm")
    ).toBeInTheDocument();

    // Verify the expand elemental goblet checkbox renders
    expect(
      screen.getByText("computeFilters.expandElementalGoblet")
    ).toBeInTheDocument();
  });
});
