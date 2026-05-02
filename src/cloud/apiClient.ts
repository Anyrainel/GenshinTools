import type { CloudPartitionId } from "@/cloud/types";

export type BackupPartitionKey = CloudPartitionId;

export type BackupHead = {
  partitionKey: BackupPartitionKey;
  rev: string;
  objectId: string;
  schemaVersion: number;
  contentHash: string;
  compressedHash: string;
  compressedBytes: number;
  updatedAt: number;
  sourceDeviceId?: string;
  sourceDeviceLabel?: string;
  deletedAt?: number;
};

export type BackupHeadResponse = {
  serverTime: number;
  changed: boolean;
  headSetRev: string;
  capabilities: {
    apiVersion: 1;
    commitContentTypes: ["multipart/form-data"];
    maxObjectsPerCommit: number;
    maxCompressedBytesPerCommit: number;
    maxCompressedBytesPerObject: number;
  };
  heads: BackupHead[];
};

export type BackupWriteMode =
  | { kind: "ifMatch"; expectedRev: string }
  | { kind: "ifAbsent" }
  | { kind: "overwrite" };

export type BackupCommitObjectInput = {
  commitObjectKey: string;
  partitionKey: BackupPartitionKey;
  schemaVersion: number;
  contentHash: string;
  compressedHash: string;
  logicalBytes?: number;
  compressedBytes?: number;
  writeMode: BackupWriteMode;
  bytes: Blob;
};

export type BackupCommitDeleteInput = {
  partitionKey: BackupPartitionKey;
  writeMode: Exclude<BackupWriteMode, { kind: "ifAbsent" }>;
};

export type BackupCommitRequest = {
  idempotencyKey: string;
  deviceId: string;
  deviceLabel?: string;
  puts?: BackupCommitObjectInput[];
  deletes?: BackupCommitDeleteInput[];
};

export type BackupCommitResponse = {
  idempotencyKey: string;
  committedAt: number;
  headSetRev: string;
  heads: BackupHead[];
};

export type BackupObjectDownloadManifest = {
  objects: BackupHead[];
};

export type BackupObjectDownloadResponse = {
  manifest: BackupObjectDownloadManifest;
  objects: Map<string, Blob>;
};

export type BackupApiClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getHeaders?: () => HeadersInit | Promise<HeadersInit>;
};

export class BackupApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "BackupApiError";
    this.status = status;
    this.payload = payload;
  }
}

export class BackupApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getHeaders?: () => HeadersInit | Promise<HeadersInit>;

  constructor(options: BackupApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "/api/backup/v1").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.getHeaders = options.getHeaders;
  }

  async getHead(
    options: { headSetRev?: string } = {}
  ): Promise<BackupHeadResponse> {
    const url = appendQuery(`${this.baseUrl}/head`, {
      headSetRev: options.headSetRev,
    });

    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: await this.headers(),
    });
    return this.readJson<BackupHeadResponse>(response, "get backup head");
  }

  async commit(request: BackupCommitRequest): Promise<BackupCommitResponse> {
    const form = new FormData();
    const puts = request.puts ?? [];
    const manifest = {
      idempotencyKey: request.idempotencyKey,
      deviceId: request.deviceId,
      ...(request.deviceLabel ? { deviceLabel: request.deviceLabel } : {}),
      puts: puts.map(({ bytes, ...put }) => ({
        ...put,
        compressedBytes: put.compressedBytes ?? bytes.size,
      })),
      deletes: request.deletes ?? [],
    };

    form.append("manifest", JSON.stringify(manifest));
    for (const put of puts) {
      form.append(
        put.commitObjectKey,
        put.bytes,
        `${put.commitObjectKey}.json.gz`
      );
    }

    const response = await this.fetchImpl(`${this.baseUrl}/commits`, {
      method: "POST",
      headers: await this.headers(),
      body: form,
    });
    return this.readJson<BackupCommitResponse>(
      response,
      "commit backup objects"
    );
  }

  async downloadObjects(
    objectIds: string[]
  ): Promise<BackupObjectDownloadResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/objects`, {
      method: "POST",
      headers: {
        ...(await normalizeHeaders(await this.headers())),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ objectIds }),
    });
    await throwIfError(response, "download backup objects");

    const form = await response.formData();
    const manifestPart = form.get("manifest");
    if (manifestPart === null) {
      throw new BackupApiError(
        "download backup objects returned no manifest",
        200,
        null
      );
    }

    const manifest = JSON.parse(
      await readFormPartText(manifestPart)
    ) as BackupObjectDownloadManifest;
    const objects = new Map<string, Blob>();
    for (const object of manifest.objects) {
      const part = form.get(object.objectId);
      if (!isBlobLike(part)) {
        throw new BackupApiError(
          `download backup objects missed object ${object.objectId}`,
          200,
          manifest
        );
      }
      objects.set(object.objectId, part);
    }

    return { manifest, objects };
  }

  private async headers(): Promise<HeadersInit> {
    return this.getHeaders ? this.getHeaders() : {};
  }

  private async readJson<T>(response: Response, label: string): Promise<T> {
    await throwIfError(response, label);
    return response.json() as Promise<T>;
  }
}

async function throwIfError(response: Response, label: string): Promise<void> {
  if (response.ok) return;

  const payload = await readErrorPayload(response);
  throw new BackupApiError(
    `${label} failed with HTTP ${response.status}`,
    response.status,
    payload
  );
}

async function readErrorPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

async function readFormPartText(part: FormDataEntryValue): Promise<string> {
  if (typeof part === "string") return part;
  if (typeof part.text === "function") return part.text();
  if (typeof part.arrayBuffer === "function") {
    return new TextDecoder().decode(await part.arrayBuffer());
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("failed to read backup form part"))
    );
    reader.readAsText(part);
  });
}

function isBlobLike(part: FormDataEntryValue | null): part is File {
  return typeof part !== "string" && part !== null;
}

function appendQuery(
  url: string,
  params: Record<string, string | undefined>
): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined
  );
  if (entries.length === 0) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${new URLSearchParams(entries).toString()}`;
}

async function normalizeHeaders(
  headers: HeadersInit
): Promise<Record<string, string>> {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}
