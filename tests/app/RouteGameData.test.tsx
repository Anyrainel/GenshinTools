import "@/providers/reference/statLoaders";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteGameData } from "@/app/RouteGameData";
import { LanguageProvider } from "@/contexts/LanguageContext";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import {
  artifactTextResource,
  weaponTextResource,
} from "@/providers/reference/gameDataLoader";

describe("route reference loading", () => {
  it.each(["/", "/archive/achievements", "/archive/bosses", "/feedback"])(
    "does not request unrelated reference data on %s",
    (pathname) => {
      const spies = [
        characterStatsResource,
        weaponStatsResource,
        weaponTextResource,
        artifactTextResource,
      ].map((resource) => vi.spyOn(resource, "preload"));
      const view = render(
        <LanguageProvider>
          <RouteGameData pathname={pathname}>Page</RouteGameData>
        </LanguageProvider>
      );
      expect(screen.getByText("Page")).toBeInTheDocument();
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
      view.unmount();
      for (const spy of spies) spy.mockRestore();
    }
  );

  it("waits for both stat catalogs before mounting a directly opened workspace", async () => {
    let finishCharacters!: () => void;
    let finishWeapons!: () => void;
    let charactersReady = false;
    let weaponsReady = false;
    const ready = {};
    const spies = [
      vi
        .spyOn(characterStatsResource, "peek")
        .mockImplementation(() => (charactersReady ? ready : null)),
      vi
        .spyOn(weaponStatsResource, "peek")
        .mockImplementation(() => (weaponsReady ? ready : null)),
      vi.spyOn(characterStatsResource, "preload").mockImplementation(
        () =>
          new Promise((resolve) => {
            finishCharacters = () => {
              charactersReady = true;
              resolve({});
            };
          })
      ),
      vi.spyOn(weaponStatsResource, "preload").mockImplementation(
        () =>
          new Promise((resolve) => {
            finishWeapons = () => {
              weaponsReady = true;
              resolve({});
            };
          })
      ),
    ];
    const mounted = vi.fn();
    function Workspace() {
      mounted();
      return "Workspace";
    }
    const view = render(
      <LanguageProvider>
        <RouteGameData pathname="/team-comp/analysis">
          <Workspace />
        </RouteGameData>
      </LanguageProvider>
    );
    expect(mounted).not.toHaveBeenCalled();
    await act(async () => finishCharacters());
    expect(mounted).not.toHaveBeenCalled();
    await act(async () => finishWeapons());
    await waitFor(() =>
      expect(screen.getByText("Workspace")).toBeInTheDocument()
    );
    view.unmount();
    for (const spy of spies) spy.mockRestore();
  });
});
