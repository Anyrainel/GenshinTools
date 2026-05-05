import { beforeEach, describe, expect, it } from "vitest";
import {
  buildLogtoScopes,
  getLogtoAccountCenterSecurityUrl,
  parseScopes,
} from "@/cloud/authConfig";

describe("authConfig", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/");
  });

  it("parses comma and whitespace separated scopes", () => {
    expect(parseScopes("profile,email custom_data\nroles")).toEqual([
      "profile",
      "email",
      "custom_data",
      "roles",
    ]);
  });

  it("includes email scope by default and de-dupes configured scopes", () => {
    expect(buildLogtoScopes("profile email custom_data,email")).toEqual([
      "email",
      "profile",
      "custom_data",
    ]);
  });

  it("builds the Logto Account Center security URL with the current app URL", () => {
    window.history.pushState(null, "", "/account?show_success=email");

    expect(getLogtoAccountCenterSecurityUrl()).toBe(
      "https://synz8r.logto.app/account/security?redirect=http%3A%2F%2Flocalhost%3A3000%2Faccount%3Fshow_success%3Demail"
    );
  });
});
