import type { CloudExportPartition, CloudPayloadEnvelope } from "@/cloud/types";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, entry]) => [key, sortJsonValue(entry)])
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getContentHash(payload: unknown): Promise<string> {
  return `sha256:${await sha256Hex(canonicalJson(payload))}`;
}

export async function createEnvelope<TPayload>(
  partition: CloudExportPartition<TPayload>,
  options: {
    rev: string;
    baseRev?: string;
    createdAt?: number;
    sourceDeviceId?: string;
  }
): Promise<CloudPayloadEnvelope<TPayload>> {
  return {
    app: "GenshinTools",
    schemaVersion: partition.schemaVersion,
    namespace: partition.namespace,
    partitionKey: partition.partitionKey,
    rev: options.rev,
    ...(options.baseRev ? { baseRev: options.baseRev } : {}),
    createdAt: options.createdAt ?? Date.now(),
    ...(options.sourceDeviceId
      ? { sourceDeviceId: options.sourceDeviceId }
      : {}),
    contentHash: await getContentHash(partition.payload),
    payload: partition.payload,
  };
}

export async function verifyEnvelopePayload(
  envelope: CloudPayloadEnvelope<unknown>
): Promise<boolean> {
  return envelope.contentHash === (await getContentHash(envelope.payload));
}

export function encodePathSegment(value: string | number): string {
  const text = String(value);
  if (/^[A-Za-z0-9._:-]+$/.test(text)) return text;
  return `u_${[...text]
    .map((char) => char.codePointAt(0)?.toString(36) ?? "0")
    .join("_")}`;
}

export async function gzipJson(value: unknown): Promise<Uint8Array> {
  const stream = textStream(canonicalJson(value)).pipeThrough(
    new CompressionStream("gzip")
  );
  return streamToBytes(stream);
}

export async function gunzipJson<T>(bytes: Uint8Array): Promise<T> {
  const stream = byteStream(bytes).pipeThrough(new DecompressionStream("gzip"));
  const text = new TextDecoder().decode(await streamToBytes(stream));
  return JSON.parse(text) as T;
}

function textStream(text: string): ReadableStream<Uint8Array> {
  const body = new Response(text).body;
  if (!body) throw new Error("Unable to create payload text stream");
  return body;
}

function byteStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const body = new Response(bytes).body;
  if (!body) throw new Error("Unable to create payload byte stream");
  return body;
}

async function streamToBytes(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
