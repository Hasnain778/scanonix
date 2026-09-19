/**
 * Conservative deterministic query clustering for tool intent (SEO-AUTO-2).
 * Not an NLP system — token/family rules only. Preserves original queries.
 */

export interface QueryClusterMember {
  query: string;
  impressions: number;
  clicks?: number;
  position?: number;
}

export interface QueryCluster {
  id: string;
  family: string;
  label: string;
  members: QueryClusterMember[];
  totalImpressions: number;
  totalClicks: number;
}

const FAMILY_RULES: Array<{
  family: string;
  label: string;
  /** All tokens must appear (after normalization) OR regex matches. */
  requireAny: RegExp[];
}> = [
  {
    family: "ocr",
    label: "OCR / scan-to-text",
    requireAny: [
      /\bocr\b/,
      /\bscan(?:ned|ning)?\s+(?:to\s+)?text\b/,
      /\bscan\s+and\s+(?:ocr|recognize|recognise)\b/,
      /\boptical\s+character\b/,
      /\btext\s+extraction\b/,
      /\bextract(?:ion)?\s+text\b/,
    ],
  },
  {
    family: "pdf-to-word",
    label: "PDF to Word / DOCX",
    requireAny: [
      /\bpdf\s+to\s+word\b/,
      /\bpdf\s+to\s+docx\b/,
      /\bconvert\s+pdf\s+to\s+word\b/,
      /\bword\s+from\s+pdf\b/,
    ],
  },
  {
    family: "word-to-pdf",
    label: "Word to PDF",
    requireAny: [/\bword\s+to\s+pdf\b/, /\bdocx\s+to\s+pdf\b/],
  },
  {
    family: "image-svg-vector",
    label: "Image / logo to SVG / vector",
    requireAny: [
      /\bimage\s+to\s+svg\b/,
      /\blogo\s+to\s+(?:svg|vector)\b/,
      /\braster\s+to\s+vector\b/,
      /\bvectoriz/,
      /\bsvg\s+converter\b/,
    ],
  },
  {
    family: "ai-translate",
    label: "AI / document translate",
    requireAny: [
      /\bai\s+translat/,
      /\btranslat(?:e|or|ion)\b.*\b(?:pdf|document|text)\b/,
      /\b(?:pdf|document|text)\b.*\btranslat/,
    ],
  },
  {
    family: "image-editor",
    label: "Image editor / photo edit",
    requireAny: [
      /\bimage\s+editor\b/,
      /\bphoto\s+editor\b/,
      /\bedit\s+(?:image|photo)s?\b/,
    ],
  },
];

export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(normalized: string): Set<string> {
  return new Set(normalized.split(" ").filter((t) => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function matchFamily(normalized: string): { family: string; label: string } | undefined {
  for (const rule of FAMILY_RULES) {
    if (rule.requireAny.some((re) => re.test(normalized))) {
      return { family: rule.family, label: rule.label };
    }
  }
  return undefined;
}

/**
 * Cluster queries into intent families + residual similarity groups.
 * Original query strings are preserved on each member.
 */
export function clusterQueries(
  rows: Array<{
    query: string;
    impressions: number;
    clicks?: number;
    position?: number;
  }>,
): QueryCluster[] {
  const prepared = rows
    .filter((r) => r.query.trim().length > 0)
    .map((r) => ({
      ...r,
      normalized: normalizeQuery(r.query),
      tokens: tokenize(normalizeQuery(r.query)),
    }));

  const clusters: QueryCluster[] = [];
  const assigned = new Set<number>();

  // Pass 1 — family rules
  for (const rule of FAMILY_RULES) {
    const members: QueryClusterMember[] = [];
    prepared.forEach((row, index) => {
      if (assigned.has(index)) return;
      if (rule.requireAny.some((re) => re.test(row.normalized))) {
        assigned.add(index);
        members.push({
          query: row.query,
          impressions: row.impressions,
          clicks: row.clicks,
          position: row.position,
        });
      }
    });
    if (members.length > 0) {
      clusters.push({
        id: `family:${rule.family}`,
        family: rule.family,
        label: rule.label,
        members: members.sort((a, b) => b.impressions - a.impressions),
        totalImpressions: members.reduce((s, m) => s + m.impressions, 0),
        totalClicks: members.reduce((s, m) => s + (m.clicks ?? 0), 0),
      });
    }
  }

  // Pass 2 — residual token similarity (Jaccard ≥ 0.5)
  prepared.forEach((row, index) => {
    if (assigned.has(index)) return;
    const members: QueryClusterMember[] = [
      {
        query: row.query,
        impressions: row.impressions,
        clicks: row.clicks,
        position: row.position,
      },
    ];
    assigned.add(index);

    prepared.forEach((other, j) => {
      if (assigned.has(j)) return;
      if (jaccard(row.tokens, other.tokens) >= 0.5) {
        assigned.add(j);
        members.push({
          query: other.query,
          impressions: other.impressions,
          clicks: other.clicks,
          position: other.position,
        });
      }
    });

    const familyHit = matchFamily(row.normalized);
    const family = familyHit?.family ?? `residual:${row.normalized.split(" ").slice(0, 3).join("-") || "misc"}`;
    clusters.push({
      id: `cluster:${family}:${clusters.length}`,
      family,
      label: familyHit?.label ?? `Related: ${row.query}`,
      members: members.sort((a, b) => b.impressions - a.impressions),
      totalImpressions: members.reduce((s, m) => s + m.impressions, 0),
      totalClicks: members.reduce((s, m) => s + (m.clicks ?? 0), 0),
    });
  });

  return clusters.sort((a, b) => b.totalImpressions - a.totalImpressions);
}
