"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  /** When true, motion is minimal (near-static glass). */
  reducedMotion: boolean;
};

/**
 * Full-viewport WebGL: slow drifting translucent forms + deep blue/black base.
 * Fixed layer; use pointer-events: none — does not capture input.
 */
export function LiquidGlassBackground({ reducedMotion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.FogExp2(0x030818, 0.048);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
    camera.position.set(0, 0.15, 9.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    scene.add(new THREE.AmbientLight(0x1e293b, 0.42));
    const hemi = new THREE.HemisphereLight(0x1e3a5f, 0x040508, 0.52);
    scene.add(hemi);
    const purp = new THREE.DirectionalLight(0x7c3aed, 0.2);
    purp.position.set(5, 5, 6);
    scene.add(purp);
    const blue = new THREE.DirectionalLight(0x2563eb, 0.11);
    blue.position.set(-6, -1, 4);
    scene.add(blue);

    const geo = new THREE.IcosahedronGeometry(1, 3);

    const makeMat = (hue: number) =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setHSL(hue, 0.32, 0.38),
        emissive: new THREE.Color().setHSL(hue + 0.06, 0.45, 0.06),
        emissiveIntensity: 0.32,
        metalness: 0.04,
        roughness: 0.22,
        transmission: 0.9,
        thickness: 1.05,
        ior: 1.47,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        attenuationDistance: 2.8,
        attenuationColor: new THREE.Color(0x12082a),
        clearcoat: 0.18,
        clearcoatRoughness: 0.4,
      });

    type Blob = {
      mesh: THREE.Mesh;
      base: THREE.Vector3;
      phase: [number, number, number];
      speed: number;
    };

    const blobs: Blob[] = [];
    const specs = [
      { x: -2.7, y: 1.05, z: -1.4, sx: 1.2, sy: 0.78, sz: 0.95, hue: 0.58 },
      { x: 3.1, y: -0.75, z: -1.9, sx: 0.92, sy: 0.72, sz: 0.88, hue: 0.62 },
      { x: 0.45, y: 2.1, z: -3.4, sx: 1.4, sy: 0.82, sz: 1.1, hue: 0.54 },
      { x: -1.15, y: -1.55, z: 0.1, sx: 1.0, sy: 0.7, sz: 0.92, hue: 0.6 },
      { x: 2.4, y: 1.7, z: -0.7, sx: 0.72, sy: 0.68, sz: 0.8, hue: 0.57 },
      { x: -3.4, y: -0.35, z: -2.6, sx: 1.22, sy: 0.76, sz: 1.0, hue: 0.59 },
    ];

    for (const p of specs) {
      const mat = makeMat(p.hue);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.scale.set(p.sx, p.sy, p.sz);
      mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      scene.add(mesh);
      blobs.push({
        mesh,
        base: new THREE.Vector3(p.x, p.y, p.z),
        phase: [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28],
        speed: 0.2 + Math.random() * 0.16,
      });
    }

    const setSize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 1 || h < 1) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(container);

    let raf = 0;
    let running = true;
    const t0 = performance.now();
    const motionScale = reducedMotion ? 0.12 : 1;

    const tick = (now: number) => {
      if (!running) return;
      const t = (now - t0) * 0.001;
      blobs.forEach((b) => {
        const s = b.speed * motionScale * 0.16;
        b.mesh.position.x = b.base.x + Math.sin(t * s + b.phase[0]) * 0.4;
        b.mesh.position.y = b.base.y + Math.cos(t * s * 0.84 + b.phase[1]) * 0.33;
        b.mesh.position.z = b.base.z + Math.sin(t * s * 0.58 + b.phase[2]) * 0.26;
        const rs = motionScale;
        b.mesh.rotation.x += 0.000055 * rs;
        b.mesh.rotation.y += 0.000085 * rs;
        b.mesh.rotation.z += 0.000038 * rs;
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onVisibility = () => {
      const vis = document.visibilityState === "visible";
      running = vis;
      if (!vis) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      blobs.forEach((b) => {
        (b.mesh.material as THREE.Material).dispose();
      });
      geo.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 h-full w-full"
      style={{ pointerEvents: "none" }}
      aria-hidden
    />
  );
}
