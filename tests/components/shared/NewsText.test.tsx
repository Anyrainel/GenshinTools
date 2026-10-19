import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { NewsText } from "@/components/shared/NewsText";

function Location() {
  return <output>{useLocation().pathname}</output>;
}

describe("update log links", () => {
  it("navigates to the scanner page and lets the sheet close", () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <NewsText onNavigate={onNavigate}>
          {"Download [GGScanner](/download-scanner) here."}
        </NewsText>
        <Location />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("link", { name: "GGScanner" }));
    expect(screen.getByRole("status")).toHaveTextContent("/download-scanner");
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(screen.getByText(/Download/)).toHaveTextContent(
      "Download GGScanner here."
    );
  });

  it("renders multiple external links safely in their surrounding text", () => {
    render(
      <NewsText>
        {
          "See [release](https://example.com/release) or [help](http://example.com/help)."
        }
      </NewsText>
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "release" })).toHaveAttribute(
      "href",
      "https://example.com/release"
    );
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("keeps unsafe URLs, HTML, and incomplete Markdown as literal text", () => {
    const text =
      "<img src=x> [script](javascript:alert) [data](data:text/html,x) [remote](//example.com) [slash](/\\example.com) [unfinished](/download-scanner";
    const { container } = render(<NewsText>{text}</NewsText>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe(text);
  });
});
