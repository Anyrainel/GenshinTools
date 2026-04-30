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
  settings: TriageSettings;
  settingsByProfileId: Record<AccountProfileId, TriageSettings>;
  setSettings: (settings: TriageSettings) => void;
  updateSettings: (patch: Partial<TriageSettings>) => void;
  cloneSettingsForProfile: (
    sourceProfileId: AccountProfileId,
    targetProfileId: AccountProfileId
  ) => boolean;
  renameProfileSettings: (
    sourceProfileId: AccountProfileId,
    targetProfileId: AccountProfileId
  ) => void;
  setActiveProfile: (profileId: AccountProfileId | null) => void;
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

const getActiveProfileId = () =>
  useAccountStore.getState().activeAccountId ?? DEFAULT_ACCOUNT_PROFILE_ID;

const getSettingsForProfile = (
  state: Pick<TriageState, "settingsByProfileId">,
  profileId: AccountProfileId | null
) =>
  state.settingsByProfileId[profileId ?? DEFAULT_ACCOUNT_PROFILE_ID] ??
  cloneDefaultSettings();

const cloneSettings = (settings: TriageSettings): TriageSettings =>
  structuredClone(settings);

const settingsEqual = (
  first: TriageSettings,
  second: TriageSettings
): boolean => JSON.stringify(first) === JSON.stringify(second);

export const useTriageStore = create<TriageState>()(
  persist(
    (set) => ({
      settings: cloneDefaultSettings(),
      settingsByProfileId: {
        [DEFAULT_ACCOUNT_PROFILE_ID]: cloneDefaultSettings(),
      },

      setSettings: (settings) =>
        set((state) => {
          const profileId = getActiveProfileId();
          return {
            settings,
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [profileId]: settings,
            },
          };
        }),

      updateSettings: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch },
          settingsByProfileId: {
            ...state.settingsByProfileId,
            [getActiveProfileId()]: { ...state.settings, ...patch },
          },
        })),

      cloneSettingsForProfile: (sourceProfileId, targetProfileId) => {
        let didClone = false;
        set((state) => {
          const sourceSettings = getSettingsForProfile(state, sourceProfileId);
          if (settingsEqual(sourceSettings, cloneDefaultSettings())) return {};

          didClone = true;
          const cloned = cloneSettings(sourceSettings);
          return {
            ...(getActiveProfileId() === targetProfileId
              ? { settings: cloned }
              : {}),
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [targetProfileId]: cloned,
            },
          };
        });
        return didClone;
      },

      renameProfileSettings: (sourceProfileId, targetProfileId) =>
        set((state) => {
          if (sourceProfileId === targetProfileId) return state;
          const sourceSettings =
            getActiveProfileId() === sourceProfileId
              ? state.settings
              : state.settingsByProfileId[sourceProfileId];
          if (!sourceSettings) return state;

          const settingsByProfileId = { ...state.settingsByProfileId };
          delete settingsByProfileId[sourceProfileId];

          const nextSettings = settingsEqual(
            sourceSettings,
            cloneDefaultSettings()
          )
            ? cloneDefaultSettings()
            : cloneSettings(sourceSettings);
          if (!settingsEqual(nextSettings, cloneDefaultSettings())) {
            settingsByProfileId[targetProfileId] = nextSettings;
          }
          const activeProfileId = getActiveProfileId();

          return {
            ...(activeProfileId === sourceProfileId ||
            activeProfileId === targetProfileId
              ? { settings: nextSettings }
              : {}),
            settingsByProfileId,
          };
        }),

      setActiveProfile: (profileId) =>
        set((state) => ({
          settings: getSettingsForProfile(state, profileId),
        })),
    }),
    {
      name: "triage-settings",
      version: 6,
      migrate: migrateTriageStore,
      partialize: (state) => ({
        settingsByProfileId: {
          ...state.settingsByProfileId,
          [getActiveProfileId()]: cloneSettings(state.settings),
        },
      }),
      merge: (persistedState, currentState) => {
        const parsed = PersistedTriageStoreSchema.safeParse(persistedState);
        if (!parsed.success) return currentState;
        const activeProfileId = getActiveProfileId();
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
          settings:
            settingsByProfileId[activeProfileId] ??
            settingsByProfileId[DEFAULT_ACCOUNT_PROFILE_ID] ??
            currentState.settings,
        };
      },
    }
  )
);

useAccountStore.subscribe((state, prevState) => {
  if (state.activeAccountId !== prevState.activeAccountId) {
    useTriageStore.getState().setActiveProfile(state.activeAccountId);
  }
});
