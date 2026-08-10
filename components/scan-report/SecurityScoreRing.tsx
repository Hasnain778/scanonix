"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

interface SecurityScoreRingProps {
  score: number;
  size?: number;
}

function getScoreColors(securityScore: number) {
  if (securityScore >= 75) {
    return { stroke: "#34d399", text: "text-emerald-300" };
  }
  if (securityScore >= 40) {
    return { stroke: "#fbbf24", text: "text-amber-200" };
  }
  return { stroke: "#f87171", text: "text-red-300" };
}

export function SecurityScoreRing({ score, size = 168 }: SecurityScoreRingProps) {
  const colors = getScoreColors(score);
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMotionValue(0);
  const strokeOffset = useTransform(progress, (value) => circumference - (value / 100) * circumference);

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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={10}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: strokeOffset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-semibold tracking-tight ${colors.text}`}>{score}</span>
        <span className="mt-1 text-sm text-scanonix-muted">Security score</span>
      </div>
    </div>
  );
}
