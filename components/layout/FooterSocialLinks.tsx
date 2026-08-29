import { SOCIAL_LINKS } from "@/constants/social-links";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const SOCIAL_ICON: Record<(typeof SOCIAL_LINKS)[number]["platform"], typeof LinkedInIcon> = {
  LinkedIn: LinkedInIcon,
  GitHub: GitHubIcon,
};

const SOCIAL_LINK_BASE =
  "footer-social-link inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-foreground-muted transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none";

const SOCIAL_LINK_HOVER: Record<(typeof SOCIAL_LINKS)[number]["platform"], string> = {
  LinkedIn:
    "hover:border-[#0A66C2]/55 hover:bg-[#0A66C2]/10 hover:text-[#0A66C2] hover:shadow-[0_0_18px_rgba(10,102,194,0.32)] focus-visible:ring-2 focus-visible:ring-[#0A66C2]/50",
  GitHub:
    "hover:border-scanonix-orange/55 hover:bg-scanonix-orange/10 hover:text-foreground hover:shadow-[0_0_18px_rgba(255,106,0,0.32)] focus-visible:ring-2 focus-visible:ring-scanonix-orange/50",
};

export function FooterSocialLinks() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {SOCIAL_LINKS.map((link) => {
        const Icon = SOCIAL_ICON[link.platform];

        return (
          <a
            key={link.platform}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.ariaLabel}
            className={`${SOCIAL_LINK_BASE} ${SOCIAL_LINK_HOVER[link.platform]}`}
          >
            <Icon className="h-5 w-5" />
          </a>
        );
      })}
    </div>
  );
}
