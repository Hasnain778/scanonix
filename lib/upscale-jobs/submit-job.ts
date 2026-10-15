import type { ChargeUpscaleJobResult, UpscaleUsageSnapshot } from "@/lib/upscale-jobs/credits";
import { upscaleJobInputPath, storageExtFromMime } from "@/lib/upscale-jobs/paths";
import type { CreateUpscaleJobInput } from "@/lib/upscale-jobs/types";
import type { ImageToolFileInput } from "@/lib/tools/shared/api-handler";

export type UpscaleSubmitResult =
  | { status: "created"; jobId: string }
  | { status: "denied"; usage: UpscaleUsageSnapshot }
  | { status: "create_failed"; message: string }
  | { status: "charge_failed"; message: string }
  | { status: "dispatch_failed"; message: string };

export interface UpscaleSubmitDeps {
  createJobId: () => string;
  uploadInput: (path: string, buffer: Buffer, mimeType: string) => Promise<void>;
  createJob: (input: CreateUpscaleJobInput) => Promise<{ id: string }>;
  chargeJob: (jobId: string) => Promise<ChargeUpscaleJobResult>;
  closeUnchargedJob: (jobId: string, errorCode: string, errorMessage: string) => Promise<string>;
  dispatchJob: (jobId: string) => Promise<void>;
  failChargedJob: (jobId: string, errorCode: string, errorMessage: string) => Promise<string>;
}

const DISPATCH_FAILURE = "Could not start upscaling worker. Please try again.";

/**
 * Creates an uncharged job, charges it once, then dispatches.
 * A denied or failed charge cancels the uncharged job and does not dispatch.
 */
export async function submitPreparedUpscaleJob(
  input: {
    userId: string;
    scale: 2 | 4;
    file: ImageToolFileInput;
    width: number;
    height: number;
  },
  deps: UpscaleSubmitDeps,
): Promise<UpscaleSubmitResult> {
  const jobId = deps.createJobId();
  const inputPath = upscaleJobInputPath(
    input.userId,
    jobId,
    storageExtFromMime(input.file.mimeType),
  );

  try {
    await deps.uploadInput(inputPath, input.file.buffer, input.file.mimeType);
    await deps.createJob({
      id: jobId,
      userId: input.userId,
      scale: input.scale,
      inputStoragePath: inputPath,
      inputMimeType: input.file.mimeType,
      inputWidth: input.width,
      inputHeight: input.height,
      inputSizeBytes: input.file.file.size,
      usageCharged: false,
    });
  } catch (error) {
    return {
      status: "create_failed",
      message: error instanceof Error ? error.message : "Could not create upscale job.",
    };
  }

  let charged = false;
  try {
    const charge = await deps.chargeJob(jobId);
    if (!charge.allowed) {
      if (charge.outcome === "denied") {
        try {
          await deps.closeUnchargedJob(
            jobId,
            "quota_denied",
            "Tool operation limit reached for your current plan.",
          );
        } catch {
          // An uncharged job cannot be claimed. Recovery cancels it later.
        }
        return { status: "denied", usage: charge.usage };
      }

      await deps.closeUnchargedJob(jobId, "charge_rejected", "Upscale job was not charged.");
      return { status: "charge_failed", message: "Could not authorize operation." };
    }
    charged = true;
  } catch (error) {
    let outcome = "not_found";
    try {
      outcome = await deps.closeUnchargedJob(
        jobId,
        "charge_failed",
        "Could not authorize operation.",
      );
    } catch {
      outcome = "not_found";
    }

    if (outcome !== "charged") {
      return {
        status: "charge_failed",
        message: error instanceof Error ? error.message : "Could not authorize operation.",
      };
    }
    charged = true;
  }

  if (!charged) {
    return { status: "charge_failed", message: "Could not authorize operation." };
  }

  try {
    await deps.dispatchJob(jobId);
  } catch (error) {
    try {
      const outcome = await deps.failChargedJob(jobId, "worker_trigger_failed", DISPATCH_FAILURE);
      if (
        outcome === "in_progress" ||
        outcome === "completed" ||
        outcome === "already_completed"
      ) {
        return { status: "created", jobId };
      }
    } catch {
      // Recovery refunds a charged job once it is permanently failed.
    }

    return {
      status: "dispatch_failed",
      message: error instanceof Error ? error.message : DISPATCH_FAILURE,
    };
  }

  return { status: "created", jobId };
}
