import { BuildGroup, BuildPayload, ComputeOptions } from "../data/types";

export const BUILD_DATA_VERSION = 4;

export const createBuildExportPayload = (
  groups: BuildGroup[],
  computeOptions: ComputeOptions,
  author: string,
  description: string,
): BuildPayload => ({
  author,
  description,
  version: BUILD_DATA_VERSION,
  data: groups,
  computeOptions,
});

export const serializeBuildExportPayload = (
  groups: BuildGroup[],
  computeOptions: ComputeOptions,
  author: string,
  description: string,
): string => {
  return JSON.stringify(
    createBuildExportPayload(groups, computeOptions, author, description),
    null,
    2,
  );
};
