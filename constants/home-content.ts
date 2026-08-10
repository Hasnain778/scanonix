export interface TrustStat {
  id: string;
  title: string;
  description: string;
  icon: "toolkit" | "secure" | "fast" | "available";
}

/** Launch-stage trust statistics — update when verified metrics are available. */
export const TRUST_STATS: TrustStat[] = [
  {
    id: "toolkit",
    title: "All-in-one toolkit",
    description: "PDFs, images, AI and file tools",
    icon: "toolkit",
  },
  {
    id: "secure",
    title: "Secure processing",
    description: "Privacy-first workflows",
    icon: "secure",
  },
  {
    id: "fast",
    title: "Fast experience",
    description: "Built for modern devices",
    icon: "fast",
  },
  {
    id: "available",
    title: "Available anywhere",
    description: "Web and Android",
    icon: "available",
  },
];

export interface LaunchTestimonial {
  id: string;
  quote: string;
  label: string;
  initials: string;
  accent: "orange" | "violet" | "cyan";
}

/** Launch-preview testimonials — replace with verified customer quotes when available. */
export const LAUNCH_TESTIMONIALS: LaunchTestimonial[] = [
  {
    id: "preview-1",
    quote:
      "Having PDF, image, AI and security tools in one place makes the workflow much simpler.",
    label: "Product preview feedback",
    initials: "PP",
    accent: "orange",
  },
  {
    id: "preview-2",
    quote:
      "The interface is clean, fast and much easier than switching between several websites.",
    label: "Early user feedback",
    initials: "EU",
    accent: "violet",
  },
  {
    id: "preview-3",
    quote:
      "The combination of productivity and security tools gives Scanonix a unique advantage.",
    label: "Launch preview feedback",
    initials: "LP",
    accent: "cyan",
  },
];
