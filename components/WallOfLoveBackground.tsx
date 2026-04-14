"use client";

import React from "react";

export default function WallOfLoveBackground() {
  return (
    <div className="absolute inset-0 z-[-1] pointer-events-none overflow-hidden">
      <svg
        viewBox="0 0 1000 400"
        className="absolute left-1/2 top-[-6%] h-[224px] w-[min(66vw,686px)] -translate-x-1/2"
        aria-hidden
      >
        <defs>
          {/* Reflect-style: deep violet → brighter indigo/lavender → violet (left to right along arc) */}
          <linearGradient
            id="wall-love-outline-gradient"
            x1="40"
            y1="180"
            x2="960"
            y2="180"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#6d28d9" />
            <stop offset="22%" stopColor="#7c3aed" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="78%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          <filter id="wall-love-soft-halo" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
            </feMerge>
          </filter>
          <linearGradient id="wall-love-beam" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(168,85,247,0)" />
            <stop offset="48%" stopColor="#a855f7" />
            <stop offset="52%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="rgba(168,85,247,0)" />
          </linearGradient>
          <linearGradient id="wall-love-beam-secondary" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(216,180,254,0)" />
            <stop offset="50%" stopColor="rgba(233,213,255,0.95)" />
            <stop offset="100%" stopColor="rgba(216,180,254,0)" />
          </linearGradient>
          <filter id="wall-love-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="wall-love-glow-strong" x="-24%" y="-24%" width="148%" height="148%">
            <feGaussianBlur stdDeviation="7.5" result="blurStrong" />
            <feMerge>
              <feMergeNode in="blurStrong" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="wall-love-core" cx="50%" cy="44%" r="58%">
            <stop offset="0%" stopColor="rgba(76,29,149,0.42)" />
            <stop offset="38%" stopColor="rgba(46,16,101,0.28)" />
            <stop offset="65%" stopColor="rgba(30,27,75,0.14)" />
            <stop offset="100%" stopColor="rgba(5,1,13,0)" />
          </radialGradient>
        </defs>

        <ellipse cx="500" cy="255" rx="285" ry="125" fill="url(#wall-love-core)" />

        {/* Outer soft purple halo (diffused glow from the arc) */}
        <path
          d="M 50 350 C 50 100, 450 50, 500 200 C 550 50, 950 100, 950 350"
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.28"
          filter="url(#wall-love-soft-halo)"
        />

        {/* Main visible heart arc: gradient stroke (Reflect wall-of-love style) */}
        <path
          d="M 50 350 C 50 100, 450 50, 500 200 C 550 50, 950 100, 950 350"
          fill="none"
          stroke="url(#wall-love-outline-gradient)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Thin inner highlight for glass edge */}
        <path
          d="M 50 350 C 50 100, 450 50, 500 200 C 550 50, 950 100, 950 350"
          fill="none"
          stroke="rgba(233, 224, 255, 0.26)"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Tracing beam */}
        <path
          className="wall-love-trace"
          d="M 50 350 C 50 100, 450 50, 500 200 C 550 50, 950 100, 950 350"
          fill="none"
          stroke="url(#wall-love-beam)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeDasharray="300 2000"
          strokeDashoffset="2000"
          filter="url(#wall-love-glow-strong)"
        />

        {/* Secondary chase trail: appears intermittently */}
        <path
          className="wall-love-trace-secondary"
          d="M 50 350 C 50 100, 450 50, 500 200 C 550 50, 950 100, 950 350"
          fill="none"
          stroke="url(#wall-love-beam-secondary)"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeDasharray="120 2200"
          strokeDashoffset="2350"
          filter="url(#wall-love-glow)"
        />
      </svg>

      <style jsx>{`
        .wall-love-trace {
          animation: wall-love-flow 5.6s linear infinite;
        }
        .wall-love-trace-secondary {
          opacity: 0;
          animation: wall-love-flow-secondary 8.8s linear infinite;
        }
        @keyframes wall-love-flow {
          from {
            stroke-dashoffset: 2000;
          }
          to {
            stroke-dashoffset: -350;
          }
        }
        @keyframes wall-love-flow-secondary {
          0% {
            stroke-dashoffset: 2350;
            opacity: 0;
          }
          12% {
            opacity: 0;
          }
          20% {
            opacity: 0.85;
          }
          48% {
            opacity: 0.65;
          }
          60% {
            opacity: 0;
          }
          100% {
            stroke-dashoffset: -450;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
