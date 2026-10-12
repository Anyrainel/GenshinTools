import { type LabPreview, LabPreviewSchema } from "./labPreviewSchema";

export async function fetchLabPreview(
  signal: AbortSignal,
  revision = 0
): Promise<LabPreview> {
  if (!import.meta.env.DEV)
    throw new Error("Preview is available in development only.");
  const response = await fetch(`/__dev/lab-preview.json?revision=${revision}`, {
    signal,
  });
  if (!response.ok)
    throw new Error(`Preview load failed (${response.status}).`);
  return LabPreviewSchema.parse(await response.json());
}
