import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Cloudflare combines ALL matching rules, including duplicate cache directives.
const rules: { pattern: RegExp; headers: [string, string][] }[] = [];
for (const line of readFileSync("public/_headers", "utf8").split(/\r?\n/)) {
  if (!line.trim() || line.trimStart().startsWith("#")) continue;
  if (line.startsWith("/")) {
    const escaped = line.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    rules.push({
      pattern: new RegExp(`^${escaped.replaceAll("*", ".*")}$`),
      headers: [],
    });
  } else {
    const colon = line.indexOf(":");
    rules[rules.length - 1].headers.push([
      line.slice(0, colon).trim().toLowerCase(),
      line.slice(colon + 1).trim(),
    ]);
  }
}

function headersFor(path: string, name: string): string[] {
  return rules
    .filter((rule) => rule.pattern.test(path))
    .flatMap((rule) => rule.headers)
    .filter(([key]) => key === name)
    .map(([, value]) => value);
}

describe("Static asset cache policies", () => {
  it("never combines cache policies for public files or generated bundles", () => {
    const paths = [
      "/",
      "/index.html",
      "/assets/index-example.js",
      "/assets/index-example.css",
      ...readdirSync("public", { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          `${entry.parentPath}/${entry.name}`
            .replaceAll("\\", "/")
            .replace(/^.*?public\//, "/")
        ),
    ];
    for (const path of paths) {
      for (const name of ["cache-control", "cdn-cache-control"]) {
        expect(
          headersFor(path, name).length,
          `${path}: ${name}`
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it.each([
    "/",
    "/index.html",
    "/logo-gi.svg",
    "/favicon.svg",
    "/good/genshin_scanner_data.json",
  ])("requires revalidation for %s", (path) => {
    expect(headersFor(path, "cache-control")).toEqual([
      "no-cache, must-revalidate",
    ]);
    expect(headersFor(path, "cdn-cache-control")).toEqual(["no-store"]);
  });

  it.each(["/assets/index-example.js", "/assets/index-example.css"])(
    "caches content-hashed bundles at %s for a year",
    (path) => {
      expect(headersFor(path, "cache-control")).toEqual([
        "public, max-age=31536000, immutable",
      ]);
    }
  );

  it.each([
    "/character/nahida.webp",
    "/weapon/aquila_favonia.webp",
    "/artifact/gladiators_finale.webp",
    "/assets/home/skirk.webp",
    "/assets/brands/bilibili.webp",
  ])("caches game and home images at %s for 30 days", (path) => {
    expect(headersFor(path, "cache-control")).toEqual([
      "public, max-age=2592000, stale-while-revalidate=86400",
    ]);
    expect(headersFor(path, "cdn-cache-control")).toEqual([
      "public, max-age=2592000",
    ]);
  });
});
