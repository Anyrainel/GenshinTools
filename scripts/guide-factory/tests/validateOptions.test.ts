import { describe, expect, it } from "vitest";
import { parseValidationCliArgs } from "../src/validate";

describe("parseValidationCliArgs", () => {
  it("keeps ER-dependent report regeneration enabled by default", () => {
    expect(parseValidationCliArgs([])).toEqual({ includeErReports: true });
  });

  it("explicitly defers Diona comparison and ER-calibration regeneration", () => {
    expect(parseValidationCliArgs(["--defer-er"])).toEqual({
      includeErReports: false,
    });
  });

  it("rejects unsupported arguments", () => {
    expect(() => parseValidationCliArgs(["--unknown"])).toThrow(
      "Unsupported validation argument(s): --unknown",
    );
  });
});
