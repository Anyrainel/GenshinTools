import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalScroll } from "@/hooks/useGlobalScroll";

function TestLayout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useGlobalScroll(containerRef, mainRef);

  return (
    <>
      <div ref={containerRef} data-testid="layout">
        <aside data-testid="sidebar">Filters</aside>
        <main ref={mainRef} data-testid="main">
          Content
        </main>
        <div data-testid="layout-gap">Gap</div>
      </div>
      <div data-testid="portaled-dialog">Dialog content</div>
    </>
  );
}

function makeScrollable(element: HTMLElement) {
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: 500,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: 100,
  });
  const scrollBy = vi.fn();
  Object.defineProperty(element, "scrollBy", {
    configurable: true,
    value: scrollBy,
  });
  return scrollBy;
}

describe("useGlobalScroll", () => {
  it("forwards wheel events from layout gaps to the main scroll area", () => {
    render(<TestLayout />);
    const scrollBy = makeScrollable(screen.getByTestId("main"));

    fireEvent.wheel(screen.getByTestId("layout-gap"), { deltaY: 48 });

    expect(scrollBy).toHaveBeenCalledWith({
      top: 48,
      behavior: "auto",
    });
  });

  it("does not forward wheel events from portaled dialog content", () => {
    render(<TestLayout />);
    const scrollBy = makeScrollable(screen.getByTestId("main"));
    const event = new WheelEvent("wheel", {
      deltaY: 64,
      bubbles: true,
      cancelable: true,
    });

    screen.getByTestId("portaled-dialog").dispatchEvent(event);

    expect(scrollBy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
