"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

interface SecurityScoreRingProps {
  score: number;
  size?: number;
}

function getScoreColors(securityScore: number) {
  if (securityScore >= 75) {
    return {
      strokeLight: "#047857",
      strokeDark: "#34d399",
      text: "text-emerald-800 dark:text-emerald-300",
    };
  }
  if (securityScore >= 40) {
    return {
      strokeLight: "#b45309",
      strokeDark: "#fbbf24",
      text: "text-amber-900 dark:text-amber-200",
    };
  }
  return {
    strokeLight: "#b91c1c",
    strokeDark: "#f87171",
    text: "text-red-800 dark:text-red-300",
  };
}

export function SecurityScoreRing({ score, size = 136 }: SecurityScoreRingProps) {
  const colors = getScoreColors(score);
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMotionValue(0);
  const strokeOffset = useTransform(
    progress,
    (value) => circumference - (value / 100) * circumference,
  );

  useEffect(() => {
    const controls = animate(progress, score, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [progress, score]);

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      role="img"
      aria-label={`Security score ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {/* Bright track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={9}
          className="dark:hidden"
        />
        {/* Dark track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={9}
          className="hidden dark:block"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.strokeLight}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: strokeOffset }}
          className="dark:hidden"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.strokeDark}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: strokeOffset }}
          className="hidden dark:block"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl ${colors.text}`}
        >
          {score}
        </span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/60">
          Score
        </span>
      </div>
    </div>
  );
}
