import { useEffect, useMemo } from "react";

/** Create and automatically revoke an object URL for a Blob. */
export function useBlobUrl(blob: Blob | null): string | null {
  const url = useMemo(() => {
    if (!blob) {
      return null;
    }
    return URL.createObjectURL(blob);
  }, [blob]);

  useEffect(() => {
    if (!url) {
      return;
    }
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}
