import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { DEFAULT_TRIAGE_SETTINGS } from "@/domain/game-account/triage/constants";
import type { ArtifactData, Build } from "@/domain/models";
import { TriageView } from "@/pages/game-account/TriageView";
import type { ManageRequest } from "@/providers/scanner/companion/types";
import { useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useTriageStore } from "@/stores/useTriageStore";
import { render } from "../../utils/render";

function artifact(
  id: string,
  rarity: 4 | 5,
  lock: boolean,
  overrides: Partial<ArtifactData> = {}
): ArtifactData {
  return {
    id,
    setKey: "emblem_of_severed_fate",
    slotKey: "flower",
    rarity,
    level: 0,
    lock,
    mainStatKey: "hp",
    substats: {},
    ...overrides,
  };
}

const instructorBuild: Build = {
  id: "instructor-build",
  characterId: "hu_tao",
  name: "Instructor",
  visible: true,
  composition: "4pc",
  artifactSet: "instructor",
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
    { stat: "atk%", weight: 100 },
  ],
  sandsWeights: [{ stat: "atk%", weight: 100 }],
  gobletWeights: [{ stat: "pyro%", weight: 100 }],
  circletWeights: [{ stat: "cr", weight: 100 }],
  normalizer: 1,
};

function openProtectedTab(name = /^Protected/): void {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
}

