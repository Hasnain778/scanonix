import type { MetadataRoute } from "next";
import { INDEXABLE_TOOL_PATHS } from "@/constants/tool-seo";
import { env } from "@/config/env";

const STATIC_INDEXABLE_PATHS = [
  "/",
  "/tools",
  "/pricing",
  "/contact",
  "/privacy",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = env.siteUrl.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = STATIC_INDEXABLE_PATHS.map(
    (path) => ({
      url: `${baseUrl}${path === "/" ? "" : path}`,
      lastModified: now,
      changeFrequency: path === "/" || path === "/tools" ? "weekly" : "monthly",
      priority: path === "/" ? 1 : path === "/tools" ? 0.95 : 0.5,
    }),
  );

  const toolRoutes: MetadataRoute.Sitemap = INDEXABLE_TOOL_PATHS.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "/tools/image" ? 0.92 : 0.8,
  }));

  return [...staticRoutes, ...toolRoutes];
}
