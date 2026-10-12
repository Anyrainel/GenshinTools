import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { runCharacterReplacement } from "./characterReplacement";
import type {
  CharacterReplacementMessage,
  CharacterReplacementRequest,
} from "./characterReplacementTypes";

self.onmessage = async (event: MessageEvent<CharacterReplacementRequest>) => {
  const report = (message: CharacterReplacementMessage) =>
    self.postMessage(message);
  try {
    const [chars, weapons] = await Promise.all([
      characterStatsResource.preload(),
      weaponStatsResource.preload(),
    ]);
    await runCharacterReplacement(event.data, chars, weapons, report);
  } catch (error) {
    report({
      type: "error",
      reason: "calculator-error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
