type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  scope: string;
  message: string;
  level?: LogLevel;
  route?: string;
  error?: string;
  [key: string]: string | number | boolean | undefined;
}

/** Safe structured logging — never log secrets, tokens, or raw request bodies. */
export function logSafe(payload: LogPayload): void {
  const { level = "info", scope, message, ...rest } = payload;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...rest,
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}
