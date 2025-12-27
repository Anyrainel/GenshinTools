import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Layout } from "./Layout";

describe("Layout", () => {
  it("renders children", () => {
    render(
      <Layout>
        <div data-testid="child">Child Content</div>
      </Layout>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
