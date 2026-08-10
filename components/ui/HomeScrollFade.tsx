"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

interface HomeScrollFadeProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function HomeScrollFade({
  children,
  className = "",
  delay = 0,
}: HomeScrollFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${visible ? "home-reveal-visible" : "home-reveal-hidden"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
