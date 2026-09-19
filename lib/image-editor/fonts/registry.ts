/**
 * IE-4B.2 — curated Image Editor font registry.
 * Stable IDs only; CSS stacks and files live here — not in components.
 */

export type EditorFontCategory =
  | "sans"
  | "serif"
  | "display"
  | "handwritten"
  | "mono"
  | "system";

export type EditorFontWeight = "400" | "500" | "700";

export type EditorFontSource = "bundled" | "site" | "system";

export interface EditorFontFaceFile {
  weight: EditorFontWeight;
  /** Path under /public — served as absolute URL. */
  path: string;
}

export interface EditorFontFamily {
  id: string;
  label: string;
  category: EditorFontCategory;
  /** Canvas / CSS font-family primary name. */
  cssFamily: string;
  /** Full canvas-safe stack. */
  stack: string;
  weights: EditorFontWeight[];
  previewWeight: EditorFontWeight;
  source: EditorFontSource;
  license: "OFL-1.1" | "SIL-OFL" | "system" | "site";
  /** Human-readable provenance. */
  provenance: string;
  /** Optional self-hosted faces (empty for system/site Geist). */
  files: EditorFontFaceFile[];
}

/** Category filter chips (excluding internal "system" — shown under native groups). */
export const EDITOR_FONT_CATEGORY_FILTERS: {
  id: EditorFontCategory | "all";
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "sans", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
  { id: "handwritten", label: "Handwritten" },
  { id: "mono", label: "Mono" },
];

function bundled(
  id: string,
  label: string,
  category: EditorFontCategory,
  cssFamily: string,
  weights: EditorFontWeight[],
  previewWeight: EditorFontWeight,
  stackExtra: string,
  provenance: string,
): EditorFontFamily {
  return {
    id,
    label,
    category,
    cssFamily,
    stack: `"${cssFamily}", ${stackExtra}`,
    weights,
    previewWeight,
    source: "bundled",
    license: "OFL-1.1",
    provenance,
    files: weights.map((weight) => ({
      weight,
      path: `/fonts/editor/${id}/${weight}.woff2`,
    })),
  };
}

/**
 * Curated library (~30). Geist uses site next/font; system fonts need no files.
 * Bundled faces are OFL via Google Fonts / Fontsource Latin subsets.
 */
