import { spawn } from "node:child_process";

export interface RunProcessOptions {
  command: string;
  args: string[];
  timeoutMs: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export class ProcessTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessTimeoutError";
  }
}

export async function runProcess(options: RunProcessOptions): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    let stdout = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new ProcessTimeoutError(`Process timed out after ${options.timeoutMs}ms`));
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          stderr.trim() ||
            stdout.trim() ||
            `Process exited with code ${code ?? "unknown"}`,
        ),
      );
    });
  });
}
