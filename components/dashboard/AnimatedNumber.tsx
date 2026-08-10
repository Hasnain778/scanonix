"use client";

import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

export function AnimatedNumber({ value, className = "" }: AnimatedNumberProps) {
  const count = useMotionValue(0);
  const display = useTransform(count, (latest) => Math.round(latest).toLocaleString());
  const [text, setText] = useState("0");

  useEffect(() => {
    const controls = animate(count, value, { duration: 0.75, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
  }, [count, value]);

  useEffect(() => {
    const unsubscribe = display.on("change", (latest) => setText(latest));
    return unsubscribe;
  }, [display]);

  return (
    <motion.span className={className} layout>
      {text}
    </motion.span>
  );
}

export function AnimatedText({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={className}
    >
      {value}
    </motion.span>
  );
}
