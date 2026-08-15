import {
  HOMEPAGE_TOOLS,
  POPULAR_TOOL_IDS,
  type HomepageTool,
} from "@/constants/homepage-tools";

const MAX_MATCHES = 3;
const MIN_MATCH_SCORE = 38;

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "my",
  "this",
  "these",
  "those",
  "to",
  "for",
  "from",
  "with",
  "and",
  "or",
  "in",
  "on",
  "at",
  "is",
  "it",
  "me",
  "i",
  "want",
  "need",
  "help",
  "please",
  "can",
  "you",
  "how",
  "do",
  "some",
  "any",
  "into",
  "using",
  "use",
  "find",
  "looking",
  "look",
  "tool",
  "tools",
]);

const SYNONYM_GROUPS: string[][] = [
  ["pdf", "document", "documents", "doc"],
  ["convert", "change", "transform", "turn", "make"],
  ["merge", "combine", "join", "unite", "append"],
  ["split", "divide", "separate", "extract", "cut"],
  ["compress", "shrink", "reduce", "smaller", "optimize"],
  ["translate", "translation", "language", "translator"],
  ["remove", "delete", "strip", "cut", "erase"],
  ["background", "bg", "backdrop"],
  ["protect", "encrypt", "password", "lock", "secure"],
  ["unlock", "decrypt", "unprotect", "open"],
  ["scan", "check", "analyze", "analyse", "inspect", "test"],
  ["image", "photo", "picture", "pic", "jpg", "jpeg", "png", "webp", "heic"],
  ["text", "ocr", "extract", "recognize", "recognise"],
  ["watermark", "stamp", "label"],
  ["redact", "censor", "blackout", "hide", "blur"],
  ["metadata", "exif", "privacy", "properties"],
  ["website", "url", "site", "domain", "link"],
  ["monitor", "monitoring", "uptime", "watch", "track"],
  ["summarize", "summarise", "summary", "summaries", "tldr"],
  ["qr", "barcode", "qrcode"],
  ["rotate", "turn", "flip", "orientation"],
  ["organize", "reorder", "arrange", "sort", "order"],
  ["resize", "scale", "dimension", "dimensions", "resizer"],
  ["upscale", "enlarge", "enhance", "resolution", "upscaler"],
  ["rewrite", "rephrase", "paraphrase", "improve", "polish"],
  ["word", "docx", "doc"],
  ["sign", "signature", "autograph", "e-sign", "esign"],
  ["crop", "trim", "margins", "clip", "cut"],
];

