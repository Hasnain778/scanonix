export function createManagedObjectUrl(file: File | Blob): {
  url: string;
  revoke: () => void;
} {
  const url = URL.createObjectURL(file);
  return {
    url,
    revoke: () => URL.revokeObjectURL(url),
  };
}

export function revokeObjectUrls(urls: Iterable<string>): void {
  for (const url of urls) {
    URL.revokeObjectURL(url);
  }
}

export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

export async function blobToText(blob: Blob): Promise<string> {
  return blob.text();
}

export function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}