export const EDITOR_FONT_REGISTRY: EditorFontFamily[] = [
  // ── Site (already loaded via next/font) ──────────────────────────
  {
    id: "geist-sans",
    label: "Geist Sans",
    category: "sans",
    cssFamily: "Geist",
    stack: 'Geist, "Geist Sans", system-ui, -apple-system, sans-serif',
    weights: ["400", "500", "700"],
    previewWeight: "500",
    source: "site",
    license: "site",
    provenance: "Vercel Geist via next/font (site-wide)",
    files: [],
  },
  {
    id: "geist-mono",
    label: "Geist Mono",
    category: "mono",
    cssFamily: "Geist Mono",
    stack: '"Geist Mono", ui-monospace, SFMono-Regular, monospace',
    weights: ["400", "500", "700"],
    previewWeight: "500",
    source: "site",
    license: "site",
    provenance: "Vercel Geist Mono via next/font (site-wide)",
    files: [],
  },

  // ── Sans ─────────────────────────────────────────────────────────
  bundled(
    "inter",
    "Inter",
    "sans",
    "Inter",
    ["400", "500", "700"],
    "500",
    "system-ui, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Rasmus Andersson)",
  ),
  bundled(
    "manrope",
    "Manrope",
    "sans",
    "Manrope",
    ["400", "500", "700"],
    "500",
    "system-ui, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Mikhail Sharanda)",
  ),
  bundled(
    "dm-sans",
    "DM Sans",
    "sans",
    "DM Sans",
    ["400", "500", "700"],
    "500",
    "system-ui, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Colophon Foundry)",
  ),
  bundled(
    "poppins",
    "Poppins",
    "sans",
    "Poppins",
    ["400", "500", "700"],
    "500",
    "system-ui, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Indian Type Foundry)",
  ),
  bundled(
    "montserrat",
    "Montserrat",
    "sans",
    "Montserrat",
    ["400", "500", "700"],
    "500",
    "system-ui, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Julieta Ulanovsky)",
  ),
  bundled(
    "outfit",
    "Outfit",
    "sans",
    "Outfit",
    ["400", "500", "700"],
    "500",
    "system-ui, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Rodrigo Fuenzalida)",
  ),
  bundled(
    "nunito-sans",
    "Nunito Sans",
    "sans",
    "Nunito Sans",
    ["400", "500", "700"],
    "500",
    "system-ui, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Vernon Adams et al.)",
  ),
  bundled(
    "work-sans",
    "Work Sans",
    "sans",
    "Work Sans",
    ["400", "500", "700"],
    "500",
    "system-ui, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Wei Huang)",
  ),
  bundled(
    "space-grotesk",
    "Space Grotesk",
    "sans",
    "Space Grotesk",
    ["400", "500", "700"],
    "500",
    "system-ui, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Florian Karsten)",
  ),

  // ── Serif ────────────────────────────────────────────────────────
  bundled(
    "playfair-display",
    "Playfair Display",
    "serif",
    "Playfair Display",
    ["400", "700"],
    "400",
    "Georgia, serif",
    "Google Fonts / Fontsource — OFL-1.1 (Claus Eggers Sørensen)",
  ),
  bundled(
    "lora",
    "Lora",
    "serif",
    "Lora",
    ["400", "500", "700"],
    "400",
    "Georgia, serif",
    "Google Fonts / Fontsource — OFL-1.1 (Cyreal)",
  ),
  bundled(
    "merriweather",
    "Merriweather",
    "serif",
    "Merriweather",
    ["400", "700"],
    "400",
    "Georgia, serif",
    "Google Fonts / Fontsource — OFL-1.1 (Sorkin Type)",
  ),
  bundled(
    "libre-baskerville",
    "Libre Baskerville",
    "serif",
    "Libre Baskerville",
    ["400", "700"],
    "400",
    "Georgia, serif",
    "Google Fonts / Fontsource — OFL-1.1 (Impallari Type)",
  ),
  bundled(
    "dm-serif-display",
    "DM Serif Display",
    "serif",
    "DM Serif Display",
    ["400"],
    "400",
    "Georgia, serif",
    "Google Fonts / Fontsource — OFL-1.1 (Colophon Foundry)",
  ),

  // ── Display ──────────────────────────────────────────────────────
  bundled(
    "bebas-neue",
    "Bebas Neue",
    "display",
    "Bebas Neue",
    ["400"],
    "400",
    "Impact, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Ryoichi Tsunekawa)",
  ),
  bundled(
    "anton",
    "Anton",
    "display",
    "Anton",
    ["400"],
    "400",
    "Impact, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Vernon Adams)",
  ),
  bundled(
    "oswald",
    "Oswald",
    "display",
    "Oswald",
    ["400", "500", "700"],
    "500",
    "Impact, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Vernon Adams / Google)",
  ),
  bundled(
    "archivo-black",
    "Archivo Black",
    "display",
    "Archivo Black",
    ["400"],
    "400",
    "Impact, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (Omnibus-Type)",
  ),
  bundled(
    "bungee",
    "Bungee",
    "display",
    "Bungee",
    ["400"],
    "400",
    "Impact, sans-serif",
    "Google Fonts / Fontsource — OFL-1.1 (David Jonathan Ross)",
  ),
  bundled(
    "alfa-slab-one",
    "Alfa Slab One",
    "display",
    "Alfa Slab One",
    ["400"],
    "400",
    "Impact, serif",
    "Google Fonts / Fontsource — OFL-1.1 (JM Solé)",
  ),

  // ── Handwritten ──────────────────────────────────────────────────
  bundled(
    "caveat",
    "Caveat",
    "handwritten",
    "Caveat",
    ["400", "500", "700"],
    "500",
    "cursive",
    "Google Fonts / Fontsource — OFL-1.1 (Impallari Type)",
  ),
  bundled(
    "pacifico",
    "Pacifico",
    "handwritten",
    "Pacifico",
    ["400"],
    "400",
    "cursive",
    "Google Fonts / Fontsource — OFL-1.1 (Vernon Adams et al.)",
  ),
  bundled(
    "dancing-script",
    "Dancing Script",
    "handwritten",
    "Dancing Script",
    ["400", "500", "700"],
    "500",
    "cursive",
    "Google Fonts / Fontsource — OFL-1.1 (Impallari Type)",
  ),
  bundled(
    "permanent-marker",
    "Permanent Marker",
    "handwritten",
    "Permanent Marker",
    ["400"],
    "400",
    "cursive",
    "Google Fonts / Fontsource — OFL-1.1 (Font Diner)",
  ),
  bundled(
    "kalam",
    "Kalam",
    "handwritten",
    "Kalam",
    ["400", "700"],
    "400",
    "cursive",
    "Google Fonts / Fontsource — OFL-1.1 (Indian Type Foundry)",
  ),

  // ── Mono ─────────────────────────────────────────────────────────
  bundled(
    "space-mono",
    "Space Mono",
    "mono",
    "Space Mono",
    ["400", "700"],
    "400",
    "ui-monospace, monospace",
    "Google Fonts / Fontsource — OFL-1.1 (Colophon Foundry)",
  ),
  bundled(
    "ibm-plex-mono",
    "IBM Plex Mono",
    "mono",
    "IBM Plex Mono",
    ["400", "500", "700"],
    "500",
    "ui-monospace, monospace",
    "Google Fonts / Fontsource — OFL-1.1 (IBM / Bold Monday)",
  ),

  // ── System (legacy + reliable fallbacks) ─────────────────────────
  {
    id: "arial",
    label: "Arial",
    category: "sans",
    cssFamily: "Arial",
    stack: "Arial, Helvetica, sans-serif",
    weights: ["400", "700"],
    previewWeight: "400",
    source: "system",
    license: "system",
    provenance: "OS system font",
    files: [],
  },
  {
    id: "georgia",
    label: "Georgia",
    category: "serif",
    cssFamily: "Georgia",
    stack: 'Georgia, "Times New Roman", Times, serif',
    weights: ["400", "700"],
    previewWeight: "400",
    source: "system",
    license: "system",
    provenance: "OS system font",
    files: [],
  },
  {
    id: "courier",
    label: "Courier New",
    category: "mono",
    cssFamily: "Courier New",
    stack: '"Courier New", Courier, monospace',
    weights: ["400", "700"],
    previewWeight: "400",
    source: "system",
    license: "system",
    provenance: "OS system font",
    files: [],
  },
];

