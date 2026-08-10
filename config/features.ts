/**
 * Feature flags and tier gating.
 * Used by FeatureLock and PremiumBadge — no backend required yet.
 */

export type FeatureTier = "free" | "pro" | "business";

export interface FeatureDefinition {
  id: string;
  name: string;
  tier: FeatureTier;
  /** When false, feature is visible but locked with "Coming soon" */
  enabled: boolean;
}

export const FEATURES_REGISTRY: FeatureDefinition[] = [
  { id: "document-tools", name: "Document tools", tier: "free", enabled: true },
  { id: "image-tools", name: "Image tools", tier: "free", enabled: true },
  { id: "ocr-basic", name: "OCR", tier: "free", enabled: true },
  { id: "background-remover", name: "Background remover", tier: "free", enabled: true },
  { id: "ai-chat", name: "AI Document Chat", tier: "pro", enabled: false },
  { id: "ai-summary", name: "AI PDF Summary", tier: "pro", enabled: true },
  { id: "ai-translate", name: "Translate Document", tier: "pro", enabled: true },
  { id: "cloud-sync", name: "Cloud Sync", tier: "pro", enabled: false },
  { id: "team-workspaces", name: "Team Workspaces", tier: "business", enabled: false },
  { id: "api-access", name: "API Access", tier: "business", enabled: false },
];

export function getFeature(id: string): FeatureDefinition | undefined {
  return FEATURES_REGISTRY.find((f) => f.id === id);
}

export function isFeatureEnabled(id: string): boolean {
  return getFeature(id)?.enabled ?? false;
}

export function requiresPremium(id: string): boolean {
  const feature = getFeature(id);
  return feature ? feature.tier !== "free" : false;
}
