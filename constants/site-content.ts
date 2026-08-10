import { PLAY_STORE_URL } from "@/config/site";

/** @deprecated Use WORKSPACES — kept for internal tool references */
export const TOOLS = [
  {
    name: "Image to PDF",
    description: "Combine photos into a polished PDF in seconds.",
    icon: "image-pdf",
    slug: "image-to-pdf",
    href: "/tools/image-to-pdf",
    available: true,
  },
  {
    name: "PDF to Image",
    description: "Export every page as high-quality JPG or PNG.",
    icon: "pdf-image",
    slug: "pdf-to-image",
    href: "/tools/pdf-to-image",
    available: true,
  },
  {
    name: "Merge PDF",
    description: "Join multiple PDFs into one organised file.",
    icon: "merge",
    slug: "merge-pdf",
    href: "/tools/merge-pdf",
    available: true,
  },
  {
    name: "Split PDF",
    description: "Extract pages or divide large documents easily.",
    icon: "split",
    slug: "split-pdf",
    href: "/tools/split-pdf",
    available: true,
  },
  {
    name: "Compress PDF",
    description: "Reduce file size without losing readability.",
    icon: "compress",
    slug: "compress-pdf",
    href: "/tools/compress-pdf",
    available: true,
  },
  {
    name: "OCR Text Extraction",
    description: "Turn scanned pages into editable, searchable text.",
    icon: "ocr",
    slug: "ocr",
    href: "/tools/ocr",
    available: true,
  },
  {
    name: "PDF to Word",
    description: "Convert PDFs into editable Word documents.",
    icon: "word",
    slug: "pdf-to-word",
    href: "/tools/pdf-to-word",
    available: true,
  },
  {
    name: "JPG to PNG",
    description: "Switch image formats with crisp quality.",
    icon: "convert",
    slug: "jpg-to-png",
    href: "/tools/jpg-to-png",
    available: true,
  },
  {
    name: "Background Remover",
    description: "Clean up scans and isolate document content.",
    icon: "bg-remove",
    slug: "background-remover",
    href: "/tools/background-remover",
    available: true,
  },
  {
    name: "QR Scanner",
    description: "Scan and decode QR codes from any image.",
    icon: "qr",
    slug: "qr-scanner",
    href: "/tools/qr-scanner",
    available: true,
  },
] as const;

export interface WorkspaceItem {
  name: string;
  href?: string;
  external?: boolean;
  available: boolean;
  badge?: string;
}

export interface Workspace {
  id: string;
  emoji: string;
  name: string;
  description: string;
  accent: string;
  items: WorkspaceItem[];
}

export const WORKSPACES: Workspace[] = [
  {
    id: "document",
    emoji: "📄",
    name: "Document Workspace",
    description:
      "Professional PDF workflows — create, convert, merge, split, and compress with precision.",
    accent: "from-orange-500/25 via-amber-500/10 to-transparent",
    items: [
      { name: "PDF Tools", href: "/tools/image-to-pdf", available: true },
      { name: "OCR", href: "/tools/ocr", available: true },
      { name: "Word", href: "/tools/pdf-to-word", available: true },
      { name: "Merge", href: "/tools/merge-pdf", available: true },
      { name: "Split", href: "/tools/split-pdf", available: true },
      { name: "Compress", href: "/tools/compress-pdf", available: true },
    ],
  },
  {
    id: "image",
    emoji: "🖼",
    name: "Image Workspace",
    description:
      "Transform visuals — remove backgrounds, convert formats, and enhance quality.",
    accent: "from-violet-500/20 via-purple-500/10 to-transparent",
    items: [
      {
        name: "Background Remover",
        href: "/tools/background-remover",
        available: true,
      },
      { name: "JPG to PNG", href: "/tools/jpg-to-png", available: true },
      { name: "Upscaler", available: false, badge: "Soon" },
      { name: "Enhancer", available: false, badge: "Soon" },
      { name: "Resize", available: false, badge: "Soon" },
      { name: "Convert", href: "/tools/pdf-to-image", available: true },
    ],
  },
  {
    id: "ai",
    emoji: "🤖",
    name: "AI Workspace",
    description:
      "Intelligent document understanding powered by on-device and cloud AI.",
    accent: "from-cyan-500/20 via-blue-500/10 to-transparent",
    items: [
      { name: "OCR AI", href: "/tools/ocr", available: true },
      { name: "AI Chat", available: false, badge: "Soon" },
      { name: "Summariser", href: "/tools/ai-summary", available: true },
      { name: "Translator", href: "/tools/ai-translate", available: true },
      { name: "Document Analysis", available: false, badge: "Soon" },
      { name: "Invoice Reader", available: false, badge: "Soon" },
    ],
  },
  {
    id: "mobile",
    emoji: "📱",
    name: "Mobile Workspace",
    description:
      "Take Scanonix everywhere — scan, sync, and manage on the go.",
    accent: "from-emerald-500/20 via-teal-500/10 to-transparent",
    items: [
      {
        name: "Android",
        href: PLAY_STORE_URL,
        external: true,
        available: true,
      },
      { name: "QR Scanner", href: "/tools/qr-scanner", available: true },
      { name: "iPhone", available: false, badge: "Coming Soon" },
      { name: "Cloud Sync", available: false, badge: "Soon" },
    ],
  },
];

