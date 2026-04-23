import type {
  IGOODArtifact,
  IGOODCharacter,
  IGOODWeapon,
} from "@/lib/account-data/import/goodConversion";
import type {
  EquipRequest,
  HealthResponse,
  ManageRequest,
  ResultResponse,
  ScanRequest,
  ScanSubmitResponse,
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
  request: ManageRequest,
  port = DEFAULT_PORT
): Promise<SubmitResponse> {
  return fetchJson<SubmitResponse>(`${baseUrl(port)}/manage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export function submitEquipJob(
  request: EquipRequest,
  port = DEFAULT_PORT
): Promise<SubmitResponse> {
  return fetchJson<SubmitResponse>(`${baseUrl(port)}/equip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export function pollStatus(port = DEFAULT_PORT): Promise<StatusResponse> {
  return fetchJson<StatusResponse>(`${baseUrl(port)}/status`);
}

export function getResult(
  jobId: string,
  port = DEFAULT_PORT
): Promise<ResultResponse> {
  return fetchJson<ResultResponse>(
    `${baseUrl(port)}/result?jobId=${encodeURIComponent(jobId)}`
  );
}

export function fetchArtifacts(
  port = DEFAULT_PORT,
  jobId?: string
): Promise<IGOODArtifact[] | null> {
  const url = jobId
    ? `${baseUrl(port)}/artifacts?jobId=${encodeURIComponent(jobId)}`
    : `${baseUrl(port)}/artifacts`;
  return fetchJson<IGOODArtifact[]>(url).catch((e) => {
    // 404 = no scan data for that jobId, 503 = category didn't complete
    if (
      e instanceof ArtifactManagerError &&
      (e.status === 404 || e.status === 503)
    )
      return null;
    throw e;
  });
}

export function submitScanJob(
  request: ScanRequest,
  port = DEFAULT_PORT
): Promise<ScanSubmitResponse> {
  return fetchJson<ScanSubmitResponse>(`${baseUrl(port)}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export function fetchCharacters(
  jobId: string,
  port = DEFAULT_PORT
): Promise<IGOODCharacter[] | null> {
  return fetchJson<IGOODCharacter[]>(
    `${baseUrl(port)}/characters?jobId=${encodeURIComponent(jobId)}`
  ).catch((e) => {
    // 404 = no data for this jobId, 503 = category didn't complete
    if (
      e instanceof ArtifactManagerError &&
      (e.status === 404 || e.status === 503)
    )
      return null;
    throw e;
  });
}

export function fetchWeapons(
  jobId: string,
  port = DEFAULT_PORT
): Promise<IGOODWeapon[] | null> {
  return fetchJson<IGOODWeapon[]>(
    `${baseUrl(port)}/weapons?jobId=${encodeURIComponent(jobId)}`
  ).catch((e) => {
    // 404 = no data for this jobId, 503 = category didn't complete
    if (
      e instanceof ArtifactManagerError &&
      (e.status === 404 || e.status === 503)
    )
      return null;
    throw e;
  });
}
