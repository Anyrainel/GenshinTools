import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { Build, BuildPayload, ComputeOptions } from "../data/types";
import { BUILD_DATA_VERSION } from "./jsonUtils";
import { DEFAULT_COMPUTE_OPTIONS } from "../lib/computeFilters";

interface BuildsState {
  // State
  characterToBuildIds: Record<string, string[]>;
  builds: Record<string, Build>;
  hiddenCharacters: Record<string, boolean>;
  characterWeapons: Record<string, string[]>; // [weaponId1, weaponId2, weaponId3]
  computeOptions: ComputeOptions;
  author: string;
  description: string;

  // Getters
  getCharacterBuildIds: (characterId: string) => string[];
  getBuild: (buildId: string) => Build | undefined;
  getCharacterWeapons: (characterId: string) => string[];

  // Actions
  newBuild: (characterId: string) => Build;
  copyBuild: (characterId: string, buildId: string) => Build;
  setBuild: (buildId: string, patch: Partial<Build>) => void;
  removeBuild: (characterId: string, buildId: string) => void;

  // Character visibility
  setCharacterHidden: (characterId: string, hidden: boolean) => void;
  toggleCharacterHidden: (characterId: string) => void;

  // Character weapons
  setCharacterWeapons: (characterId: string, weaponIds: string[]) => void;

  // Utility for import
  importBuilds: (payload: BuildPayload) => void;
  clearAll: () => void;

  // Compute options
  setComputeOptions: (options: Partial<ComputeOptions>) => void;
  setMetadata: (author: string, description: string) => void;
}

// Empty array constant to avoid creating new arrays
const EMPTY_ARRAY: string[] = [];

export const useBuildsStore = create<BuildsState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      characterToBuildIds: {},
      builds: {},
      hiddenCharacters: {},
      characterWeapons: {},
      computeOptions: { ...DEFAULT_COMPUTE_OPTIONS },
      author: "",
      description: "",

      // Getters
      getCharacterBuildIds: (characterId: string) => {
        return get().characterToBuildIds[characterId] ?? EMPTY_ARRAY;
      },

      getBuild: (buildId: string) => {
        return get().builds[buildId];
      },

      getCharacterWeapons: (characterId: string) => {
        return get().characterWeapons[characterId] ?? EMPTY_ARRAY;
      },

      // Create a new build for a character
      newBuild: (characterId: string) => {
        const buildId = `build-${Date.now()}`;
        const newBuild: Build = {
          id: buildId,
          characterId,
          name: "",
          visible: true,
          composition: "4pc",
          sands: [],
          goblet: [],
          circlet: [],
          substats: [],
        };

        set((state) => {
          state.builds[buildId] = newBuild;
          if (!state.characterToBuildIds[characterId]) {
            state.characterToBuildIds[characterId] = [];
          }
          state.characterToBuildIds[characterId].push(buildId);
        });

        return newBuild;
      },

      // Copy an existing build for a character
      copyBuild: (characterId: string, buildId: string) => {
        const originalBuild = get().builds[buildId];
        if (!originalBuild) {
          throw new Error(`Build ${buildId} not found`);
        }

        const newBuildId = `build-${Date.now()}`;
        const copiedBuild: Build = {
          ...originalBuild,
          id: newBuildId,
          characterId,
        };

        set((state) => {
          state.builds[newBuildId] = copiedBuild;
          if (!state.characterToBuildIds[characterId]) {
            state.characterToBuildIds[characterId] = [];
          }
          state.characterToBuildIds[characterId].push(newBuildId);
        });

        return copiedBuild;
      },

      // Update a build with partial changes
      setBuild: (buildId: string, patch: Partial<Build>) => {
        set((state) => {
          const existingBuild = state.builds[buildId];
          if (!existingBuild) {
            console.warn(`Build ${buildId} not found`);
            return;
          }

          // With Immer, just mutate directly
          Object.assign(state.builds[buildId], patch);
          // Ensure id and characterId cannot be changed
          state.builds[buildId].id = existingBuild.id;
          state.builds[buildId].characterId = existingBuild.characterId;
        });
      },

      // Remove a build from a character
      removeBuild: (characterId: string, buildId: string) => {
        set((state) => {
          delete state.builds[buildId];

          const existingBuildIds = state.characterToBuildIds[characterId] || [];
          const newBuildIds = existingBuildIds.filter((id) => id !== buildId);

          if (newBuildIds.length === 0) {
            delete state.characterToBuildIds[characterId];
          } else {
            state.characterToBuildIds[characterId] = newBuildIds;
          }
        });
      },

      // Character visibility
      setCharacterHidden: (characterId: string, hidden: boolean) => {
        set((state) => {
          if (hidden) {
            state.hiddenCharacters[characterId] = true;
          } else {
            delete state.hiddenCharacters[characterId];
          }
        });
      },

      toggleCharacterHidden: (characterId: string) => {
        set((state) => {
          const current = !!state.hiddenCharacters[characterId];
          if (current) {
            delete state.hiddenCharacters[characterId];
          } else {
            state.hiddenCharacters[characterId] = true;
          }
        });
      },

      setCharacterWeapons: (characterId: string, weaponIds: string[]) => {
        set((state) => {
          if (weaponIds.length === 0) {
            delete state.characterWeapons[characterId];
          } else {
            state.characterWeapons[characterId] = weaponIds.slice(0, 3);
          }
        });
      },

      // Import builds from exported data
      importBuilds: (payload: BuildPayload) => {
        set((state) => {
          // Set metadata if available
          if (payload.author) state.author = payload.author;
          if (payload.description) state.description = payload.description;

          payload.data.forEach(({ characterId, builds }) => {
            const buildIds: string[] = [];
            builds.forEach((build) => {
              const buildWithCharacterId: Build = {
                ...build,
                characterId,
              };

              state.builds[build.id] = buildWithCharacterId;
              buildIds.push(build.id);
            });

            if (buildIds.length > 0) {
              state.characterToBuildIds[characterId] = buildIds;
            }
          });

          // Handle character weapons if present in payload
          payload.data.forEach(({ characterId, weapons }) => {
            if (weapons && weapons.length > 0) {
              state.characterWeapons[characterId] = weapons.slice(0, 3);
            } else {
              delete state.characterWeapons[characterId];
            }
          });

          // Apply character hidden flags (default to false if not provided)
          payload.data.forEach(({ characterId, hidden }) => {
            if (hidden) {
              state.hiddenCharacters[characterId] = true;
            } else {
              delete state.hiddenCharacters[characterId];
            }
          });

          state.computeOptions = {
            ...DEFAULT_COMPUTE_OPTIONS,
            ...(payload.computeOptions ?? {}),
          };
        });
      },

      // Clear all data (useful for testing)
      clearAll: () => {
        set((state) => {
          state.characterToBuildIds = {};
          state.builds = {};
          state.hiddenCharacters = {};
          state.characterWeapons = {};
          state.computeOptions = { ...DEFAULT_COMPUTE_OPTIONS };
          state.author = "";
          state.description = "";
        });
      },

      setComputeOptions: (options: Partial<ComputeOptions>) => {
        set((state) => {
          state.computeOptions = {
            ...state.computeOptions,
            ...options,
          };
        });
      },

      setMetadata: (author: string, description: string) => {
        set((state) => {
          state.author = author;
          state.description = description;
        });
      },
    })),
    {
      name: "artifact-filter-builds",
      version: BUILD_DATA_VERSION,
    },
  ),
);
