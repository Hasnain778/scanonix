import type { LucideIcon } from "lucide-react";
import {
  Bot,
  FileImage,
  FileText,
  Globe,
  Languages,
  Layers,
  Minimize2,
  MonitorDot,
  ScanLine,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { SCANONIX_TOOLS } from "@/constants/tools-directory-data";

export type HomeToolFilter = "all" | "pdf" | "ai" | "image" | "security";

export interface HomeToolEntry {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  filter: HomeToolFilter;
  featured?: boolean;
}

const DIRECTORY_LOOKUP = new Map(SCANONIX_TOOLS.map((tool) => [tool.id, tool]));

const ICON_BY_ID: Record<string, LucideIcon> = {
  "merge-pdf": Layers,
  "compress-pdf": Minimize2,
  "pdf-to-word": FileText,
  "image-to-pdf": FileImage,
  "ai-summary": Sparkles,
  "ai-translate": Languages,
  "background-remover": WandSparkles,
  "png-to-jpg": FileImage,
  "jpg-to-webp": FileImage,
  "heic-to-jpg": FileImage,
};

function fromDirectory(
  id: string,
  filter: HomeToolFilter,
  icon?: LucideIcon,
  featured = false,
): HomeToolEntry {
  const tool = DIRECTORY_LOOKUP.get(id);
  if (!tool) {
    throw new Error(`Missing tool directory entry: ${id}`);
  }

  return {
    id,
    name: tool.name,
    description: tool.description,
    href: tool.href,
    icon: icon ?? ICON_BY_ID[id] ?? FileText,
    filter,
    featured,
  };
}

const CUSTOM_TOOLS: HomeToolEntry[] = [
  {
    id: "website-scanner",
    name: "Website Scanner",
    description: "Scan any URL for malware, phishing, and security risks.",
    href: "/tools/security-scan?type=website",
    icon: Globe,
    filter: "security",
    featured: true,
  },
  {
    id: "ai-threat-analysis",
    name: "AI Threat Analysis",
    description: "Review scan results with AI-powered risk interpretation.",
    href: "/tools/security-scan",
    icon: ScanLine,
    filter: "security",
    featured: true,
  },
  {
    id: "website-monitoring",
    name: "Website Monitoring",
    description: "Track sites over time and get alerts when issues appear.",
    href: "/monitors",
    icon: MonitorDot,
    filter: "security",
    featured: true,
  },
  {
    id: "ai-assistant",
    name: "AI Assistant",
    description: "Ask questions about your scans and get guided next steps.",
    href: "/tools/security-scan",
    icon: Bot,
    filter: "ai",
    featured: true,
  },
];

export const HOME_TOOL_FILTERS = [
  { id: "all" as const, label: "All Tools" },
  { id: "pdf" as const, label: "PDF" },
  { id: "ai" as const, label: "AI" },
  { id: "image" as const, label: "Image" },
  { id: "security" as const, label: "Security" },
];

const FEATURED_IDS: Record<Exclude<HomeToolFilter, "all">, string[]> = {
  pdf: ["merge-pdf", "compress-pdf", "pdf-to-word", "image-to-pdf"],
  ai: ["ai-summary", "ai-translate", "ai-assistant"],
  image: ["background-remover", "png-to-jpg", "jpg-to-webp", "heic-to-jpg"],
  security: [
    "website-scanner",
    "ai-threat-analysis",
    "website-monitoring",
  ],
};

function buildFeaturedTools(): HomeToolEntry[] {
  const pdf = FEATURED_IDS.pdf.map((id) => fromDirectory(id, "pdf", undefined, true));
  const ai = [
    fromDirectory("ai-summary", "ai", Sparkles, true),
    fromDirectory("ai-translate", "ai", Languages, true),
    CUSTOM_TOOLS.find((tool) => tool.id === "ai-assistant")!,
  ];
  const image = FEATURED_IDS.image.map((id) =>
    fromDirectory(id, "image", undefined, true),
  );
  const security = CUSTOM_TOOLS.filter((tool) => tool.filter === "security");

  return [...pdf, ...ai, ...image, ...security];
}

const ALL_HOME_TOOLS: HomeToolEntry[] = [
  ...buildFeaturedTools(),
  ...SCANONIX_TOOLS.filter(
    (tool) =>
      ![
        ...FEATURED_IDS.pdf,
        ...FEATURED_IDS.ai.filter((id) => id !== "ai-assistant"),
        ...FEATURED_IDS.image,
        "security-scan",
      ].includes(tool.id),
  ).map((tool) => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    href: tool.href,
    icon: ICON_BY_ID[tool.id] ?? FileText,
    filter: mapDirectoryCategory(tool.category),
    featured: false,
  })),
];

function mapDirectoryCategory(
  category: string,
): Exclude<HomeToolFilter, "all"> {
  if (category === "pdf") return "pdf";
  if (category === "image") return "image";
  if (category === "ocr-ai") return "ai";
  return "security";
}

export function getHomeToolsForFilter(filter: HomeToolFilter): HomeToolEntry[] {
  if (filter === "all") {
    return ALL_HOME_TOOLS.filter((tool) => tool.featured);
  }

  const featuredIds = new Set(FEATURED_IDS[filter]);
  const featured = ALL_HOME_TOOLS.filter(
    (tool) => tool.filter === filter && featuredIds.has(tool.id),
  );
  const compact = ALL_HOME_TOOLS.filter(
    (tool) =>
      tool.filter === filter &&
      !featuredIds.has(tool.id) &&
      !tool.featured,
  );

  const orderedFeatured = FEATURED_IDS[filter]
    .map((id) => featured.find((tool) => tool.id === id))
    .filter((tool): tool is HomeToolEntry => tool !== undefined);

  return [...orderedFeatured, ...compact];
}
