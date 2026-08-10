function isJpeg(buffer: Buffer): boolean {
  return buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function stripJpegMetadata(buffer: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let offset = 0;

  chunks.push(buffer.subarray(0, 2));
  offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break;

    const marker = buffer[offset + 1];
    if (marker === undefined) break;

    if (marker === 0xd9 || marker === 0xda) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    const length = buffer.readUInt16BE(offset + 2);
    const isMetadata =
      marker === 0xe1 || marker === 0xe0 || marker === 0xfe || marker === 0xed;

    if (!isMetadata) {
      chunks.push(buffer.subarray(offset, offset + 2 + length));
    }

    offset += 2 + length;
  }

  return Buffer.concat(chunks);
}

function stripPngMetadata(buffer: Buffer): Buffer {
  const signature = buffer.subarray(0, 8);
  const chunks: Buffer[] = [signature];
  let offset = 8;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;

    const metadataTypes = new Set(["tEXt", "iTXt", "zTXt", "eXIf"]);
    if (!metadataTypes.has(type)) {
      chunks.push(buffer.subarray(offset, chunkEnd));
    }

    offset = chunkEnd;
  }

  return Buffer.concat(chunks);
}

export function cleanImageMetadata(buffer: Buffer, fileName: string): Buffer {
  if (isJpeg(buffer)) {
    return stripJpegMetadata(buffer);
  }

  if (isPng(buffer)) {
    return stripPngMetadata(buffer);
  }

  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return stripJpegMetadata(buffer);
  }

  if (lower.endsWith(".png")) {
    return stripPngMetadata(buffer);
  }

  return buffer;
}

export function detectCleanedContentType(fileName: string, buffer: Buffer): string {
  if (isJpeg(buffer) || fileName.toLowerCase().match(/\.jpe?g$/)) {
    return "image/jpeg";
  }
  if (isPng(buffer) || fileName.toLowerCase().endsWith(".png")) {
    return "image/png";
  }
  if (fileName.toLowerCase().endsWith(".webp")) {
    return "image/webp";
  }
  return "application/octet-stream";
}
