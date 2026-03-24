"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  reducedMotion: boolean;
};

const PURPLE = 0xc084fc;
const PURPLE_HOT = 0xe879f9;
const PURPLE_DIM = 0x7c3aed;
const DEEP_BLUE = 0x020617;
const FOG_COLOR = 0x030712;

const pointVertexShader = `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  varying float vViewZ;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewZ = -mvPosition.z;
    float scale = 520.0 / max(vViewZ, 0.35);
    gl_PointSize = size * scale;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const pointFragmentShader = `
  varying vec3 vColor;
  varying float vViewZ;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float r = length(c);
    if (r > 0.5) discard;
    float rim = 1.0 - smoothstep(0.06, 0.5, r);
    float core = pow(max(0.0, 1.0 - r * 2.4), 2.2);
    float glow = rim * 0.72 + core * 1.15;
    float fog = exp(-uFogDensity * vViewZ);
    vec3 col = vColor * glow * (0.42 + 0.58 * fog);
    float alpha = clamp(glow * (0.38 + 0.55 * fog), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

function makeSoftPointTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(255,255,255,0.5)");
  g.addColorStop(0.5, "rgba(255,255,255,0.1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type StreamDef = {
  indices: number[];
  tension: number;
  color: number;
  baseOpacity: number;
  segments: number;
  flowScale: number;
};

/** Uniform curve parameter in [0,1]; avoids CatmullRom getPointAt arc-length issues when arc-lengths degenerate. */
function curveParamT(u: number): number {
  let x = u % 1;
  if (x < 0) x += 1;
  return Math.min(1, Math.max(0, x));
}

/**
 * Dynamic data-viz: deep volumetric point cloud, fine plexus, animated workflow streams.
 * Fixed z-0; pointer-events none.
 */
export function AgenticPlexusBackground({ reducedMotion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(DEEP_BLUE);
    const fogDensity = 0.0175;
    scene.fog = new THREE.FogExp2(FOG_COLOR, fogDensity);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.06, 220);
    camera.position.set(0, 0.55, 28);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const motion = reducedMotion ? 0.16 : 1;

    const fogCol = new THREE.Color(FOG_COLOR);

    scene.add(new THREE.AmbientLight(0x1a0f2a, 0.32));
    const hemi = new THREE.HemisphereLight(0x3d2a5c, 0x020308, 0.48);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xa78bfa, 0.22);
    key.position.set(8, 10, 14);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x312e81, 0.12);
    fill.position.set(-10, -4, 8);
    scene.add(fill);

    const clusterCenters: THREE.Vector3[] = [
      new THREE.Vector3(-11, 1.4, -16),
      new THREE.Vector3(-4.2, -1.1, -24),
      new THREE.Vector3(3, 2.4, -32),
      new THREE.Vector3(10.5, 0.5, -26),
      new THREE.Vector3(4.5, 4.2, -14),
      new THREE.Vector3(13, -2, -20),
      new THREE.Vector3(6, -3.5, -10),
    ];

    const hubLights: THREE.PointLight[] = [];
    clusterCenters.forEach((c, i) => {
      const pl = new THREE.PointLight(i % 2 === 0 ? PURPLE_HOT : PURPLE_DIM, 0.62, 52, 1.9);
      pl.position.copy(c);
      scene.add(pl);
      hubLights.push(pl);
    });

    const PER_CLUSTER = 88;
    const BG_COUNT = 380;
    const n = clusterCenters.length * PER_CLUSTER + BG_COUNT;

    const clusterId = new Int16Array(n);
    const local = new Float32Array(n * 3);
    const phase = new Float32Array(n * 3);
    const weight = new Float32Array(n);

    let idx = 0;
    const rng = () => Math.random();
    const gauss = () => (rng() + rng() + rng() + rng() - 2) * 0.55;

    clusterCenters.forEach((center, cid) => {
      const spread = cid % 3 === 0 ? 3.1 : 2.35;
      for (let k = 0; k < PER_CLUSTER; k++) {
        clusterId[idx] = cid;
        local[idx * 3] = gauss() * spread;
        local[idx * 3 + 1] = gauss() * spread * 0.9;
        local[idx * 3 + 2] = gauss() * spread;
        phase[idx * 3] = rng() * Math.PI * 2;
        phase[idx * 3 + 1] = rng() * Math.PI * 2;
        phase[idx * 3 + 2] = rng() * Math.PI * 2;
        weight[idx] = 0.62 + rng() * 0.38;
        idx++;
      }
    });

    for (let k = 0; k < BG_COUNT; k++) {
      clusterId[idx] = -1;
      const t = rng() * Math.PI * 2;
      const u = rng() * 2 - 1;
      const r = 16 + rng() * 42;
      local[idx * 3] = Math.cos(t) * Math.sqrt(Math.max(0, 1 - u * u)) * r;
      local[idx * 3 + 1] = u * r * 0.82;
      local[idx * 3 + 2] = -10 - rng() * 48;
      phase[idx * 3] = rng() * Math.PI * 2;
      phase[idx * 3 + 1] = rng() * Math.PI * 2;
      phase[idx * 3 + 2] = rng() * Math.PI * 2;
      weight[idx] = 0.2 + rng() * 0.4;
      idx++;
    }

    const world = new Float32Array(n * 3);
    const centerVel = clusterCenters.map(
      () =>
        new THREE.Vector3((rng() - 0.5) * 0.14, (rng() - 0.5) * 0.11, (rng() - 0.5) * 0.09)
    );
    const centerBase = clusterCenters.map((c) => c.clone());

    function distSq(ai: number, bi: number): number {
      const ax = world[ai * 3];
      const ay = world[ai * 3 + 1];
      const az = world[ai * 3 + 2];
      const bx = world[bi * 3];
      const by = world[bi * 3 + 1];
      const bz = world[bi * 3 + 2];
      const dx = ax - bx;
      const dy = ay - by;
      const dz = az - bz;
      return dx * dx + dy * dy + dz * dz;
    }

    function computeWorld(time: number): void {
      clusterCenters.forEach((c, i) => {
        const s = motion * 0.42;
        c.x = centerBase[i].x + Math.sin(time * 0.13 + i) * 1.05 * s + centerVel[i].x * time * 0.09;
        c.y = centerBase[i].y + Math.cos(time * 0.095 + i * 0.72) * 0.78 * s + centerVel[i].y * time * 0.065;
        c.z = centerBase[i].z + Math.sin(time * 0.075 + i * 1.08) * 0.62 * s + centerVel[i].z * time * 0.055;
        hubLights[i].position.copy(c);
        hubLights[i].intensity = (0.48 + Math.sin(time * 0.42 + i * 0.35) * 0.18 * motion) * (0.85 + i * 0.02);
      });

      const wob = motion * 0.26;
      for (let i = 0; i < n; i++) {
        const cid = clusterId[i];
        const lx = local[i * 3];
        const ly = local[i * 3 + 1];
        const lz = local[i * 3 + 2];
        const px = phase[i * 3];
        const py = phase[i * 3 + 1];
        const pz = phase[i * 3 + 2];
        let wx: number;
        let wy: number;
        let wz: number;
        if (cid >= 0) {
          const cc = clusterCenters[cid];
          wx =
            cc.x +
            lx +
            Math.sin(time * 0.58 + px) * wob * weight[i] +
            Math.sin(time * 0.33 + py * 2) * 0.09 * wob;
          wy =
            cc.y +
            ly +
            Math.cos(time * 0.5 + py) * wob * weight[i] * 0.92 +
            Math.sin(time * 0.29 + pz) * 0.075 * wob;
          wz =
            cc.z +
            lz +
            Math.sin(time * 0.43 + pz) * wob * weight[i] +
            Math.cos(time * 0.35 + px) * 0.065 * wob;
        } else {
          wx =
            lx +
            Math.sin(time * 0.19 + px) * 0.38 * motion +
            Math.sin(time * 0.12 + py) * 0.22 * motion;
          wy =
            ly +
            Math.cos(time * 0.17 + py) * 0.3 * motion +
            Math.sin(time * 0.125 + pz) * 0.16 * motion;
          wz = lz + Math.sin(time * 0.15 + pz) * 0.48 * motion;
        }
        world[i * 3] = wx;
        world[i * 3 + 1] = wy;
        world[i * 3 + 2] = wz;
      }
    }

    computeWorld(0);

    const edgeSet = new Set<string>();
    const addEdge = (a: number, b: number) => {
      if (a === b) return;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      edgeSet.add(`${lo},${hi}`);
    };

    const LOCAL_LINK = 2.05;
    const LOCAL_SQ = LOCAL_LINK * LOCAL_LINK;
    const MAX_LOCAL = 6;

    for (let i = 0; i < n; i++) {
      if (clusterId[i] < 0) continue;
      const neigh: { j: number; d: number }[] = [];
      for (let j = 0; j < n; j++) {
        if (i === j || clusterId[j] !== clusterId[i]) continue;
        const d = distSq(i, j);
        if (d < LOCAL_SQ && d > 1e-4) neigh.push({ j, d });
      }
      neigh.sort((u, v) => u.d - v.d);
      for (let k = 0; k < Math.min(MAX_LOCAL, neigh.length); k++) addEdge(i, neigh[k].j);
    }

    const pointsByCluster: number[][] = clusterCenters.map(() => []);
    for (let i = 0; i < n; i++) {
      if (clusterId[i] >= 0) pointsByCluster[clusterId[i]].push(i);
    }

    const workflowPairs: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
      [3, 5],
      [2, 6],
      [4, 3],
      [0, 4],
      [5, 6],
      [6, 3],
    ];
    for (const [ca, cb] of workflowPairs) {
      const A = pointsByCluster[ca];
      const B = pointsByCluster[cb];
      for (let t = 0; t < 22; t++) {
        addEdge(A[Math.floor(rng() * A.length)], B[Math.floor(rng() * B.length)]);
      }
    }

    const edges = Array.from(edgeSet).map((s) => {
      const [a, b] = s.split(",").map(Number);
      return [a, b] as [number, number];
    });

    const linePos = new Float32Array(edges.length * 2 * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: PURPLE_DIM,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const plexusLines = new THREE.LineSegments(lineGeo, lineMat);

    const streamDefs: StreamDef[] = [
      { indices: [0, 1, 2, 3, 5], tension: 0.32, color: 0xd8b4fe, baseOpacity: 0.52, segments: 72, flowScale: 0.032 },
      { indices: [1, 4, 3], tension: 0.38, color: PURPLE, baseOpacity: 0.42, segments: 48, flowScale: 0.026 },
      { indices: [2, 6, 5], tension: 0.36, color: 0xe9d5ff, baseOpacity: 0.38, segments: 44, flowScale: 0.028 },
      { indices: [0, 4, 2, 6], tension: 0.34, color: 0xc4b5fd, baseOpacity: 0.36, segments: 56, flowScale: 0.024 },
    ];

    type StreamObj = {
      curve: THREE.CatmullRomCurve3;
      ctrl: THREE.Vector3[];
      positions: Float32Array;
      geometry: THREE.BufferGeometry;
      material: THREE.LineBasicMaterial;
      line: THREE.Line;
      def: StreamDef;
    };

    const streams: StreamObj[] = streamDefs.map((def) => {
      const ctrl = def.indices.map(() => new THREE.Vector3());
      const curve = new THREE.CatmullRomCurve3(ctrl, false, "catmullrom", def.tension);
      const positions = new Float32Array(def.segments * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: def.baseOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      return { curve, ctrl, positions, geometry, material, line, def };
    });
    const RUNNERS = 56;
    const runnerPos = new Float32Array(RUNNERS * 3);
    const runnerPhase = new Float32Array(RUNNERS);
    const runnerSpeed = new Float32Array(RUNNERS);
    const runnerStream = new Int16Array(RUNNERS);
    for (let i = 0; i < RUNNERS; i++) {
      runnerPhase[i] = rng();
      runnerSpeed[i] = 0.08 + rng() * 0.12;
      runnerStream[i] = i % streams.length;
    }
    const runnerGeo = new THREE.BufferGeometry();
    runnerGeo.setAttribute("position", new THREE.BufferAttribute(runnerPos, 3));
    const runnerTex = makeSoftPointTexture();
    const runnerMat = new THREE.PointsMaterial({
      map: runnerTex,
      color: new THREE.Color(PURPLE_HOT),
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      size: 0.14,
    });
    const runners = new THREE.Points(runnerGeo, runnerMat);

    const HAZE = 520;
    const hazeWorld = new Float32Array(HAZE * 3);
    const hazePhase = new Float32Array(HAZE * 3);
    for (let i = 0; i < HAZE; i++) {
      const tt = rng() * Math.PI * 2;
      const uu = rng() * 2 - 1;
      const rr = 18 + rng() * 38;
      hazeWorld[i * 3] = Math.cos(tt) * Math.sqrt(Math.max(0, 1 - uu * uu)) * rr;
      hazeWorld[i * 3 + 1] = uu * rr * 0.75;
      hazeWorld[i * 3 + 2] = -18 - rng() * 55;
      hazePhase[i * 3] = rng() * Math.PI * 2;
      hazePhase[i * 3 + 1] = rng() * Math.PI * 2;
      hazePhase[i * 3 + 2] = rng() * Math.PI * 2;
    }
    const hazeGeo = new THREE.BufferGeometry();
    const hazePosAttr = new THREE.BufferAttribute(new Float32Array(HAZE * 3), 3);
    hazeGeo.setAttribute("position", hazePosAttr);
    const hazeSizes = new Float32Array(HAZE);
    const hazeColors = new Float32Array(HAZE * 3);
    for (let i = 0; i < HAZE; i++) {
      hazeSizes[i] = 0.018 + rng() * 0.028;
      const dim = 0.22 + rng() * 0.2;
      hazeColors[i * 3] = dim * 0.75;
      hazeColors[i * 3 + 1] = dim * 0.55;
      hazeColors[i * 3 + 2] = dim;
    }
    hazeGeo.setAttribute("size", new THREE.BufferAttribute(hazeSizes, 1));
    hazeGeo.setAttribute("color", new THREE.BufferAttribute(hazeColors, 3));
    const hazeTex = makeSoftPointTexture();
    const hazeMat = new THREE.ShaderMaterial({
      uniforms: {
        uFogColor: { value: fogCol.clone() },
        uFogDensity: { value: fogDensity * 1.15 },
      },
      vertexShader: pointVertexShader,
      fragmentShader: pointFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const hazePoints = new THREE.Points(hazeGeo, hazeMat);

    const pointGeo = new THREE.BufferGeometry();
    const pointPosAttr = new THREE.BufferAttribute(world.slice(), 3);
    pointGeo.setAttribute("position", pointPosAttr);
    const sizes = new Float32Array(n);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      sizes[i] = clusterId[i] >= 0 ? 0.048 + weight[i] * 0.052 : 0.022 + weight[i] * 0.026;
      const bright = clusterId[i] >= 0 ? 0.92 + weight[i] * 0.12 : 0.32;
      colors[i * 3] = bright;
      colors[i * 3 + 1] = bright * 0.78;
      colors[i * 3 + 2] = 1;
    }
    pointGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    pointGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const pointMat = new THREE.ShaderMaterial({
      uniforms: {
        uFogColor: { value: fogCol.clone() },
        uFogDensity: { value: fogDensity },
      },
      vertexShader: pointVertexShader,
      fragmentShader: pointFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(pointGeo, pointMat);

    const root = new THREE.Group();
    root.add(plexusLines);
    streams.forEach((s) => root.add(s.line));
    root.add(runners);
    root.add(hazePoints);
    root.add(points);
    scene.add(root);

    const tmp = new THREE.Vector3();
    const tmpTan = new THREE.Vector3();
    const side = new THREE.Vector3();

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
    let didLogFirstFrameCoords = false;

    const fillLinePositions = () => {
      let o = 0;
      for (const [a, b] of edges) {
        linePos[o++] = world[a * 3];
        linePos[o++] = world[a * 3 + 1];
        linePos[o++] = world[a * 3 + 2];
        linePos[o++] = world[b * 3];
        linePos[o++] = world[b * 3 + 1];
        linePos[o++] = world[b * 3 + 2];
      }
      lineGeo.attributes.position.needsUpdate = true;
    };

    const syncStreamControls = () => {
      for (const s of streams) {
        s.def.indices.forEach((ci, k) => {
          s.ctrl[k].copy(clusterCenters[ci]);
        });
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      const time = (now - t0) * 0.001;
      computeWorld(time);
      syncStreamControls();

      for (let i = 0; i < n; i++) {
        pointPosAttr.setXYZ(i, world[i * 3], world[i * 3 + 1], world[i * 3 + 2]);
      }
      pointPosAttr.needsUpdate = true;

      for (let i = 0; i < HAZE; i++) {
        const hx = hazeWorld[i * 3];
        const hy = hazeWorld[i * 3 + 1];
        const hz = hazeWorld[i * 3 + 2];
        const px = hazePhase[i * 3];
        const py = hazePhase[i * 3 + 1];
        const pz = hazePhase[i * 3 + 2];
        hazePosAttr.setXYZ(
          i,
          hx + Math.sin(time * 0.11 + px) * 0.55 * motion,
          hy + Math.cos(time * 0.09 + py) * 0.42 * motion,
          hz + Math.sin(time * 0.13 + pz) * 0.38 * motion
        );
      }
      hazePosAttr.needsUpdate = true;

      fillLinePositions();

      const flow = time * motion * 0.5;
      const amp = 0.42 * motion;

      streams.forEach((s, si) => {
        const segs = s.def.segments;
        const denom = Math.max(1, segs - 1);
        for (let i = 0; i < segs; i++) {
          const u = i / denom;
          const uu = curveParamT(u + flow * s.def.flowScale);
          s.curve.getPoint(uu, tmp);
          s.curve.getTangent(uu, tmpTan);
          side.set(-tmpTan.z, 0, tmpTan.x);
          if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
          side.normalize();
          const wobble =
            Math.sin(flow * 1.1 + si + u * 9) * amp * 0.07 +
            Math.cos(flow * 0.85 + u * 11) * amp * 0.045;
          s.positions[i * 3] = tmp.x + side.x * wobble;
          s.positions[i * 3 + 1] = tmp.y + Math.sin(flow * 1.9 + u * 12) * amp * 0.055;
          s.positions[i * 3 + 2] = tmp.z + side.z * wobble;
        }
        s.geometry.attributes.position.needsUpdate = true;
        s.material.opacity =
          s.def.baseOpacity * (0.72 + 0.28 * Math.sin(time * 0.62 + si * 0.9) * motion);
      });

      for (let i = 0; i < RUNNERS; i++) {
        const si = runnerStream[i];
        const st = streams[si];
        const u = curveParamT(runnerPhase[i] + time * runnerSpeed[i] * motion * 0.15);
        st.curve.getPoint(u, tmp);
        const j = i * 1.713;
        runnerPos[i * 3] = tmp.x + Math.sin(j + time * 2.4) * 0.035;
        runnerPos[i * 3 + 1] = tmp.y + Math.cos(j * 1.1 + time * 2.1) * 0.028;
        runnerPos[i * 3 + 2] = tmp.z + Math.sin(j * 0.9 + time * 1.8) * 0.032;
      }
      runnerGeo.attributes.position.needsUpdate = true;

      lineMat.opacity = 0.1 + 0.06 * Math.sin(time * 0.48) * motion;

      key.position.x = 8 + Math.sin(time * 0.07) * 3 * motion;
      key.position.y = 10 + Math.cos(time * 0.055) * 2.2 * motion;

      root.rotation.y = time * 0.062 * motion;
      root.rotation.x = Math.sin(time * 0.038) * 0.055 * motion;
      root.rotation.z = Math.sin(time * 0.021) * 0.022 * motion;
      camera.position.x = Math.sin(time * 0.045) * 0.55 * motion;
      camera.position.y = 0.55 + Math.sin(time * 0.035) * 0.22 * motion;
      camera.position.z = 28 + Math.sin(time * 0.065) * 0.65 * motion;
      camera.lookAt(0, 0.2, -18);

      if (!didLogFirstFrameCoords) {
        didLogFirstFrameCoords = true;
        const lines: string[] = ["[AgenticPlexus] world coords (frame 1, after computeWorld)"];
        for (let h = 0; h < clusterCenters.length; h++) {
          const c = clusterCenters[h];
          lines.push(
            `hub ${h}: x=${c.x.toFixed(3)} y=${c.y.toFixed(3)} z=${c.z.toFixed(3)}`
          );
        }
        const step = Math.max(1, Math.floor(n / 48));
        for (let pi = 0; pi < n; pi += step) {
          lines.push(
            `pt ${pi}: x=${world[pi * 3].toFixed(3)} y=${world[pi * 3 + 1].toFixed(3)} z=${world[pi * 3 + 2].toFixed(3)}`
          );
        }
        const hazeStep = Math.max(1, Math.floor(HAZE / 16));
        for (let hi = 0; hi < HAZE; hi += hazeStep) {
          const hx = hazeWorld[hi * 3] + Math.sin(time * 0.11 + hazePhase[hi * 3]) * 0.55 * motion;
          const hy =
            hazeWorld[hi * 3 + 1] + Math.cos(time * 0.09 + hazePhase[hi * 3 + 1]) * 0.42 * motion;
          const hz =
            hazeWorld[hi * 3 + 2] + Math.sin(time * 0.13 + hazePhase[hi * 3 + 2]) * 0.38 * motion;
          lines.push(`haze ${hi}: x=${hx.toFixed(3)} y=${hy.toFixed(3)} z=${hz.toFixed(3)}`);
        }
        console.log(lines.join("\n"));
      }

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
      hazeTex.dispose();
      hazeGeo.dispose();
      hazeMat.dispose();
      pointGeo.dispose();
      pointMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      streams.forEach((s) => {
        s.geometry.dispose();
        s.material.dispose();
      });
      runnerTex.dispose();
      runnerGeo.dispose();
      runnerMat.dispose();
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
