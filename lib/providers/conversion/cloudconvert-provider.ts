import { env, isCloudConvertConfigured } from "@/config/env";
import { assertDocxBytes, assertPdfBytes } from "@/lib/image/validate-binary";
import type { DocumentConversionProvider } from "./types";
import { DocumentConversionNotConfiguredError } from "./types";

const CLOUDCONVERT_BASE = "https://api.cloudconvert.com/v2";
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 80;

interface CloudConvertTask {
  id: string;
  name: string;
  status: string;
  message?: string;
  result?: {
    form?: {
      url: string;
      parameters: Record<string, string>;
    };
    files?: Array<{ url?: string; filename?: string }>;
  };
}

interface CloudConvertJob {
  id: string;
  status: string;
  tasks: CloudConvertTask[];
}

function apiHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${env.cloudConvertApiKey}`,
    "Content-Type": "application/json",
  };
}

async function cloudConvertRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${CLOUDCONVERT_BASE}${path}`, {
    ...init,
    headers: {
      ...apiHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `CloudConvert request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

async function waitForJob(jobId: string): Promise<CloudConvertJob> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const payload = await cloudConvertRequest<{ data: CloudConvertJob }>(
      `/jobs/${jobId}`,
    );
    const job = payload.data;

    if (job.status === "finished") {
      return job;
    }

    if (job.status === "error") {
      const failedTask = job.tasks.find((task) => task.status === "error");
      throw new Error(failedTask?.message ?? "CloudConvert conversion failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("CloudConvert conversion timed out.");
}

function getExportUrl(job: CloudConvertJob): string {
  const exportTask = job.tasks.find((task) => task.name === "export");
  const url = exportTask?.result?.files?.[0]?.url;
  if (!url) {
    throw new Error("CloudConvert did not return a download URL.");
  }
  return url;
}

async function downloadExport(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download converted file (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function createConversionJob(
  inputFormat: "pdf" | "docx",
  outputFormat: "pdf" | "docx",
  fileName: string,
  fileBuffer: Buffer,
): Promise<Buffer> {
  const importTaskName = "import-file";
  const convertTaskName = "convert-file";
  const exportTaskName = "export";

  const jobPayload = {
    tasks: {
      [importTaskName]: { operation: "import/upload" },
      [convertTaskName]: {
        operation: "convert",
        input: importTaskName,
        input_format: inputFormat,
        output_format: outputFormat,
      },
      [exportTaskName]: {
        operation: "export/url",
        input: convertTaskName,
      },
    },
    tag: `scanonix-${inputFormat}-to-${outputFormat}`,
  };

  const created = await cloudConvertRequest<{ data: CloudConvertJob }>("/jobs", {
    method: "POST",
    body: JSON.stringify(jobPayload),
  });

  const importTask = created.data.tasks.find((task) => task.name === importTaskName);
  if (!importTask?.id) {
    throw new Error("CloudConvert import task was not created.");
  }

  const uploadTaskDetails = await cloudConvertRequest<{ data: CloudConvertTask }>(
    `/tasks/${importTask.id}`,
  );

  const form = uploadTaskDetails.data.result?.form;
  if (!form?.url) {
    throw new Error("CloudConvert upload form was not returned.");
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(form.parameters)) {
    formData.append(key, value);
  }
  formData.append(
    "file",
    new Blob([new Uint8Array(fileBuffer)]),
    fileName,
  );

  const uploadResponse = await fetch(form.url, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`CloudConvert upload failed (${uploadResponse.status}).`);
  }

  const finishedJob = await waitForJob(created.data.id);
  const downloadUrl = getExportUrl(finishedJob);
  return downloadExport(downloadUrl);
}

export async function convertPdfToDocxCloudConvert(
  input: Buffer,
  fileName: string,
): Promise<Buffer> {
  if (!isCloudConvertConfigured()) {
    throw new DocumentConversionNotConfiguredError();
  }

  const output = await createConversionJob("pdf", "docx", fileName, input);
  assertDocxBytes(output);
  return output;
}

export async function convertDocxToPdfCloudConvert(
  input: Buffer,
  fileName: string,
): Promise<Buffer> {
  if (!isCloudConvertConfigured()) {
    throw new DocumentConversionNotConfiguredError();
  }

  const output = await createConversionJob("docx", "pdf", fileName, input);
  assertPdfBytes(output);
  return Buffer.from(output);
}

export const cloudConvertProvider: DocumentConversionProvider = {
  convertPdfToDocx: convertPdfToDocxCloudConvert,
  convertDocxToPdf: convertDocxToPdfCloudConvert,
};
