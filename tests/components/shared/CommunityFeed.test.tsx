import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommunityFeed } from "@/components/shared/CommunityFeed";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: { ui: (key: string) => key } }),
}));
type Post = { id: string; body: string };
const item = (post: Post) => <p>{post.body}</p>;

describe("Community feed", () => {
  it("ignores late results from the previous character and aborts that request", async () => {
    let resolveOld!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockResolvedValueOnce(
        Response.json({
          items: [{ id: "new", body: "New character" }],
          nextCursor: null,
        })
      );
    vi.stubGlobal("fetch", fetcher);
    const view = render(<CommunityFeed<Post> path="/old" renderItem={item} />);
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
    view.rerender(<CommunityFeed<Post> path="/new" renderItem={item} />);
    expect(await screen.findByText("New character")).toBeInTheDocument();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      resolveOld(
        Response.json({
          items: [{ id: "old", body: "Old character" }],
          nextCursor: null,
        })
      );
    });
    expect(screen.queryByText("Old character")).toBeNull();
  });
  it("recovers from an error and navigates forward and back using cursors", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(
        Response.json({
          items: [{ id: "1", body: "First" }],
          nextCursor: '[1,"1"]',
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          items: [{ id: "2", body: "Second" }],
          nextCursor: null,
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          items: [{ id: "1", body: "First" }],
          nextCursor: '[1,"1"]',
        })
      );
    vi.stubGlobal("fetch", fetcher);
    render(<CommunityFeed<Post> path="/feed" renderItem={item} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "community.loadFailed"
    );
    fireEvent.click(screen.getByRole("button", { name: "community.retry" }));
    await screen.findByText("First");
    fireEvent.click(screen.getByRole("button", { name: "community.next" }));
    await screen.findByText("Second");
    expect(fetcher.mock.calls[2][0]).toContain("cursor=");
    fireEvent.click(screen.getByRole("button", { name: "community.previous" }));
    await screen.findByText("First");
    expect(fetcher.mock.calls[3][0]).toBe("/feed?game=GI");
  });
});
