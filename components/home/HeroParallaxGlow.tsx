"use client";

import { useEffect, useRef, useState } from "react";

export function HeroParallaxGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateEnabled = () => setEnabled(!media.matches);
    updateEnabled();
    media.addEventListener("change", updateEnabled);
    return () => media.removeEventListener("change", updateEnabled);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    function onMove(event: MouseEvent) {
      const section = glowRef.current?.closest(".home-hero");
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      targetX = nx * 28;
      targetY = ny * 18;
    }

    function tick() {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }
      frame = window.requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return (
    <div
      ref={glowRef}
      className="home-hero-parallax pointer-events-none absolute left-1/2 top-[38%] z-[1] h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2"
      aria-hidden="true"
    />
  );
}
