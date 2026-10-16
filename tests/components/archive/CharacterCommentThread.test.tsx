import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CharacterCommentThread } from "@/components/archive/CharacterCommentThread";
import type { CharacterComment } from "@/providers/community/community";

const session = vi.hoisted(() => ({ isAuthenticated: true, isLoading: false }));
vi.mock("@/contexts/AppSessionContext", () => ({
  useAppSession: () => session,
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en", t: { ui: (key: string) => key } }),
}));
const comment: CharacterComment = {
  id: "root",
  body: "Original",
  createdAt: 1,
  updatedAt: null,
  authorEmail: "t***r@e***e.com",
  isOwner: true,
  isDeleted: false,
  replyCount: 0,
};
beforeEach(() => {
  session.isAuthenticated = true;
});

it("preserves failed edits, saves an edit, cancels deletion and then confirms it", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetcher);
  render(
    <CharacterCommentThread
      comment={comment}
      characterId="amber"
      onSignIn={vi.fn()}
    />
  );
  expect(screen.getByText(comment.authorEmail!)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "charEdit.editMode" }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "New text" },
  });
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "community.updateFailed"
  );
  expect(screen.getByRole("textbox")).toHaveValue("New text");
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() =>
    expect(screen.getByText("New text", { selector: "p" })).toBeInTheDocument()
  );
  expect(fetcher.mock.calls[1][1]).toMatchObject({
    method: "PATCH",
    credentials: "same-origin",
    body: JSON.stringify({ body: "New text" }),
  });
  fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
  fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
  expect(fetcher).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
  fireEvent.click(
    screen.getByRole("button", { name: "community.confirmDelete" })
  );
  expect(await screen.findByText("community.deleted")).toBeInTheDocument();
  expect(screen.queryByText(comment.authorEmail!)).toBeNull();
  expect(fetcher.mock.calls[2][1].method).toBe("DELETE");
});

it("posts replies to the root and does not offer replies to a reply", async () => {
  const fetcher = vi.fn(async (_url: string, init: RequestInit) =>
    init.method === "POST"
      ? Response.json({}, { status: 201 })
      : Response.json({
          items: [
            { ...comment, id: "reply", body: "Reply text", isOwner: false },
          ],
          nextCursor: null,
        })
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <CharacterCommentThread
      comment={comment}
      characterId="amber"
      onSignIn={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "community.reply" }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Reply text" },
  });
  fireEvent.click(
    screen.getAllByRole("button", { name: "community.reply" })[1]
  );
  await waitFor(() =>
    expect(
      screen.getByText("Reply text", { selector: "p" })
    ).toBeInTheDocument()
  );
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/community/v1/characters/amber/comments/root/replies?game=GI"
  );
  expect(
    screen.getAllByRole("button", { name: "community.reply" })
  ).toHaveLength(1);
});

it("hides owner controls after sign-out and offers sign-in to reply", async () => {
  session.isAuthenticated = false;
  const signIn = vi.fn();
  render(
    <CharacterCommentThread
      comment={comment}
      characterId="amber"
      onSignIn={signIn}
    />
  );
  expect(
    screen.queryByRole("button", { name: "charEdit.editMode" })
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "common.delete" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "community.reply" }));
  await waitFor(() => expect(signIn).toHaveBeenCalledOnce());
});
