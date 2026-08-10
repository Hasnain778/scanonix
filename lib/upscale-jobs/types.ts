export type UpscaleJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type UpscaleJobStage =
  | "preparing"
  | "queued"
  | "upscaling"
  | "preparing_result"
  | "finalizing"
  | "completed";

export interface UpscaleJobRecord {
  id: string;
  user_id: string;
  status: UpscaleJobStatus;
  scale: 2 | 4;
  stage: UpscaleJobStage;
  progress: number;
  input_storage_path: string;
  output_storage_path: string | null;
  input_mime_type: string;
  input_width: number;
  input_height: number;
  input_size_bytes: number;
  output_width: number | null;
  output_height: number | null;
  output_format: string | null;
  output_size_bytes: number | null;
  error_code: string | null;
  error_message: string | null;
  usage_charged: boolean;
  attempts: number;
  max_attempts: number;
  worker_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
}

export interface UpscaleJobPublicStatus {
  jobId: string;
  status: UpscaleJobStatus;
  stage: UpscaleJobStage;
  progress: number;
  label: string;
  scale: 2 | 4;
  inputWidth: number;
  inputHeight: number;
  outputWidth: number | null;
  outputHeight: number | null;
  outputFormat: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
}

export interface CreateUpscaleJobInput {
  id?: string;
  userId: string;
  scale: 2 | 4;
  inputStoragePath: string;
  inputMimeType: string;
  inputWidth: number;
  inputHeight: number;
  inputSizeBytes: number;
  usageCharged: boolean;
}

export interface UpdateUpscaleJobInput {
  status?: UpscaleJobStatus;
  stage?: UpscaleJobStage;
  progress?: number;
  outputStoragePath?: string | null;
  outputWidth?: number | null;
  outputHeight?: number | null;
  outputFormat?: string | null;
  outputSizeBytes?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  workerId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}
