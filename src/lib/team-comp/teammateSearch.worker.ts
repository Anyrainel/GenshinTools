import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { searchTeammates } from "./teammateSearch";
import type {
  TeammateSearchMessage,
  TeammateSearchRequest,
} from "./teammateSearchTypes";

self.onmessage = async (event: MessageEvent<TeammateSearchRequest>) => {
  const report = (message: TeammateSearchMessage) => self.postMessage(message);
  try {
    const [chars, weapons] = await Promise.all([
      characterStatsResource.preload(),
      weaponStatsResource.preload(),
    ]);
    await searchTeammates(event.data, chars, weapons, report);
  } catch (error) {
    report({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
