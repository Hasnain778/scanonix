import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const sharpLinuxNativeTraceIncludes = [
  "node_modules/@img/sharp-linux-x64/**/*",
  "node_modules/@img/sharp-libvips-linux-x64/**/*",
] as const;

const nextConfig: NextConfig = {
  // sharp must be traced into serverless output — externalizing breaks libvips on Vercel (130H-2)
  serverExternalPackages: ["@react-pdf/renderer"],
  // Next.js externalizes sharp by default; libvips .so is not statically traced (130H-5)
  outputFileTracingIncludes: {
    "/api/tools/image/compress": [...sharpLinuxNativeTraceIncludes],
    "/api/tools/image/resize": [...sharpLinuxNativeTraceIncludes],
    "/api/tools/background-remover/remove": [...sharpLinuxNativeTraceIncludes],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "pdf-lib",
      "pdfjs-dist",
      "tesseract.js",
      "@imgly/background-removal",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
