"use client";

import { cn } from "cn";
import { useEffect, useRef } from "react";

/**
 * React Bits "Hyperspeed", distilled to ~2 KB of Canvas 2D (no three.js):
 * a night highway seen from the driver's seat — taillights pulling away on
 * the left, headlights rushing past on the right, lane dashes and roadside
 * lamps streaming by. Pauses when off-screen or in a background tab, caps
 * the pixel ratio, and renders a single still frame for reduced motion.
 */
type Light = { x: number; z: number; len: number; speed: number; color: string; away: boolean };

const FAR = 42;
const ROAD_Y = 1.25;
const HALF = 3.2;

function makeLight(away: boolean, randomZ: boolean): Light {
  const lanes = away ? [-2.3, -1] : [1, 2.3];
  const x = lanes[Math.floor(Math.random() * lanes.length)];
  return {
    x,
    z: randomZ ? 1 + Math.random() * (FAR - 1) : away ? 0.8 + Math.random() * 2 : FAR + Math.random() * 12,
    len: away ? 1.5 + Math.random() * 3.5 : 3 + Math.random() * 6,
    speed: away ? 2 + Math.random() * 4 : 20 + Math.random() * 10,
    color: away ? (Math.random() < 0.7 ? "251,91,33" : "255,50,40") : Math.random() < 0.6 ? "255,236,214" : "255,190,140",
    away,
  };
}

export function RoadLights({ className, density = 26 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lights: Light[] = [];
    for (let i = 0; i < density; i++) lights.push(makeLight(i % 2 === 0, true));

    let w = 0;
    let h = 0;
    let f = 0;
    let vx = 0;
    let vy = 0;
    let travel = 0;
    let raf = 0;
    let last = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      f = Math.max(w, h) * 0.55;
      // Wide panels: push the vanishing point right so the traffic runs away from left-aligned copy.
      vx = w * (w > 560 ? 0.64 : 0.5);
      vy = h * 0.38;
    };

    const px = (x: number, z: number) => vx + (x * f) / z;
    const py = (y: number, z: number) => vy + (y * f) / z;

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      travel = (travel + dt * 9) % 4;

      // Road edges
      ctx.lineWidth = 1;
      for (const side of [-HALF, HALF]) {
        const g = ctx.createLinearGradient(vx, vy, px(side, 1), py(ROAD_Y, 1));
        g.addColorStop(0, "rgba(251,91,33,0)");
        g.addColorStop(1, "rgba(251,91,33,0.35)");
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(px(side, FAR), py(ROAD_Y, FAR));
        ctx.lineTo(px(side, 1), py(ROAD_Y, 1));
        ctx.stroke();
      }

      // Lane dashes and roadside lamps stream toward the viewer
      for (let z = FAR - travel; z > 0.9; z -= 4) {
        const fade = Math.min(1, (FAR - z) / 12) * 0.5;
        ctx.strokeStyle = `rgba(255,255,255,${fade * 0.55})`;
        ctx.lineWidth = Math.min(3, Math.max(0.5, (0.05 * f) / z));
        for (const lane of [-0.35, 0.35]) {
          ctx.beginPath();
          ctx.moveTo(px(lane, z), py(ROAD_Y, z));
          ctx.lineTo(px(lane, z + 1.4), py(ROAD_Y, z + 1.4));
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(251,91,33,${fade})`;
        ctx.lineWidth = Math.min(3, Math.max(0.6, (0.07 * f) / z));
        for (const side of [-HALF - 0.6, HALF + 0.6]) {
          ctx.beginPath();
          ctx.moveTo(px(side, z), py(ROAD_Y, z));
          ctx.lineTo(px(side, z), py(ROAD_Y - 1.1, z));
          ctx.stroke();
        }
      }

      // Light trails: soft wide pass for the glow, thin bright pass for the core
      for (const l of lights) {
        l.z += (l.away ? l.speed : -l.speed) * dt;
        if (l.away ? l.z > FAR : l.z + l.len < 0.8) Object.assign(l, makeLight(l.away, false));
        const z0 = Math.max(l.z, 0.8);
        const z1 = l.z + l.len;
        if (z1 <= 0.8) continue;
        // Fade in from the horizon and out again close to the camera (no giant streaks).
        const alpha = Math.min(1, (FAR - z0) / 10) * Math.min(1, (z0 - 0.8) / 2.2);
        for (const dx of [-0.16, 0.16]) {
          const x0 = px(l.x + dx, z0);
          const y0 = py(ROAD_Y - 0.25, z0);
          const x1 = px(l.x + dx, z1);
          const y1 = py(ROAD_Y - 0.25, z1);
          const width = Math.min(4, Math.max(0.8, (0.07 * f) / z0));
          ctx.strokeStyle = `rgba(${l.color},${alpha * 0.14})`;
          ctx.lineWidth = width * 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.strokeStyle = `rgba(${l.color},${alpha * 0.9})`;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const loop = (t: number) => {
      const dt = last ? Math.min((t - last) / 1000, 0.05) : 0.016;
      last = t;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (reduce || raf || !visible || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    resize();
    draw(0);
    const ro = new ResizeObserver(() => {
      resize();
      if (!raf) draw(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden className={cn("pointer-events-none absolute inset-0 size-full", className)} />;
}