describe("four-star artifacts in triage", () => {
  beforeEach(() => {
    localStorage.setItem("app_language", "en");
    useAccountStore.getState().clearAccounts();
    useAccountStore.getState().addOrUpdateAccount(0, {
      data: {
        characters: [],
        extraWeapons: [],
        extraArtifacts: [
          artifact("native-four-to-lock", 4, false, {
            setKey: "instructor",
            substats: { cr: 3.11, cd: 6.22, "atk%": 4.66 },
            totalRolls: 3,
          }),
          artifact("native-four-to-unlock", 4, true, {
            setKey: "instructor",
            substats: { def: 13, atk: 11 },
            totalRolls: 2,
          }),
          artifact("variant-four-locked", 4, true),
          artifact("variant-four-unlocked", 4, false),
          artifact("five-locked", 5, true),
        ],
      },
    });
    useBuildsStore.getState().clearAll();
    useBuildsStore.setState({
      enabledResolvedBuildGroups: [
        { characterId: "hu_tao", builds: [instructorBuild], weapons: [] },
      ],
    });
    useTriageStore.getState().setSettings({
      ...DEFAULT_TRIAGE_SETTINGS,
      highLevelProtection: false,
      equippedProtection: false,
      setSlotKeep: 0,
      ownedOnly: false,
    });
  });

  afterEach(() => localStorage.removeItem("app_language"));

  it.each([
    {
      language: "en",
      protectedTab: /^Protected/,
      reason: "4-star variants of 5-star sets are excluded",
      fodder: "Fodder",
      inventory: "5 artifacts in inventory:",
    },
    {
      language: "zh",
      protectedTab: /^保护区不参与/,
      reason: "五星套装的四星版本不参与锁定判断",
      fodder: "狗粮",
      inventory: "共 5 个圣遗物：",
    },
  ])(
    "shows excluded four-star variants in the protected zone in $language",
    ({ language, protectedTab, reason, fodder, inventory }) => {
      localStorage.setItem("app_language", language);
      render(<TriageView />);

      expect(screen.getByText(inventory)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: new RegExp(`2\\s*${fodder}`) })
      ).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: protectedTab })).toHaveTextContent(
        "2"
      );
      openProtectedTab(protectedTab);
      expect(screen.getAllByText(reason)).toHaveLength(2);
      expect(
        within(screen.getByRole("tabpanel")).queryByText(fodder, {
          exact: true,
        })
      ).not.toBeInTheDocument();
    }
  );

  describe("Apply to Game", () => {
    afterEach(() => vi.restoreAllMocks());

    it.each([
      { name: "both by default", rarities: [4, 5], lock: true, unlock: true },
      { name: "four stars", rarities: [4], lock: true, unlock: true },
      { name: "five stars", rarities: [5], lock: true, unlock: true },
      { name: "neither rarity", rarities: [], lock: true, unlock: true },
      {
        name: "only four-star unlocks",
        rarities: [4],
        lock: false,
        unlock: true,
      },
      {
        name: "only five-star locks",
        rarities: [5],
        lock: true,
        unlock: false,
      },
    ])(
      "previews, submits and syncs $name",
      async ({ rarities, lock, unlock }) => {
        const account = useAccountStore.getState().accounts[0].data;
        const inventory = [
          ...account.extraArtifacts,
          artifact("five-to-lock", 5, false, {
            totalRolls: 4,
            substats: { cr: 3.89, cd: 7.77, er: 5.18, atk: 19 },
          }),
        ];
        useAccountStore.getState().addOrUpdateAccount(0, {
          data: { ...account, extraArtifacts: inventory },
        });

        const requests: ManageRequest[] = [];
        const jobId = "test-triage";
        vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
          const { pathname } = new URL(String(url));
          if (pathname === "/health")
            return Response.json({
              status: "ok",
              enabled: true,
              busy: false,
              gameAlive: true,
            });
          if (pathname === "/manage" && init?.method === "POST") {
            const request: ManageRequest = JSON.parse(String(init.body));
            requests.push(request);
            return Response.json({
              jobId,
              total: request.lock.length + request.unlock.length,
            });
          }
          if (pathname === "/artifacts")
            return new Response(null, { status: 404 });
          const request = requests[0];
          const results = request
            ? [
                ...request.lock.map((_, i) => ({
                  id: `lock:${i}`,
                  status: "success",
                })),
                ...request.unlock.map((_, i) => ({
                  id: `unlock:${i}`,
                  status: "success",
                })),
              ]
            : [];
          const summary = {
            total: results.length,
            success: results.length,
            already_correct: 0,
            not_found: 0,
            errors: 0,
            aborted: 0,
          };
          if (pathname === "/status")
            return Response.json({ state: "completed", jobId, summary });
          if (pathname === "/result")
            return Response.json({ results, summary });
          throw new Error(`Unexpected fetch in triage test: ${pathname}`);
        });
        render(<TriageView />);
        fireEvent.click(screen.getByRole("button", { name: "Apply to Game" }));
        const dialog = within(screen.getByRole("dialog"));
        const apply = dialog.getByRole("button", { name: "Apply to Game" });
        await waitFor(() => expect(apply).toBeEnabled());
        for (const rarity of [4, 5]) {
          const checkbox = dialog.getByRole("checkbox", {
            name: `${rarity}-star`,
          });
          expect(checkbox).toBeChecked();
          if (!rarities.includes(rarity)) fireEvent.click(checkbox);
        }
        if (!lock)
          fireEvent.click(
            dialog.getByRole("checkbox", { name: "Include lock instructions" })
          );
        if (!unlock)
          fireEvent.click(
            dialog.getByRole("checkbox", {
              name: "Include unlock instructions",
            })
          );
        const lockCount = lock ? rarities.length : 0;
        const unlockCount = unlock ? rarities.length : 0;
        expect(
          dialog.getByText(`Lock ${lockCount} · Unlock ${unlockCount}`)
        ).toBeInTheDocument();
        if (rarities.length === 0) {
          expect(apply).toBeDisabled();
          fireEvent.click(apply);
          expect(requests).toEqual([]);
          return;
        }

        fireEvent.click(apply);
        await dialog.findByText(
          `${lockCount + unlockCount} artifacts processed`,
          {},
          { timeout: 3000 }
        );
        expect(requests).toHaveLength(1);
        for (const [action, include] of [
          ["lock", lock],
          ["unlock", unlock],
        ] as const) {
          const sent = requests[0][action];
          expect(sent.map((a) => a.rarity).sort()).toEqual(
            include ? rarities : []
          );
          expect(sent.map((a) => a.setKey).sort()).toEqual(
            (include ? rarities : [])
              .map((r) => (r === 4 ? "Instructor" : "EmblemOfSeveredFate"))
              .sort()
          );
        }
        const expected = inventory.map((a) => {
          if (rarities.includes(a.rarity)) {
            if (lock && ["native-four-to-lock", "five-to-lock"].includes(a.id))
              return [a.id, true];
            if (
              unlock &&
              ["native-four-to-unlock", "five-locked"].includes(a.id)
            )
              return [a.id, false];
          }
          return [a.id, a.lock];
        });
        expect(
          useAccountStore
            .getState()
            .accounts[0].data.extraArtifacts.map((a) => [a.id, a.lock])
        ).toEqual(expected);
      }
    );
  });

  it("keeps excluded variants visible through quality and result filters", () => {
    render(<TriageView />);

    fireEvent.click(screen.getByRole("button", { name: /Fodder/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /filter by lock result/i })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Locked by flex rules" })
    );

    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "2"
    );
    openProtectedTab();
    expect(
      screen.getAllByText("4-star variants of 5-star sets are excluded")
    ).toHaveLength(2);
  });

  it("still applies inventory set and slot filters to protected four-star artifacts", () => {
    render(<TriageView />);
    openProtectedTab();

    fireEvent.click(
      screen.getByRole("button", { name: /filter by artifact set/i })
    );
    fireEvent.click(screen.getByRole("button", { name: "Instructor" }));
    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "0"
    );
    fireEvent.click(screen.getByRole("button", { name: "Instructor" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Emblem of Severed Fate" })
    );
    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "2"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Emblem of Severed Fate" })
    );
    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "2"
    );

    fireEvent.click(screen.getByRole("button", { name: /filter by slot/i }));
    fireEvent.click(screen.getByRole("button", { name: /Plume/ }));
    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "0"
    );
  });
});
