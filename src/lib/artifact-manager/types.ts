import type { IGOODArtifact } from "@/lib/account-data/goodConversion";

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

export interface SubmitResponse {
  jobId: string;
  total: number;
}

// ---------- Status ----------
export type JobState = "idle" | "running" | "completed";

export interface StatusIdle {
  state: "idle";
}

export interface StatusRunning {
  state: "running";
  jobId: string;
  progress: { completed: number; total: number };
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
