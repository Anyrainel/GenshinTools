import { describe, expect, it } from "vitest";
import { parseNews } from "@/components/shared/WhatsNew";

describe("parseNews", () => {
  it("omits empty dated sections", () => {
    const news = parseNews(`
## roadmap
- Later work

## 2026-05-16

### features
- Added a feature

### fixes

### notes
- Added a note

## 2026-05-15

### features

### fixes
- Fixed a bug
`);

    expect(news.roadmap).toEqual(["Later work"]);
    expect(news.entries).toEqual([
      {
        date: "2026-05-16",
        sections: [
          { category: "features", items: ["Added a feature"] },
          { category: "notes", items: ["Added a note"] },
        ],
      },
      {
        date: "2026-05-15",
        sections: [{ category: "fixes", items: ["Fixed a bug"] }],
      },
    ]);
  });
});