const TOOL_INTENT_PHRASES: Record<string, string[]> = {
  "merge-pdf": ["merge pdf", "merge pdfs", "combine pdf", "combine pdfs", "join pdf", "join pdfs"],
  "split-pdf": ["split pdf", "divide pdf", "separate pdf", "extract pages from pdf"],
  "compress-pdf": [
    "compress pdf",
    "compress my pdf",
    "shrink pdf",
    "reduce pdf size",
    "make pdf smaller",
    "pdf compressor",
  ],
  "pdf-to-word": [
    "pdf to word",
    "convert pdf to word",
    "pdf to docx",
    "pdf to doc",
    "editable pdf",
  ],
  "word-to-pdf": [
    "word to pdf",
    "docx to pdf",
    "convert word to pdf",
    "document to pdf",
    "doc to pdf",
  ],
  "pdf-to-image": ["pdf to image", "pdf to jpg", "pdf to png", "export pdf pages"],
  "image-to-pdf": [
    "image to pdf",
    "jpg to pdf",
    "png to pdf",
    "photo to pdf",
    "picture to pdf",
    "images to pdf",
  ],
  "rotate-pdf": ["rotate pdf", "turn pdf pages", "flip pdf"],
  "organize-pdf": [
    "organize pdf",
    "reorder pdf pages",
    "arrange pdf pages",
    "delete pdf pages",
    "remove pdf pages",
    "pdf page organizer",
  ],
  "crop-pdf": [
    "crop pdf",
    "trim pdf",
    "trim pdf margins",
    "clip pdf pages",
    "cut pdf margins",
    "pdf crop tool",
  ],
  "sign-pdf": [
    "sign pdf",
    "pdf signature",
    "add signature to pdf",
    "sign document",
    "signature",
    "draw signature",
    "electronic signature",
  ],
  "background-remover": [
    "remove background",
    "remove image background",
    "background remover",
    "transparent background",
    "cut out background",
  ],
  "image-compressor": [
    "compress image",
    "reduce image size",
    "make image smaller",
    "optimize image",
    "image compressor",
  ],
  "image-resizer": [
    "resize image",
    "scale image",
    "change image size",
    "image resizer",
    "image dimensions",
  ],
  "image-upscaler": [
    "upscale image",
    "enlarge image",
    "increase resolution",
    "image upscaler",
    "enhance image",
  ],
  "png-to-jpg": ["png to jpg", "png to jpeg", "convert png to jpg"],
  "jpg-to-png": ["jpg to png", "jpeg to png", "convert jpg to png"],
  "png-to-webp": ["png to webp", "convert png to webp"],
  "jpg-to-webp": ["jpg to webp", "jpeg to webp"],
  "webp-to-jpg": ["webp to jpg", "webp to jpeg"],
  "heic-to-jpg": ["heic to jpg", "iphone photo to jpg", "heic converter"],
  "heic-to-png": ["heic to png"],
  "ai-translate": [
    "translate document",
    "translate text",
    "translate to spanish",
    "translate to french",
    "language translator",
    "translate this document",
  ],
  ocr: ["scan text from image", "extract text", "ocr", "text recognition", "scan text"],
  "ai-summary": ["summarize document", "summarise document", "document summary", "ai summary"],
  "ai-rewrite": [
    "rewrite text",
    "ai rewrite",
    "paraphrase",
    "improve writing",
    "rephrase text",
  ],
  "qr-scanner": ["scan qr code", "qr scanner", "read qr code"],
  "website-scanner": [
    "scan website",
    "website scanner",
    "check url",
    "url security",
    "website security",
  ],
  "website-monitoring": ["monitor website", "website monitoring", "uptime monitor"],
  "protect-pdf": ["protect pdf", "protect my pdf", "password protect pdf", "encrypt pdf", "lock pdf"],
  "unlock-pdf": ["unlock pdf", "remove pdf password", "decrypt pdf"],
  "watermark-pdf": ["watermark pdf", "add watermark", "stamp pdf"],
  "redact-pdf": ["redact pdf", "black out pdf", "hide text in pdf"],
  "metadata-cleaner": ["remove metadata", "strip exif", "clean metadata", "metadata cleaner"],
};

export interface ToolFinderMatch {
  tool: HomepageTool;
  score: number;
  explanation: string;
}

export interface ToolFinderResult {
  matches: ToolFinderMatch[];
  suggestions: HomepageTool[];
  noMatch: boolean;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expandToken(token: string): string[] {
  const expanded = new Set<string>([token]);
  for (const group of SYNONYM_GROUPS) {
    if (group.includes(token)) {
      for (const synonym of group) {
        expanded.add(synonym);
      }
    }
  }
  return [...expanded];
}

function expandTokens(tokens: string[]): string[] {
  const expanded = new Set<string>();
  for (const token of tokens) {
    for (const variant of expandToken(token)) {
      expanded.add(variant);
    }
  }
  return [...expanded];
}

function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const value of a.values()) {
    normA += value * value;
  }
  for (const value of b.values()) {
    normB += value * value;
  }

  for (const [term, valueA] of a) {
    const valueB = b.get(term);
    if (valueB) {
      dot += valueA * valueB;
    }
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function keywordScore(tool: HomepageTool, query: string): number {
  const q = normalize(query);
  const name = normalize(tool.name);
  const description = normalize(tool.description);
  const short = normalize(tool.shortDescription);
  const aliasHaystack = tool.aliases.map(normalize).join(" ");

  if (name === q) return 100;
  if (name.startsWith(q)) return 92;
  if (aliasHaystack.includes(q)) return 88;
  if (name.includes(q)) return 82;
  if (short.includes(q)) return 74;
  if (description.includes(q)) return 64;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const combined = `${name} ${short} ${description} ${aliasHaystack}`;
    if (tokens.every((token) => combined.includes(token))) return 58;
  }

  return 0;
}

