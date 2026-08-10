/** Shared Tailwind / CSS class tokens for consistent UI surfaces. */
export const designTokens = {
  surfaceCard: "surface-card",
  surfaceCardInteractive: "glass-card glass-card-interactive",
  glassCard: "glass-card",
  cardPadding: "p-6",
  cardPaddingSm: "p-4 sm:p-5",
  pageStack: "page-stack",
  pageStackLg: "page-stack-lg",
  input: "input-field",
  select: "select-field",
  focusRing: "focus-ring",
  truncateUrl: "truncate-url",
} as const;

export const formTokens = {
  label: "text-label mb-2 block",
  hint: "text-helper mt-2",
  error: "text-helper mt-2 text-red-400",
} as const;
