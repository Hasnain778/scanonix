import type { MetadataRoute } from "next";
import { env } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.siteUrl.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/dashboard/",
        "/account/",
        "/monitors/",
        "/scan-history/",
        "/scan-results/",
        "/history/",
        "/saved-files/",
        "/login",
        "/register",
        "/auth/",
        "/forgot-password",
        "/reset-password",
        "/billing/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
