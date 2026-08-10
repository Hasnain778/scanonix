import { triggerRunPodPollOnce } from "./runpod-trigger";
import { updateJob } from "./repository";

const WORKER_TRIGGER_ERROR_MESSAGE =
  "Could not start upscaling worker. Please try again.";

export async function triggerUpscaleWorkerAfterJobCreated(jobId: string): Promise<void> {
  const triggered = await triggerRunPodPollOnce();

  if (triggered.ok) {
    return;
  }

  console.error(
    "[upscale-jobs] RunPod poll_once trigger failed for job %s: %s",
    jobId,
    triggered.message,
  );

  try {
    await updateJob(jobId, {
      status: "failed",
      stage: "queued",
      errorCode: "worker_trigger_failed",
      errorMessage: WORKER_TRIGGER_ERROR_MESSAGE,
      completedAt: new Date().toISOString(),
    });
  } catch (updateError) {
    console.error(
      "[upscale-jobs] Failed to mark job %s failed after RunPod trigger error: %s",
      jobId,
      updateError instanceof Error ? updateError.message : String(updateError),
    );
  }

  throw new Error(WORKER_TRIGGER_ERROR_MESSAGE);
}
