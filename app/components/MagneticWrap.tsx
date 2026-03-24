"use client";

import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type MagneticWrapProps = {
  children: React.ReactNode;
  /** How far the child follows the cursor (0–1 scale of offset) */
  strength?: number;
  /** Extra hit area around the control (px) */
  padding?: number;
  className?: string;
};

/**
 * Magnetic hover: child subtly follows pointer while cursor is near the control.
 */
export function MagneticWrap({
  children,
  strength = 0.35,
  padding = 56,
  className = "",
}: MagneticWrapProps) {
  const reduce = useReducedMotion();
  const zoneRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const z = zoneRef.current;
    if (!z) return;
    const r = z.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const maxDist = Math.max(r.width, r.height) * 0.85;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const falloff = Math.max(0, 1 - dist / maxDist);
    setOffset({
      x: dx * strength * falloff,
      y: dy * strength * falloff,
    });
  };

  const onLeave = () => setOffset({ x: 0, y: 0 });

  return (
    <div
      ref={zoneRef}
      className={`inline-flex ${className}`.trim()}
      style={{ padding }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <motion.div
        animate={{ x: offset.x, y: offset.y }}
        transition={{ type: "spring" as const, stiffness: 320, damping: 24, mass: 0.4 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
