// ---------- Health ----------
export interface HealthResponse {
  status: string;
  enabled: boolean;
  busy: boolean;
  gameAlive: boolean;
}

// ---------- Submit ----------
export interface InstructionTarget {
  setKey: string; // GOOD v3 PascalCase
  slotKey: string; // flower | plume | sands | goblet | circlet
  rarity: number;
  level: number;
  mainStatKey: string;
  substats: { key: string; value: number }[];
}

export interface InstructionChanges {
  lock?: boolean | null;
  location?: string | null; // GOOD character key, "" = unequip
}

export interface Instruction {
  id: string;
  target: InstructionTarget;
  changes: InstructionChanges;
}

export interface SubmitRequest {
  instructions: Instruction[];
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
  detail?: string;
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
