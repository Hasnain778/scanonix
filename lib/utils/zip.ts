import JSZip from "jszip";

export async function createZipBlob(
  files: Array<{ filename: string; blob: Blob }>,
): Promise<Blob> {
  const zip = new JSZip();
  files.forEach(({ filename, blob }) => {
    zip.file(filename, blob);
  });
  return zip.generateAsync({ type: "blob" });
}

export async function extractZipEntries(
  zipBlob: Blob,
): Promise<Array<{ filename: string; blob: Blob }>> {
  const zip = await JSZip.loadAsync(zipBlob);
  const entries = Object.entries(zip.files).filter(([, file]) => !file.dir);

  return Promise.all(
    entries.map(async ([filename, file]) => ({
      filename,
      blob: await file.async("blob"),
    })),
  );
}
