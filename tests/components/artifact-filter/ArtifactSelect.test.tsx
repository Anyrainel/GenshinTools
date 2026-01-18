import {
  ArtifactSelect,
  ArtifactSelectHalf,
} from "@/components/artifact-filter/ArtifactSelect";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

describe("ArtifactSelect", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("renders placeholder when no value selected", () => {
    render(
      <ArtifactSelect
        value=""
        onValueChange={mockOnChange}
        placeholder="Select Artifact"
      />
    );

    expect(screen.getByText("Select Artifact")).toBeInTheDocument();
  });

  it("shows selected artifact name when value is set", () => {
    render(
      <ArtifactSelect
        value="emblem_of_severed_fate"
        onValueChange={mockOnChange}
        placeholder="Select Artifact"
      />
    );

    // Should show the artifact name (Emblem of Severed Fate)
    expect(screen.getByText(/emblem/i)).toBeInTheDocument();
  });

  it("renders artifact icon when value is set", () => {
    const { container } = render(
      <ArtifactSelect
        value="emblem_of_severed_fate"
        onValueChange={mockOnChange}
        placeholder="Select Artifact"
      />
    );

    // Should have an image for the artifact
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
  });

  it("renders as a combobox", () => {
    render(
      <ArtifactSelect
        value=""
        onValueChange={mockOnChange}
        placeholder="Select Artifact"
      />
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});

describe("ArtifactSelectHalf", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("renders placeholder when no value selected", () => {
    render(
      <ArtifactSelectHalf
        value={undefined}
        onValueChange={mockOnChange}
        placeholder="Select 2-piece"
      />
    );

    expect(screen.getByText("Select 2-piece")).toBeInTheDocument();
  });

  it("renders combobox trigger", () => {
    render(
      <ArtifactSelectHalf
        value={undefined}
        onValueChange={mockOnChange}
        placeholder="Select 2-piece"
      />
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
