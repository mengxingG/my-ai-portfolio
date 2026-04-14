"use client";

import React, { useEffect, useRef } from "react";

const SPEED_MULT = 1.2;

/** 流星雨：从区域上方切入，斜向划过（与 BreathingParticles 轨道星独立） */
class Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  maxLife: number;
  life: number;
  tailLen: number;
  canvasH: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasH = canvasHeight;
    this.x = canvasWidth * (0.55 + Math.random() * 0.5);
    this.y = -40 - Math.random() * canvasHeight * 0.25;
    const speed = (7 + Math.random() * 9) * SPEED_MULT;
    const angle = Math.PI * 0.52 + Math.random() * 0.2;
    this.vx = -Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.maxLife = 45 + Math.floor(Math.random() * 35);
    this.life = this.maxLife;
    this.tailLen = 70 + Math.random() * 90;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const t = Math.max(this.life / this.maxLife, 0);
    const nx = -this.vx;
    const ny = -this.vy;
    const len = Math.hypot(nx, ny) || 1;
    const ux = nx / len;
    const uy = ny / len;
    const tx = this.x + ux * this.tailLen * t;
    const ty = this.y + uy * this.tailLen * t;
    const g = ctx.createLinearGradient(this.x, this.y, tx, ty);
    g.addColorStop(0, `rgba(255,255,255,${0.92 * t})`);
    g.addColorStop(0.25, `rgba(216,190,255,${0.55 * t})`);
    g.addColorStop(1, "rgba(168,85,247,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.85 * t})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 1.15, 0, Math.PI * 2);
    ctx.fill();
  }

  get dead() {
    return (
      this.life <= 0 ||
      this.y > this.canvasH + 80 ||
      this.x < -120
    );
  }
}

type MeteorShowerProps = {
  className?: string;
};

/**
 * 铺在 Hero 顶部的流星层：需放在 CosmicPortalHero 之上、前景文案之下（由父级 z-index 控制）。
 */
export default function MeteorShower({ className = "" }: MeteorShowerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let meteors: Meteor[] = [];
    let meteorAccumulator = 0;
    let ro: ResizeObserver | undefined;

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 2 || h < 2) return;
      canvas.width = w;
      canvas.height = h;
      meteors = [];
      meteorAccumulator = 0;
    };

    ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(wrap);
    resize();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      meteorAccumulator += 1;
      if (meteorAccumulator >= 32) {
        meteorAccumulator = 0;
        meteors.push(new Meteor(canvas.width, canvas.height));
        if (Math.random() < 0.28) {
          meteors.push(new Meteor(canvas.width, canvas.height));
          meteors.push(new Meteor(canvas.width, canvas.height));
        }
      }
      meteors.forEach((m) => {
        m.update();
        m.draw(ctx);
      });
      meteors = meteors.filter((m) => !m.dead);

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      ro?.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative h-full min-h-[100px] w-full ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-80 mix-blend-screen"
      />
    </div>
  );
}
