import {
  HOMEPAGE_TOOLS,
  type HomepageTool,
} from "@/constants/homepage-tools";

const MAX_RESULTS = 8;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function scoreTool(tool: HomepageTool, query: string): number {
  if (!tool.available) return 0;

  const q = normalize(query);
  const name = normalize(tool.name);
  const description = normalize(tool.description);
  const short = normalize(tool.shortDescription);
  const category = normalize(tool.category);
  const aliasHaystack = tool.aliases.map(normalize).join(" ");

  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (aliasHaystack.includes(q)) return 85;
  if (name.includes(q)) return 80;
  if (short.includes(q)) return 70;
  if (description.includes(q)) return 60;
  if (category.includes(q)) return 50;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const combined = `${name} ${short} ${description} ${aliasHaystack}`;
    if (tokens.every((token) => combined.includes(token))) return 55;
  }

  return 0;
}

export function searchHomeTools(query: string): HomepageTool[] {
  const normalized = normalize(query);
  if (!normalized) return [];

  return HOMEPAGE_TOOLS.filter((tool) => tool.available)
    .map((tool) => ({ tool, score: scoreTool(tool, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.tool);
}

export function highlightMatch(text: string, query: string): { before: string; match: string; after: string } | null {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(normalizedQuery);
  if (index === -1) return null;

  return {
    before: text.slice(0, index),
    match: text.slice(index, index + normalizedQuery.length),
    after: text.slice(index + normalizedQuery.length),
  };
}
