import { z } from "zod";

export const LabPreviewSchema = z.object({
  updatedAt: z.string().datetime(),
  drafts: z.array(
    z.object({
      id: z.string(),
      characterId: z.string(),
      requestId: z.string(),
      readiness: z.string(),
      publication: z.string(),
      fields: z.array(
        z.object({ id: z.string(), state: z.string(), value: z.unknown() })
      ),
      blockers: z.array(z.object({ field: z.string(), code: z.string() })),
    })
  ),
  sources: z.array(
    z.object({
      id: z.string(),
      characterId: z.string(),
      status: z.string(),
      unknowns: z.array(z.string()),
      links: z.array(z.object({ source: z.string(), url: z.string().url() })),
      observations: z.unknown(),
    })
  ),
  optimizer: z.array(
    z.object({
      id: z.string(),
      commit: z.string(),
      ratio: z.number(),
      regressions: z.number(),
      status: z.string(),
      description: z.string(),
    })
  ),
});

export type LabPreview = z.infer<typeof LabPreviewSchema>;
