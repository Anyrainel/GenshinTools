import { beforeEach, describe, expect, it } from "vitest";
import {
  buildLogtoScopes,
  consumeLogtoReturnPath,
  getLogtoAccountCenterSecurityUrl,
  getLogtoPostSignInRedirectUri,
  normalizeLogtoReturnPath,
  parseScopes,
  rememberLogtoReturnPath,
} from "@/cloud/authConfig";

describe("authConfig", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/");
    window.sessionStorage.clear();
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
      "https://auth.ggartifact.com/account/security?redirect=http%3A%2F%2Flocalhost%3A3000%2Faccount%3Fshow_success%3Demail"
    );
  });

  it("normalizes Logto post-sign-in return paths to same-origin app routes", () => {
    expect(normalizeLogtoReturnPath("/team-comp/damage?tab=main#top")).toBe(
      "/team-comp/damage?tab=main#top"
    );
    expect(normalizeLogtoReturnPath("http://evil.example/account")).toBe("/");
    expect(normalizeLogtoReturnPath("http://[::1")).toBe("/");
    expect(normalizeLogtoReturnPath("/callback?code=abc")).toBe("/");
    expect(normalizeLogtoReturnPath("/account")).toBe("/account/cloud-backup");
    expect(getLogtoPostSignInRedirectUri("/account?show_success=email")).toBe(
      "http://localhost:3000/account/cloud-backup"
    );
  });

  it("remembers and consumes the Logto return path from session storage", () => {
    expect(rememberLogtoReturnPath("/archive/weapons")).toBe(
      "/archive/weapons"
    );
    expect(window.sessionStorage.getItem("logto:returnPath")).toBe(
      "/archive/weapons"
    );
    expect(consumeLogtoReturnPath()).toBe("/archive/weapons");
    expect(window.sessionStorage.getItem("logto:returnPath")).toBeNull();
    expect(consumeLogtoReturnPath()).toBe("/");
  });
});
