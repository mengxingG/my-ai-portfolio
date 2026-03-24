"use client";

import React, { useRef } from "react";
import { motion, useReducedMotion, useSpring } from "framer-motion";

type TiltCardProps = {
  children: React.ReactNode;
  className?: string;
  /** Max tilt in degrees */
  tiltMax?: number;
};

/**
 * Smooth 3D tilt toward cursor (Cyber-Executive card interaction).
 */
export function TiltCard({
  children,
  className = "",
  tiltMax = 12,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const rotateX = useSpring(0, { stiffness: 280, damping: 28, mass: 0.6 });
  const rotateY = useSpring(0, { stiffness: 280, damping: 28, mass: 0.6 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 2 * tiltMax);
    rotateX.set(-py * 2 * tiltMax);
  };

  const onLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <div
      ref={ref}
      className={`tilt-card-root ${className}`.trim()}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ perspective: 1400 }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
