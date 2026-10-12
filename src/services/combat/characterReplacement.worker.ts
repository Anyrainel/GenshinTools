import "@/providers/reference/statLoaders";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import type {
  CharacterReplacementMessage,
  CharacterReplacementRequest,
} from "../../domain/team/characterReplacementTypes";
import { runCharacterReplacement } from "./characterReplacement";

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
