import type { IGOODArtifact } from "@/lib/account-data/import/goodConversion";

// ---------- Health ----------
export interface HealthResponse {
  status: string;
  enabled: boolean;
  busy: boolean;
  gameAlive: boolean;
}

// ---------- Manage ----------
export interface ManageRequest {
  lock: IGOODArtifact[];
  unlock: IGOODArtifact[];
}

/**
 * Payload returned by instruction builders.
 * Contains both the API request body and internal artifact IDs
 * for correlating positional results back to local data.
 */
export interface ManagePayload {
  request: ManageRequest;
  /** Internal artifact IDs, parallel to request.lock */
  lockIds: string[];
  /** Internal artifact IDs, parallel to request.unlock */
  unlockIds: string[];
}

// ---------- Equip ----------
export interface EquipInstruction {
  artifact: IGOODArtifact;
  /** GOOD v3 character key (e.g. "Furina"), or "" to unequip */
  location: string;
}

export interface EquipRequest {
  equip: EquipInstruction[];
}

/**
 * Payload returned by equip instruction builders.
 * Contains the API request body, internal artifact IDs for correlating
 * positional results, and a swap map for post-job store sync.
 */
export interface EquipPayload {
  request: EquipRequest;
  /** Internal artifact IDs, parallel to request.equip */
  artifactIds: string[];
  /**
   * Maps internal artifact ID → { fromChar (internal ID or null), toChar (internal ID) }.
   * Used to apply implicit game swaps after successful equip.
   */
  swapMap: Map<string, { fromChar: string | null; toChar: string }>;
}

export interface SubmitResponse {
  jobId: string;
  total: number;
}

// ---------- Scan ----------
export interface ScanRequest {
  characters?: boolean;
  weapons?: boolean;
  artifacts?: boolean;
  artifactMode?: "all" | "recent";
  artifactLimit?: number;
}

export interface ScanSubmitResponse {
  jobId: string;
  targets: ScanRequest;
}

// ---------- Status ----------
export type JobState = "idle" | "running" | "completed";

export interface StatusIdle {
  state: "idle";
}

export type CategoryProgressState =
  | "pending"
  | "running"
  | "complete"
  | "aborted";

export interface CategoryProgress {
  completed: number;
  total: number;
  state: CategoryProgressState;
}

export interface ScanProgress {
  characters?: CategoryProgress;
  weapons?: CategoryProgress;
  artifacts?: CategoryProgress;
}

export interface StatusRunning {
  state: "running";
  jobId: string;
  /** Linear progress for manage / equip jobs. */
  progress?: {
    completed: number;
    total: number;
    currentId?: string;
    phase?: string;
  };
  /** Per-category progress for scan jobs. */
  scanProgress?: ScanProgress;
}

export interface StatusCompleted {
  state: "completed";
  jobId: string;
  summary: ResultSummary;
}

export type StatusResponse = StatusIdle | StatusRunning | StatusCompleted;

// ---------- Result ----------
export type InstructionStatus =
  | "success"
  | "already_correct"
  | "not_found"
  | "invalid_input"
  | "ocr_error"
  | "ui_error"
  | "aborted"
  | "skipped";

export interface InstructionResult {
  id: string;
  status: InstructionStatus;
}

export interface ResultSummary {
  total: number;
  success: number;
  already_correct: number;
  not_found: number;
  errors: number;
  aborted: number;
}

export interface ResultResponse {
  results: InstructionResult[];
  summary: ResultSummary;
}
