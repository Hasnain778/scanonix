type AuthDebugPayload = Record<string, unknown>;

/** Structured auth flow logging — development only. */
export function logAuthDebug(scope: string, payload: AuthDebugPayload): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      scope: `auth:${scope}`,
      ...payload,
    }),
  );
}

export function formatAuthError(error: {
  message?: string;
  code?: string;
  status?: number;
} | null): AuthDebugPayload {
  if (!error) {
    return { error: null };
  }

  return {
    errorMessage: error.message ?? null,
    errorCode: error.code ?? null,
    errorStatus: error.status ?? null,
  };
}
