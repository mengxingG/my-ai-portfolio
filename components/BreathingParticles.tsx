'use client';
import React, { useEffect, useRef } from 'react';

export default function BreathingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    /** 轨迹角速度基础值，整体 ×1.2 相对原先向上漂浮的主观速度约快 20% */
    const SPEED_MULT = 1.2;

    // 粒子类：每颗星沿各自固定椭圆轨道顺时针运动
    class Particle {
      x: number;
      y: number;
      size: number;
      baseSize: number;
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      angle: number;
      angularSpeed: number;
      phase: number;
      breathingSpeed: number;

      constructor(canvasWidth: number, canvasHeight: number) {
        // 轨道中心：贴近视口正中，收窄后更接近「同心」星带
        this.cx = canvasWidth * (0.496 + Math.random() * 0.008);
        this.cy = canvasHeight * (0.496 + Math.random() * 0.008);
        this.rx = Math.random() * canvasWidth * 0.42 + canvasWidth * 0.08;
        this.ry = this.rx * (0.48 + Math.random() * 0.22);
        this.angle = Math.random() * Math.PI * 2;
        // 顺时针：角度递减；角速度在原常见区间上再 ×1.2
        this.angularSpeed =
          (Math.random() * 0.0012 + 0.00035) * SPEED_MULT;
        this.baseSize = Math.random() * 1.5 + 0.5;
        this.size = this.baseSize;
        this.phase = Math.random() * Math.PI * 2;
        this.breathingSpeed = (Math.random() * 0.02 + 0.01) * SPEED_MULT;
        this.x = this.cx + Math.cos(this.angle) * this.rx;
        this.y = this.cy + Math.sin(this.angle) * this.ry;
      }

      update(_canvasHeight: number, time: number) {
        this.angle -= this.angularSpeed;
        this.x = this.cx + Math.cos(this.angle) * this.rx;
        this.y = this.cy + Math.sin(this.angle) * this.ry;

        const oscillation = Math.sin(time * this.breathingSpeed + this.phase);
        this.size = this.baseSize * (1 + 0.2 * oscillation);
        const alpha = 0.1 + 0.7 * (0.5 * (1 + oscillation));
        return alpha;
      }

      draw(ctx: CanvasRenderingContext2D, alpha: number) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const initParticles = () => {
      particles = [];
      // 生成 150 个粒子，数量可以根据需要增减
      for (let i = 0; i < 150; i++) {
        particles.push(new Particle(canvas.width, canvas.height));
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      // 乘以 1.5 让背景稍长一点，防止滚动到底部露馅
      canvas.height = window.innerHeight * 1.5;
      initParticles();
    };

    let time = 0;
    const animate = () => {
      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        const alpha = p.update(canvas.height, time);
        p.draw(ctx, alpha);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      // z-index 设为 0，确保在纯黑背景之上，发光弧线之下或交融
      className="absolute inset-0 z-[0] pointer-events-none opacity-60 mix-blend-screen"
    />
  );
}