function intentScore(toolId: string, query: string): number {
  const phrases = TOOL_INTENT_PHRASES[toolId];
  if (!phrases) return 0;

  const q = normalize(query);
  let best = 0;

  for (const phrase of phrases) {
    const normalizedPhrase = normalize(phrase);
    if (q === normalizedPhrase) {
      best = Math.max(best, 100);
    } else if (q.includes(normalizedPhrase)) {
      best = Math.max(best, 90);
    } else {
      const phraseTokens = tokenize(normalizedPhrase);
      const queryTokens = new Set(tokenize(q));
      const overlap = phraseTokens.filter((token) => queryTokens.has(token)).length;
      if (overlap >= 2 && overlap / phraseTokens.length >= 0.6) {
        best = Math.max(best, 70 + overlap * 5);
      }
    }
  }

  return best;
}

function buildToolSearchText(tool: HomepageTool): string {
  const intentPhrases = TOOL_INTENT_PHRASES[tool.id] ?? [];
  return [
    tool.name,
    tool.shortDescription,
    tool.description,
    tool.category,
    ...tool.aliases,
    ...intentPhrases,
  ].join(" ");
}

function scoreTool(tool: HomepageTool, query: string): number {
  if (!tool.available) return 0;

  const keyword = keywordScore(tool, query);
  const intent = intentScore(tool.id, query);

  const queryTokens = expandTokens(tokenize(query));
  const toolTokens = expandTokens(tokenize(buildToolSearchText(tool)));
  const semantic = cosineSimilarity(termFrequency(queryTokens), termFrequency(toolTokens)) * 100;

  const combined = keyword * 0.45 + intent * 0.4 + semantic * 0.15;

  if (tool.id === "security-scan" && intentScore("website-scanner", query) > 0) {
    return combined * 0.5;
  }

  return combined;
}

function buildExplanation(tool: HomepageTool): string {
  return tool.shortDescription.endsWith(".")
    ? tool.shortDescription
    : `${tool.shortDescription}.`;
}

function getPopularSuggestions(): HomepageTool[] {
  return POPULAR_TOOL_IDS.map((id) => HOMEPAGE_TOOLS.find((tool) => tool.id === id)).filter(
    (tool): tool is HomepageTool => tool !== undefined && tool.available,
  ).slice(0, 3);
}

function getSimilarSuggestions(query: string): HomepageTool[] {
  const queryTokens = new Set(expandTokens(tokenize(query)));
  if (queryTokens.size === 0) {
    return getPopularSuggestions();
  }

  return HOMEPAGE_TOOLS.filter((tool) => tool.available)
    .map((tool) => {
      const toolTokens = expandTokens(tokenize(buildToolSearchText(tool)));
      const overlap = toolTokens.filter((token) => queryTokens.has(token)).length;
      return { tool, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.tool.name.localeCompare(b.tool.name))
    .slice(0, 3)
    .map((entry) => entry.tool);
}

export function findTools(query: string, maxResults = MAX_MATCHES): ToolFinderResult {
  const normalized = normalize(query);
  if (!normalized) {
    return {
      matches: [],
      suggestions: getPopularSuggestions(),
      noMatch: true,
    };
  }

  const ranked = HOMEPAGE_TOOLS.filter((tool) => tool.available)
    .map((tool) => ({
      tool,
      score: scoreTool(tool, normalized),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));

  const deduped: typeof ranked = [];
  const seenNames = new Set<string>();

  for (const entry of ranked) {
    const key = entry.tool.name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    deduped.push(entry);
  }

  const strongMatches = deduped
    .filter((entry) => entry.score >= MIN_MATCH_SCORE)
    .slice(0, maxResults);

  if (strongMatches.length > 0) {
    return {
      matches: strongMatches.map((entry) => ({
        tool: entry.tool,
        score: entry.score,
        explanation: buildExplanation(entry.tool),
      })),
      suggestions: [],
      noMatch: false,
    };
  }

  const weakMatches = deduped.slice(0, maxResults);
  const suggestions = getSimilarSuggestions(normalized);

  if (weakMatches.length > 0) {
    return {
      matches: weakMatches.map((entry) => ({
        tool: entry.tool,
        score: entry.score,
        explanation: buildExplanation(entry.tool),
      })),
      suggestions,
      noMatch: true,
    };
  }

  return {
    matches: [],
    suggestions,
    noMatch: true,
  };
}
