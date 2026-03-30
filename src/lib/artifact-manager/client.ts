import type { IGOODArtifact } from "@/lib/account-data/goodConversion";
import type {
  HealthResponse,
  Instruction,
  ResultResponse,
  StatusResponse,
  SubmitResponse,
} from "./types";

const DEFAULT_PORT = 8765;
const TIMEOUT_MS = 5000;

function baseUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ArtifactManagerError(res.status, body);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export class ArtifactManagerError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Artifact Manager HTTP ${status}: ${body}`);
    this.name = "ArtifactManagerError";
  }
}

export function checkHealth(port = DEFAULT_PORT): Promise<HealthResponse> {
  return fetchJson<HealthResponse>(`${baseUrl(port)}/health`);
}

export function submitJob(
  instructions: Instruction[],
  port = DEFAULT_PORT
): Promise<SubmitResponse> {
  return fetchJson<SubmitResponse>(`${baseUrl(port)}/manage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructions }),
  });
}

export function pollStatus(port = DEFAULT_PORT): Promise<StatusResponse> {
  return fetchJson<StatusResponse>(`${baseUrl(port)}/status`);
}

export function getResult(port = DEFAULT_PORT): Promise<ResultResponse> {
  return fetchJson<ResultResponse>(`${baseUrl(port)}/result`);
}

export function fetchArtifacts(
  port = DEFAULT_PORT
): Promise<IGOODArtifact[] | null> {
  return fetchJson<IGOODArtifact[]>(`${baseUrl(port)}/artifacts`).catch((e) => {
    // 404 = no scan data available yet
    if (e instanceof ArtifactManagerError && e.status === 404) return null;
    throw e;
  });
}
