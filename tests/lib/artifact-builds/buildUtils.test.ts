import type { Build, BuildGroup, ComputeOptions } from "@/data/types";
import { createBuildExportPayloadV5 } from "@/lib/artifact-builds/buildUtils";
import { describe, expect, it } from "vitest";

const mockComputeOptions: ComputeOptions = {
  expandElementalGoblet: true,
};

describe("createBuildExportPayloadV5", () => {
  it("generates stable IDs for 4pc builds", () => {
    const build: Build = {
      id: "temp-1",
      characterId: "varka",
      name: "Varka Build",
      visible: true,
      composition: "4pc",
      artifactSet: "crimson_witch_of_flames",
      styles: [],
      roles: [],
      minCons: 0,
      sands: ["atk%"],
      goblet: ["pyro%"],
      circlet: ["cr"],
      substats: [],
    };

    const group: BuildGroup = {
      characterId: "varka",
      builds: [build],
      hidden: false,
      weapons: [],
    };

    const payload = createBuildExportPayloadV5(
      [group],
      mockComputeOptions,
      "Test",
      "Test"
    );
    const newId = Object.keys(payload.builds)[0];

    expect(newId).toBeDefined();
    expect(newId).not.toBe("temp-1");
    expect(typeof newId).toBe("string");
  });

  it("generates IDs for 2pc+2pc builds", () => {
    const build: Build = {
      id: "temp-2",
      characterId: "varka",
      name: "Mix Build",
      visible: true,
      composition: "2pc+2pc",
      halfSet1: 1,
      halfSet2: 2,
      styles: [],
      roles: [],
      minCons: 0,
      sands: [],
      goblet: [],
      circlet: [],
      substats: [],
    };

    const group: BuildGroup = {
      characterId: "varka",
      builds: [build],
      hidden: false,
      weapons: [],
    };
    const payload = createBuildExportPayloadV5(
      [group],
      mockComputeOptions,
      "Test",
      "Test"
    );
    const newId = Object.keys(payload.builds)[0];

    expect(newId).toBeDefined();
    expect(newId).not.toBe("temp-2");
  });

  it("throws on duplicate build definitions", () => {
    const build1: Build = {
      id: "temp-1",
      characterId: "varka",
      name: "Same Name",
      visible: true,
      composition: "4pc",
      artifactSet: "crimson_witch_of_flames",
      styles: [],
      roles: [],
      minCons: 0,
      sands: [],
      goblet: [],
      circlet: [],
      substats: [],
    };

    const build2: Build = {
      ...build1,
      id: "temp-2",
    };

    const group: BuildGroup = {
      characterId: "varka",
      builds: [build1, build2],
      hidden: false,
      weapons: [],
    };

    expect(() => {
      createBuildExportPayloadV5([group], mockComputeOptions, "Test", "Test");
    }).toThrow(/Duplicate build definition detected/);
  });

  it("assigns different IDs for same settings but different names", () => {
    const build1: Build = {
      id: "temp-1",
      characterId: "varka",
      name: "Build A",
      visible: true,
      composition: "4pc",
      artifactSet: "crimson_witch_of_flames",
      styles: [],
      roles: [],
      minCons: 0,
      sands: [],
      goblet: [],
      circlet: [],
      substats: [],
    };

    const build2: Build = {
      ...build1,
      id: "temp-2",
      name: "Build B",
    };

    const group: BuildGroup = {
      characterId: "varka",
      builds: [build1, build2],
      hidden: false,
      weapons: [],
    };
    const payload = createBuildExportPayloadV5(
      [group],
      mockComputeOptions,
      "Test",
      "Test"
    );

    const ids = Object.keys(payload.builds);
    expect(ids.length).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
