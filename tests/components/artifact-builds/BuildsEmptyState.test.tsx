import { BuildsEmptyState } from "@/components/artifact-builds/BuildsEmptyState";
import { render, screen } from "../../utils/render";

describe("BuildsEmptyState", () => {
  it("renders title and description", () => {
    render(<BuildsEmptyState />);

    expect(screen.getByText("Artifact Build Presets")).toBeInTheDocument();
  });

  it("shows import button when onOpenImport is provided", () => {
    const onOpenImport = vi.fn();
    render(<BuildsEmptyState onOpenImport={onOpenImport} />);

    const btn = screen.getByRole("button", { name: /Browse Presets/ });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(onOpenImport).toHaveBeenCalledOnce();
  });

  it("hides import button when onOpenImport is not provided", () => {
    render(<BuildsEmptyState />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
