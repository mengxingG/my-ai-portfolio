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

    // 粒子类
    class Particle {
      x: number;
      y: number;
      size: number;
      baseSize: number;
      speedY: number;
      phase: number;
      breathingSpeed: number;

      constructor(canvasWidth: number, canvasHeight: number) {
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * canvasHeight;
        this.baseSize = Math.random() * 1.5 + 0.5; // 尺寸随机 0.5~2px
        this.size = this.baseSize;
        this.speedY = Math.random() * 0.15 + 0.05; // 极慢的向上漂浮
        this.phase = Math.random() * Math.PI * 2; // 随机初始相位
        this.breathingSpeed = Math.random() * 0.02 + 0.01; // 呼吸速度
      }

      update(canvasHeight: number, time: number) {
        // 位置移动
        this.y -= this.speedY;
        if (this.y < 0) this.y = canvasHeight; // 飘出顶部后从底部重生

        // 呼吸感透明度变化和尺寸变化
        const oscillation = Math.sin(time * this.breathingSpeed + this.phase);
        
        // 限制透明度在 10% 到 80% 之间来回变化
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
      // 每次重绘前清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
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
