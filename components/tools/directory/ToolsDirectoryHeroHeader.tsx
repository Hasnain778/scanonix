import {
  TOOLS_DIRECTORY_DESCRIPTION,
  TOOLS_DIRECTORY_H1,
} from "@/lib/tools-directory/page-copy";

/** Server-rendered hero header for /tools — decorative layers + semantic H1. */
export function ToolsDirectoryHeroHeader() {
  return (
    <>
      {/* Layer 1 — background light trails */}
      <div className="tools-directory-light-trails" aria-hidden="true">
        <svg
          className="tools-light-trail-svg"
          viewBox="0 0 1200 280"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="tools-trail-glow" x="-20%" y="-200%" width="140%" height="500%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="tools-trail-gradient-left" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,106,0,0)" />
              <stop offset="8%" stopColor="rgba(255,106,0,0.55)" />
              <stop offset="16%" stopColor="rgba(255,180,100,0.9)" />
              <stop offset="24%" stopColor="rgba(255,133,51,0.45)" />
              <stop offset="34%" stopColor="rgba(255,106,0,0.06)" />
              <stop offset="100%" stopColor="rgba(255,106,0,0)" />
            </linearGradient>
            <linearGradient id="tools-trail-gradient-right" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,106,0,0)" />
              <stop offset="8%" stopColor="rgba(255,106,0,0.5)" />
              <stop offset="16%" stopColor="rgba(255,160,90,0.85)" />
              <stop offset="24%" stopColor="rgba(255,122,69,0.4)" />
              <stop offset="34%" stopColor="rgba(255,106,0,0.05)" />
              <stop offset="100%" stopColor="rgba(255,106,0,0)" />
            </linearGradient>
            <linearGradient id="tools-trail-gradient-left-low" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,106,0,0)" />
              <stop offset="10%" stopColor="rgba(255,106,0,0.35)" />
              <stop offset="20%" stopColor="rgba(255,143,90,0.55)" />
              <stop offset="30%" stopColor="rgba(255,106,0,0.08)" />
              <stop offset="100%" stopColor="rgba(255,106,0,0)" />
            </linearGradient>
            <radialGradient id="tools-trail-flare-gradient">
              <stop offset="0%" stopColor="rgba(255,200,140,0.85)" />
              <stop offset="100%" stopColor="rgba(255,106,0,0)" />
            </radialGradient>
          </defs>
          <path
            className="tools-light-trail-path tools-light-trail-path--left"
            d="M-60,52 Q140,18 320,62 Q420,88 480,120"
          />
          <path
            className="tools-light-trail-path tools-light-trail-path--right"
            d="M1260,78 Q1080,42 900,72 Q780,98 720,128"
          />
          <path
            className="tools-light-trail-path tools-light-trail-path--left-low"
            d="M-40,168 Q160,148 340,178 Q400,192 440,210"
          />
          <circle
            className="tools-light-trail-flare"
            cx="148"
            cy="52"
            r="3.5"
            fill="url(#tools-trail-flare-gradient)"
          />
          <circle
            className="tools-light-trail-flare tools-light-trail-flare--2"
            cx="1052"
            cy="78"
            r="3"
            fill="url(#tools-trail-flare-gradient)"
          />
          <circle
            className="tools-light-trail-flare tools-light-trail-flare--3"
            cx="180"
            cy="168"
            r="2.5"
            fill="url(#tools-trail-flare-gradient)"
          />
        </svg>
      </div>

      {/* Layer 2 — ambient glow */}
      <div className="tools-directory-ambient-glow" aria-hidden="true" />

      {/* Layer 3 — hero content backplate + text */}
      <header className="tools-directory-hero tools-directory-header">
        <div className="tools-hero-content-backplate" aria-hidden="true" />
        <h1 className="text-page-title tools-hero-title">{TOOLS_DIRECTORY_H1}</h1>
        <p className="text-page-description">{TOOLS_DIRECTORY_DESCRIPTION}</p>
      </header>
    </>
  );
}
