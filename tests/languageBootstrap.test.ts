import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

describe("language before React loads", () => {
  it.each([
    ["zh", "en-US", "zh-Hans"],
    ["en", "zh-CN", "en"],
    [null, "zh-SG", "zh-Hans"],
    ["invalid", "zh-TW", "zh-Hans"],
    [null, "ja-JP", "en"],
    [null, "ko-KR", "en"],
  ])("saved %s, browser %s produces %s", (saved, browser, expected) => {
    const document = { documentElement: { lang: "en" } };
    runInNewContext(bootstrap!, {
      document,
      localStorage: { getItem: () => saved },
      navigator: { language: browser },
    });
    expect(document.documentElement.lang).toBe(expected);
  });

  it("uses the browser language when storage is blocked", () => {
    const document = { documentElement: { lang: "en" } };
    runInNewContext(bootstrap!, {
      document,
      localStorage: {
        getItem: () => {
          throw new Error("Blocked");
        },
      },
      navigator: { language: "zh-CN" },
    });
    expect(document.documentElement.lang).toBe("zh-Hans");
  });

  it("allows browser translation of the app", () => {
    expect(html).not.toMatch(/notranslate|translate="no"/);
  });
});
