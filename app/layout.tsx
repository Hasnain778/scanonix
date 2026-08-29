import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE } from "@/config/site";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/theme";
import { createOrganizationJsonLd, createPageMetadata } from "@/lib/utils/seo";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Free Online PDF, Image & AI Document Tools | Scanonix",
    description: SITE.description,
    path: "/",
    keywords: [
      "PDF tools",
      "merge PDF",
      "compress PDF",
      "image tools",
      "background remover",
      "OCR",
      "PDF to Word",
      "Word to PDF",
      "AI document tools",
      "Scanonix",
    ],
  }),
  title: {
    default: "Free Online PDF, Image & AI Document Tools | Scanonix",
    template: "%s",
  },
  // Search favicon: app/favicon.ico (Next.js filesystem metadata).
  // Apple touch + Organization schema: /icon.png (large brand asset).
  icons: {
    apple: "/icon.png",
  },
};

const organizationJsonLd = createOrganizationJsonLd();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth overflow-x-clip antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body className="relative flex min-h-full flex-col overflow-x-clip bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
