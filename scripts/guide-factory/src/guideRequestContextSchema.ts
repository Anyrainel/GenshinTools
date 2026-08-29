import { z } from "zod";
import type { GuideRequestContext } from "./guideRequestContext";

const CharacterRequestFactsSchema = z
  .object({
    intendedRole: z.string().min(1).optional(),
    optimizationGoal: z.string().min(1).optional(),
  })
  .strict();

const TeamRequestFactsSchema = z
  .object({
    characterFactsById: z
      .record(z.string().min(1), CharacterRequestFactsSchema)
      .optional(),
    acquisitionPreference: z.string().min(1).optional(),
    passiveExecutionAssumptions: z
      .record(z.string().min(1), z.boolean())
      .optional(),
  })
  .strict();

export const GuideRequestContextSchema: z.ZodType<GuideRequestContext> = z
  .object({
    requestFactsByTeamRecordId: z
      .record(z.string().min(1), TeamRequestFactsSchema)
      .optional(),
    accountFacts: z
      .object({
        snapshotId: z.string().min(1),
        weaponInventory: z
          .object({
            domain: z.enum(["complete", "incomplete"]),
            weaponIds: z.array(z.string().min(1)),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const GuideRequestContextFixtureSchema = z
  .object({
    schemaVersion: z.literal(1),
    fixtureId: z.string().min(1),
    contexts: z
      .array(
        z
          .object({
            contextId: z.string().min(1),
            context: GuideRequestContextSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type GuideRequestContextFixture = z.infer<
  typeof GuideRequestContextFixtureSchema
>;