export const FEATURES = [
  {
    title: "AI-powered intelligence",
    description:
      "Smart OCR, document analysis, and conversion — powered by models that understand your content.",
    icon: "ocr",
  },
  {
    title: "Privacy-first architecture",
    description:
      "Processing happens locally in your browser whenever possible. Your documents never leave your control.",
    icon: "secure",
  },
  {
    title: "Unified workspaces",
    description:
      "Document, image, AI, and mobile tools in one cohesive platform — no app switching required.",
    icon: "manage",
  },
  {
    title: "Lightning-fast processing",
    description:
      "Optimised pipelines deliver results in seconds, not minutes. Built for professionals who move fast.",
    icon: "scan",
  },
  {
    title: "Enterprise-grade quality",
    description:
      "High-fidelity output for PDFs, images, and exports. Every pixel and every word matters.",
    icon: "convert",
  },
  {
    title: "Cross-platform sync",
    description:
      "Web workspace today. Android app live. iPhone and cloud sync on the horizon.",
    icon: "android",
  },
] as const;

export type PricingTierValue = boolean | string;

export interface PricingComparisonRow {
  feature: string;
  free: PricingTierValue;
  pro: PricingTierValue;
  business: PricingTierValue;
}

export const PRICING_TIERS = [
  {
    id: "free",
    name: "Free",
    price: "£0",
    period: "forever",
    description: "Essential tools to explore the workspace.",
    cta: "Get started free",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "£9.99",
    period: "per month",
    description: "Full power for professionals and power users.",
    cta: "Start Pro trial",
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: "£29.99",
    period: "per user / month",
    description: "Teams, compliance, and priority support.",
    cta: "Contact sales",
    highlighted: false,
  },
] as const;

export const PRICING_COMPARISON: PricingComparisonRow[] = [
  {
    feature: "Document workspace tools",
    free: true,
    pro: true,
    business: true,
  },
  {
    feature: "Image workspace tools",
    free: "Basic",
    pro: true,
    business: true,
  },
  {
    feature: "AI workspace",
    free: "Limited",
    pro: true,
    business: true,
  },
  {
    feature: "Daily processing limit",
    free: "25 files",
    pro: "Unlimited",
    business: "Unlimited",
  },
  {
    feature: "Advanced OCR",
    free: false,
    pro: true,
    business: true,
  },
  {
    feature: "Background removal",
    free: "5 / day",
    pro: "Unlimited",
    business: "Unlimited",
  },
  {
    feature: "Cloud sync",
    free: false,
    pro: true,
    business: true,
  },
  {
    feature: "Team workspaces",
    free: false,
    pro: false,
    business: true,
  },
  {
    feature: "Priority support",
    free: false,
    pro: true,
    business: "Dedicated",
  },
  {
    feature: "SSO & admin controls",
    free: false,
    pro: false,
    business: true,
  },
  {
    feature: "API access",
    free: false,
    pro: "Coming soon",
    business: true,
  },
];

/** @deprecated Use PRICING_TIERS + PRICING_COMPARISON */
export const PRICING_PLANS = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    description: "Essential tools to get started with document scanning.",
    editable: false,
    highlighted: false,
    features: [
      "Basic PDF tools",
      "Limited scans per day",
      "Standard compression",
      "Community support",
    ],
  },
  {
    name: "Premium Monthly",
    price: "£4.99",
    period: "per month",
    description: "Full access to every tool with no daily limits.",
    editable: false,
    highlighted: true,
    features: [
      "All PDF & conversion tools",
      "Unlimited scans",
      "Advanced OCR",
      "Priority processing",
      "No watermarks",
    ],
  },
  {
    name: "Premium Yearly",
    price: "£39.99",
    period: "per year",
    description: "Best value for power users — save over monthly billing.",
    editable: false,
    highlighted: false,
    features: [
      "Everything in Premium Monthly",
      "2 months free vs monthly",
      "Early access to new tools",
      "Premium support",
      "Sync across devices (coming soon)",
    ],
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "What is Scanonix?",
    answer:
      "Scanonix is a free online toolkit for PDF, image, and AI document tasks. Merge, split, compress, convert, OCR, translate, and edit files in your browser — with optional security tools for PDF protection and link checks.",
  },
  {
    question: "Is my data private?",
    answer:
      "Yes. Scanonix is built privacy-first. Web tools process files locally in your browser whenever possible. We do not sell your data, and your documents stay under your control.",
  },
  {
    question: "What workspaces are available today?",
    answer:
      "Document, Image, and Mobile workspaces include live tools you can use right now — PDF tools, OCR, background removal, QR scanning, and more. AI workspace features are rolling out progressively.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Start free with essential tools and daily limits. Pro unlocks unlimited processing, full AI workspace access, and priority support. Business adds team features, SSO, and dedicated support.",
  },
  {
    question: "Is there a mobile app?",
    answer:
      "Yes — Scanonix for Android is available on Google Play with full scanning, conversion, and document management. An iPhone app is in development.",
  },
  {
    question: "Do existing tools still work?",
    answer:
      "Absolutely. Every tool — merge, split, compress, OCR, PDF to Word, background remover, QR scanner, and more — remains fully functional. The redesign is visual and structural; your workflows are unchanged.",
  },
] as const;

export { PLAY_STORE_URL };
