/** Official Scanonix social profiles — footer and marketing surfaces. */

export type SocialLink = {
  platform: "LinkedIn" | "GitHub";
  label: string;
  href: string;
  ariaLabel: string;
};

export const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    platform: "LinkedIn",
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/scanonix/",
    ariaLabel: "Scanonix on LinkedIn",
  },
  {
    platform: "GitHub",
    label: "GitHub",
    href: "https://github.com/Scanonix",
    ariaLabel: "Scanonix on GitHub",
  },
] as const;
