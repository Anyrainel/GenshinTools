import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterComments } from "@/components/archive/CharacterComments";

const session = vi.hoisted(() => ({
  isAuthenticated: true,
  isLoading: false,
  signIn: vi.fn(async () => {}),
}));
vi.mock("@/contexts/AppSessionContext", () => ({
  useAppSession: () => session,
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en", t: { ui: (key: string) => key } }),
}));

function mount() {
  return render(
    <MemoryRouter initialEntries={["/archive/characters?character=amber"]}>
      <CharacterComments characterId="amber" />
    </MemoryRouter>
  );
}

describe("Character comment submission", () => {
  beforeEach(() => {
    session.isAuthenticated = true;
    session.signIn.mockClear();
  });
  it("preserves a failed draft, allows retry, then refreshes the feed after posting", async () => {
    let posts = 0;
    let gets = 0;
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === "POST") {
        posts++;
        return Response.json({}, { status: posts === 1 ? 503 : 201 });
      }
      gets++;
      return Response.json({
        items:
          posts > 1
            ? [{ id: "1", body: "<script>Hello</script>", createdAt: 1 }]
            : [],
        nextCursor: null,
      });
    });
    vi.stubGlobal("fetch", fetcher);
    mount();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: " <script>Hello</script> " } });
    fireEvent.click(screen.getByRole("button", { name: "community.post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "community.postFailed"
    );
    expect(input).toHaveValue(" <script>Hello</script> ");
    fireEvent.click(screen.getByRole("button", { name: "community.post" }));
    expect(
      await screen.findByText("<script>Hello</script>")
    ).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(document.querySelector("script")).toBeNull();
    await waitFor(() => expect(gets).toBe(2));
    expect(
      fetcher.mock.calls.find((call) => call[1].method === "POST")?.[1]
    ).toMatchObject({
      credentials: "same-origin",
      body: JSON.stringify({ body: "<script>Hello</script>" }),
    });
  });
  it("offers sign-in after an expired session without losing the draft", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) =>
        init.method === "POST"
          ? Response.json({}, { status: 401 })
          : Response.json({ items: [], nextCursor: null })
      )
    );
    mount();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "community.post" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "accountSystem.signIn" })
    );
    await waitFor(() =>
      expect(session.signIn).toHaveBeenCalledWith(
        "/archive/characters?character=amber"
      )
    );
    expect(screen.getByRole("textbox")).toHaveValue("Draft");
  });
});
