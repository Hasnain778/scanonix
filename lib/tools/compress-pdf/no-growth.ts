/**
 * Choose the bytes Compress PDF is allowed to return.
 * Comparison is exact byte length. A candidate is used only when it is
 * strictly smaller than the original. Equal or larger output keeps the
 * original bytes so a download cannot grow.
 */
export function selectNonGrowingPdfBytes(
  original: Uint8Array,
  candidate: Uint8Array,
): Uint8Array {
  if (candidate.byteLength < original.byteLength) {
    return candidate;
  }
  return original;
}
