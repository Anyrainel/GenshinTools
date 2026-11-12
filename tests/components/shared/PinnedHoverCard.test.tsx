import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PinnedHoverCard } from "@/components/shared/PinnedHoverCard";

function renderCard() {
  return render(
    <>
      <PinnedHoverCard content={<button type="button">Apply result</button>}>
        <button type="button">Result</button>
      </PinnedHoverCard>
      <button type="button">Outside</button>
    </>
  );
}

describe("PinnedHoverCard", () => {
  async function advance(milliseconds: number) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
    });
  }

  it("opens on hover without moving focus and closes after leaving", async () => {
    renderCard();
    const trigger = screen.getByRole("button", { name: "Result" });
    screen.getByRole("button", { name: "Outside" }).focus();

    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    await advance(200);

    expect(screen.getByRole("button", { name: "Apply result" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();

    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    await advance(300);

    expect(screen.queryByRole("button", { name: "Apply result" })).toBeNull();
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });

  it("stays open while the pointer moves from the trigger into its content", async () => {
    renderCard();
    const trigger = screen.getByRole("button", { name: "Result" });
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    await advance(200);

    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    await advance(100);
    fireEvent.pointerEnter(screen.getByRole("dialog"), {
      pointerType: "mouse",
    });
    await advance(300);
    expect(screen.getByRole("button", { name: "Apply result" })).toBeVisible();

    fireEvent.pointerLeave(screen.getByRole("dialog"), {
      pointerType: "mouse",
    });
    await advance(300);
    expect(screen.queryByRole("button", { name: "Apply result" })).toBeNull();
  });

  it("pins an already-hovered card on click and dismisses on outside click", async () => {
    const user = userEvent.setup();
    renderCard();
    const trigger = screen.getByRole("button", { name: "Result" });
    await user.hover(trigger);
    await advance(200);
    await user.click(trigger);
    await user.unhover(trigger);
    await advance(500);

    expect(screen.getByRole("button", { name: "Apply result" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("button", { name: "Apply result" })).toBeNull();

    await user.hover(trigger);
    await advance(200);
    await user.unhover(trigger);
    await advance(300);
    expect(screen.queryByRole("button", { name: "Apply result" })).toBeNull();
  });

  it("opens by keyboard and lets Escape dismiss a pinned card", async () => {
    const user = userEvent.setup();
    renderCard();
    const trigger = screen.getByRole("button", { name: "Result" });
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "Apply result" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Apply result" })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
