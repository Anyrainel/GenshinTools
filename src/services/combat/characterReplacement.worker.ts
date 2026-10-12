import "@/providers/reference/statLoaders";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import type {
  CharacterReplacementRequest,
  CharacterReplacementWorkerMessage,
} from "../../domain/team/characterReplacementTypes";
import {
  runCharacterReplacement,
  runIndependentCharacterReplacements,
} from "./characterReplacement";

self.onmessage = async (event: MessageEvent<CharacterReplacementRequest>) => {
  const report = (message: CharacterReplacementWorkerMessage) =>
    self.postMessage(message);
  try {
    const [chars, weapons] = await Promise.all([
      characterStatsResource.preload(),
      weaponStatsResource.preload(),
    ]);
    if (event.data.task === "independent")
      await runIndependentCharacterReplacements(
        event.data,
        chars,
        weapons,
        report
      );
    else await runCharacterReplacement(event.data, chars, weapons, report);
  } catch (error) {
    report({
      type: "error",
      reason: "calculator-error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
