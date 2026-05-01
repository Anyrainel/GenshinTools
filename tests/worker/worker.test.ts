import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Worker API routing", () => {
  it("handles Enka CORS preflight in the Workers runtime", async () => {
    const response = await SELF.fetch("https://example.com/api/enka/uid/1", {
      method: "OPTIONS",
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "GET"
    );
  });

  it("rejects HoYoLAB requests without a region and endpoint", async () => {
    const response = await SELF.fetch("https://example.com/api/hoyolab", {
      method: "POST",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "path_too_short",
    });
  });

  it("returns JSON 404s for unknown API routes", async () => {
    const response = await SELF.fetch("https://example.com/api/missing");

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });
});
