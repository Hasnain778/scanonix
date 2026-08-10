"use client";

import { motion, useReducedMotion } from "framer-motion";

export const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      delay,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  }),
};

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.01,
    y: -2,
    transition: { duration: 0.18, ease: "easeOut" as const },
  },
};

export const buttonTap = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.99 },
};

export function MotionSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <section className={className}>{children}</section>;
  }

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      custom={delay}
      variants={fadeInUp}
      className={className}
    >
      {children}
    </motion.section>
  );
}
