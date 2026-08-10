"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { getRiskScoreColor } from "@/lib/scan-report/utils";

interface RiskScoreRingProps {
  score: number;
  size?: number;
}

export function RiskScoreRing({ score, size = 160 }: RiskScoreRingProps) {
  const colors = getRiskScoreColor(score);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMotionValue(0);
  const strokeOffset = useTransform(progress, (value) => circumference - (value / 100) * circumference);

  useEffect(() => {
    const controls = animate(progress, score, {
      duration: 1,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [progress, score]);

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      role="img"
      aria-label={`Overall risk score ${score} out of 100. ${colors.label}.`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={12}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: strokeOffset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${colors.text}`}>{score}</span>
        <span className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-scanonix-muted">
          Risk score
        </span>
      </div>
    </div>
  );
}
