import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import type { TriageSettings } from "@/lib/account-data/triage/types";
import type { AccountProfileId } from "@/lib/account-data/types";
import { migrateTriageStore } from "./migration/triage";
import { PersistedTriageStoreSchema } from "./schemas";
import { useAccountStore } from "./useAccountStore";

interface TriageState {
  settingsByProfileId: Record<AccountProfileId, TriageSettings>;
  setSettings: (settings: TriageSettings) => void;
  updateSettings: (patch: Partial<TriageSettings>) => void;
  renameProfileSettings: (
    sourceProfileId: AccountProfileId,
    targetProfileId: AccountProfileId
  ) => void;
}

const cloneDefaultSettings = (): TriageSettings => ({
  ...DEFAULT_TRIAGE_SETTINGS,
  disabledFlexPatterns: [...DEFAULT_TRIAGE_SETTINGS.disabledFlexPatterns],
  enabledFlexPatterns: [...DEFAULT_TRIAGE_SETTINGS.enabledFlexPatterns],
  customFlexInputs: DEFAULT_TRIAGE_SETTINGS.customFlexInputs.map((input) => ({
    ...input,
    requiredSubs: [...input.requiredSubs],
  })),
});

const FALLBACK_TRIAGE_SETTINGS = cloneDefaultSettings();

const getActiveProfileId = () =>
  useAccountStore.getState().activeAccountId ?? DEFAULT_ACCOUNT_PROFILE_ID;

const getSettingsForProfile = (
  state: Pick<TriageState, "settingsByProfileId">,
  profileId: AccountProfileId | null
) =>
  state.settingsByProfileId[profileId ?? DEFAULT_ACCOUNT_PROFILE_ID] ??
  FALLBACK_TRIAGE_SETTINGS;

export const selectActiveTriageSettings = (
  state: Pick<TriageState, "settingsByProfileId">
): TriageSettings => getSettingsForProfile(state, getActiveProfileId());

export const getActiveTriageSettings = (): TriageSettings =>
  selectActiveTriageSettings(useTriageStore.getState());

const settingsEqual = (
  first: TriageSettings,
  second: TriageSettings
): boolean => JSON.stringify(first) === JSON.stringify(second);

export const useTriageStore = create<TriageState>()(
  persist(
    (set) => ({
      settingsByProfileId: {
        [DEFAULT_ACCOUNT_PROFILE_ID]: cloneDefaultSettings(),
      },

      setSettings: (settings) =>
        set((state) => ({
          settingsByProfileId: {
            ...state.settingsByProfileId,
            [getActiveProfileId()]: settings,
          },
        })),

      updateSettings: (patch) =>
        set((state) => {
          const profileId = getActiveProfileId();
          return {
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [profileId]: {
                ...getSettingsForProfile(state, profileId),
                ...patch,
              },
            },
          };
        }),

      renameProfileSettings: (sourceProfileId, targetProfileId) =>
        set((state) => {
          if (sourceProfileId === targetProfileId) return state;
          const sourceSettings = state.settingsByProfileId[sourceProfileId];
          if (!sourceSettings) return state;

          const settingsByProfileId = { ...state.settingsByProfileId };
          delete settingsByProfileId[sourceProfileId];

          const nextSettings = settingsEqual(
            sourceSettings,
            cloneDefaultSettings()
          )
            ? cloneDefaultSettings()
            : structuredClone(sourceSettings);
          if (!settingsEqual(nextSettings, cloneDefaultSettings())) {
            settingsByProfileId[targetProfileId] = nextSettings;
          }

          return {
            settingsByProfileId,
          };
        }),
    }),
    {
      name: "triage-settings",
      version: 7,
      migrate: migrateTriageStore,
      partialize: (state) => ({
        settingsByProfileId: state.settingsByProfileId,
      }),
      merge: (persistedState, currentState) => {
        const parsed = PersistedTriageStoreSchema.safeParse(persistedState);
        if (!parsed.success) return currentState;
        const settingsByProfileId = parsed.data.settingsByProfileId as Record<
          AccountProfileId,
          TriageSettings
        >;
        if (Object.keys(settingsByProfileId).length === 0) {
          settingsByProfileId[DEFAULT_ACCOUNT_PROFILE_ID] =
            cloneDefaultSettings();
        }
        return {
          ...currentState,
          settingsByProfileId,
        };
      },
    }
  )
);

useAccountStore.subscribe((state, prevState) => {
  if (state.activeAccountId !== prevState.activeAccountId) {
    // Re-run active-settings selectors after account changes without storing a mirror.
    useTriageStore.setState((triageState) => ({
      settingsByProfileId: triageState.settingsByProfileId,
    }));
  }
});
