/**
 * Binary format helpers for regression tests.
 */

export function magicHex(buf, len = 4) {
  return [...buf.slice(0, len)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

export function isPdf(buf) {
  return buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}

export function isJpeg(buf) {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

export function isPng(buf) {
  return buf.length >= 4 && buf.readUInt32BE(0) === 0x89504e47;
}

export function isWebp(buf) {
  return (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

export function isZip(buf) {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

export function hasAlphaChannel(pngBuf) {
  if (!isPng(pngBuf)) return false;
  // IHDR chunk: width(4) height(4) bitDepth(1) colorType(1) — colorType 4 or 6 = alpha
  const ihdr = pngBuf.indexOf("IHDR");
  if (ihdr < 0 || ihdr + 13 >= pngBuf.length) return false;
  const colorType = pngBuf[ihdr + 9];
  return colorType === 4 || colorType === 6;
}

export function safeBodySnippet(body, max = 300) {
  if (typeof body !== "string") return String(body).slice(0, max);
  return body.replace(/Bearer\s+\S+/gi, "[REDACTED]").slice(0, max);
}