export type EditorFontFamilyId = (typeof EDITOR_FONT_REGISTRY)[number]["id"];

const byId = new Map(EDITOR_FONT_REGISTRY.map((f) => [f.id, f]));

export const DEFAULT_EDITOR_FONT_ID: EditorFontFamilyId = "geist-sans";

export function getFontFamily(
  id: string | null | undefined,
): EditorFontFamily {
  if (id && byId.has(id)) return byId.get(id)!;
  return byId.get(DEFAULT_EDITOR_FONT_ID)!;
}

export function isEditorFontFamilyId(id: string): id is EditorFontFamilyId {
  return byId.has(id);
}

export function listEditorFonts(
  category: EditorFontCategory | "all" = "all",
  query = "",
): EditorFontFamily[] {
  const q = query.trim().toLowerCase();
  return EDITOR_FONT_REGISTRY.filter((f) => {
    if (category !== "all" && f.category !== category) return false;
    if (!q) return true;
    return (
      f.label.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q) ||
      f.cssFamily.toLowerCase().includes(q)
    );
  });
}

export function normalizeFontWeight(
  familyId: string,
  requested: string | number,
): EditorFontWeight {
  const family = getFontFamily(familyId);
  const raw = String(requested);
  if (family.weights.includes(raw as EditorFontWeight)) {
    return raw as EditorFontWeight;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return family.previewWeight;
  // Nearest available weight
  let best = family.weights[0]!;
  let bestDist = Infinity;
  for (const w of family.weights) {
    const d = Math.abs(Number(w) - n);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best;
}

export function getFontStack(id: string): string {
  return getFontFamily(id).stack;
}

export function getWeightLabel(weight: EditorFontWeight): string {
  if (weight === "700") return "Bold";
  if (weight === "500") return "Medium";
  return "Regular";
}

export function registryHasUniqueIds(): boolean {
  const ids = EDITOR_FONT_REGISTRY.map((f) => f.id);
  return new Set(ids).size === ids.length;
}

export function registryHasNoRemoteUrls(): boolean {
  return EDITOR_FONT_REGISTRY.every((f) =>
    f.files.every(
      (file) =>
        file.path.startsWith("/fonts/editor/") && !/^https?:/i.test(file.path),
    ),
  );
}

/** Fontsource package slug for download tooling (bundled only). */
export const FONTSOURCE_PACKAGE_SLUG: Record<string, string> = {
  inter: "inter",
  manrope: "manrope",
  "dm-sans": "dm-sans",
  poppins: "poppins",
  montserrat: "montserrat",
  outfit: "outfit",
  "nunito-sans": "nunito-sans",
  "work-sans": "work-sans",
  "space-grotesk": "space-grotesk",
  "playfair-display": "playfair-display",
  lora: "lora",
  merriweather: "merriweather",
  "libre-baskerville": "libre-baskerville",
  "dm-serif-display": "dm-serif-display",
  "bebas-neue": "bebas-neue",
  anton: "anton",
  oswald: "oswald",
  "archivo-black": "archivo-black",
  bungee: "bungee",
  "alfa-slab-one": "alfa-slab-one",
  caveat: "caveat",
  pacifico: "pacifico",
  "dancing-script": "dancing-script",
  "permanent-marker": "permanent-marker",
  kalam: "kalam",
  "space-mono": "space-mono",
  "ibm-plex-mono": "ibm-plex-mono",
};
