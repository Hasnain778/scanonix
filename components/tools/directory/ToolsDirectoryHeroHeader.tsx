import {
  TOOLS_DIRECTORY_DESCRIPTION,
  TOOLS_DIRECTORY_H1,
} from "@/lib/tools-directory/page-copy";

/** Server-rendered hero header for /tools — restrained ambience + semantic H1. */
export function ToolsDirectoryHeroHeader() {
  return (
    <>
      <div className="tools-directory-light-trails" aria-hidden="true">
        <svg
          className="tools-light-trail-svg"
          viewBox="0 0 1200 280"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="tools-trail-glow" x="-20%" y="-200%" width="140%" height="500%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="tools-trail-gradient-left" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,106,0,0)" />
              <stop offset="12%" stopColor="rgba(255,106,0,0.35)" />
              <stop offset="22%" stopColor="rgba(255,160,90,0.55)" />
              <stop offset="36%" stopColor="rgba(255,106,0,0.04)" />
              <stop offset="100%" stopColor="rgba(255,106,0,0)" />
            </linearGradient>
            <linearGradient id="tools-trail-gradient-right" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,106,0,0)" />
              <stop offset="12%" stopColor="rgba(255,106,0,0.3)" />
              <stop offset="22%" stopColor="rgba(255,150,80,0.45)" />
              <stop offset="36%" stopColor="rgba(255,106,0,0.03)" />
              <stop offset="100%" stopColor="rgba(255,106,0,0)" />
            </linearGradient>
          </defs>
          <path
            className="tools-light-trail-path tools-light-trail-path--left"
            d="M-60,52 Q140,18 320,62 Q420,88 480,120"
          />
          <path
            className="tools-light-trail-path tools-light-trail-path--right"
            d="M1260,78 Q1080,42 900,72 Q780,98 720,128"
          />
        </svg>
      </div>

      <div className="tools-directory-ambient-glow" aria-hidden="true" />

      <header className="tools-directory-hero tools-directory-header">
        <div className="tools-hero-content-backplate" aria-hidden="true" />
        <h1 className="text-page-title tools-hero-title">{TOOLS_DIRECTORY_H1}</h1>
        <p className="text-page-description">{TOOLS_DIRECTORY_DESCRIPTION}</p>
      </header>
    </>
  );
}
