import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { z } from "zod";
import { LabPreviewSchema, type LabPreview } from "../../src/providers/preview/labPreviewSchema";

const object = z.record(z.string(), z.unknown());
const field = z.object({ fieldId: z.string(), state: z.string(), value: z.unknown() });
const packet = z.object({
  packetId: z.string(), subject: z.object({ characterId: z.string(), requestId: z.string() }),
  readiness: z.object({ guideReadiness: z.string(), publicationStatus: z.string() }),
  fields: object,
  blockers: z.array(z.object({ fieldId: z.string(), code: z.string() })),
});
const record = z.object({
  id: z.string(), kind: z.string(), characterId: z.string().optional(), status: z.string(),
  unknowns: z.array(z.string()),
  sourceRefs: z.array(z.object({ sourceId: z.string(), locator: object })),
  recommendations: z.unknown().optional(), builds: z.unknown().optional(), weaponOrder: z.unknown().optional(),
});

function collectFields(value: unknown): LabPreview["drafts"][number]["fields"] {
  if (!value || typeof value !== "object") return [];
  if ("fieldId" in value) {
    const item = field.parse(value);
    return [{ id: item.fieldId, state: item.state, value: item.value }];
  }
  return Object.values(value).flatMap(collectFields);
}

/** Read-only projection of saved artifacts. Never imports or executes the lab. */
export async function loadLabPreview(root: string): Promise<LabPreview> {
  const reportPath = path.join(root, "scripts/guide-factory/reports/noelle-hexerei-guide-draft-projection.json");
  const [draftBytes, corpusBytes, modified] = await Promise.all([
    readFile(reportPath, "utf8"),
    readFile(path.join(root, "scripts/guide-factory/data/knowledge/repository.json"), "utf8"),
    stat(reportPath),
  ]);
  const drafts = z.object({ packets: z.array(packet) }).parse(JSON.parse(draftBytes));
  const corpus = z.object({ records: z.array(z.unknown()) }).parse(JSON.parse(corpusBytes));
  const sources = corpus.records.filter((value) => object.parse(value).kind === "character_guide").map((value) => {
    const item = record.parse(value);
    if (!item.characterId) throw new Error(`Guide source ${item.id} lacks a character.`);
    return {
      id: item.id, characterId: item.characterId, status: item.status, unknowns: item.unknowns,
      links: item.sourceRefs.flatMap((ref) => {
        const url = ref.locator.url;
        return typeof url === "string" && /^https:\/\//.test(url) ? [{ source: ref.sourceId, url }] : [];
      }),
      observations: { recommendations: item.recommendations ?? [], builds: item.builds ?? [], weaponOrder: item.weaponOrder ?? [] },
    };
  });
  return LabPreviewSchema.parse({
    updatedAt: modified.mtime.toISOString(),
    drafts: drafts.packets.map((item) => ({
      id: item.packetId, ...item.subject, readiness: item.readiness.guideReadiness,
      publication: item.readiness.publicationStatus, fields: collectFields(item.fields),
      blockers: item.blockers.map((blocker) => ({ field: blocker.fieldId, code: blocker.code })),
    })), sources,
  });
}

export function labPreview(): Plugin {
  return {
    name: "offline-lab-preview", apply: "serve", enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/__dev/lab-preview.json") return next();
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (req.method !== "GET") { res.statusCode = 405; res.setHeader("Allow", "GET"); res.end(JSON.stringify({ error: "GET only" })); return; }
        void loadLabPreview(server.config.root).then((data) => res.end(JSON.stringify(data))).catch((error: unknown) => {
          server.config.logger.error(`Lab preview: ${String(error)}`);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Saved experiment data is missing or invalid." }));
        });
      });
    },
  };
}
