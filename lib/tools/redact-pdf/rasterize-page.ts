/**
 * Node/test entry for secure page rasterization (Phase 125B).
 * Browser client code imports `./rasterize-page.browser` directly.
 */

export {
  createRasterFailureGuard,
  type RasterizeRedactedPageOptions,
  type RasterizedPageResult,
} from "./rasterize-page.browser";

export { rasterizeRedactedPage } from "./rasterize-page.node";
