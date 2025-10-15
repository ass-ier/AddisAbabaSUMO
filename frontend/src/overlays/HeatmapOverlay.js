import React, { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

// Lightweight, additive canvas heatmap for L.CRS.Simple maps
// - Renders into its own pane above roads but below markers/controls
// - Consumes vehicle points in net coords: { id, netLat: y, netLng: x, speed }
// - Applies exponential decay and capped redraw rate

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function makeColorRamp() {
  // Perceptual ramp: green → yellow → orange → red → purple
  const stops = [
    { t: 0.0, r: 0, g: 200, b: 0 },
    { t: 0.25, r: 180, g: 220, b: 0 },
    { t: 0.5, r: 255, g: 165, b: 0 },
    { t: 0.75, r: 220, g: 0, b: 0 },
    { t: 1.0, r: 180, g: 0, b: 200 },
  ];
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // find interval
    let j = 0;
    while (j + 1 < stops.length && t > stops[j + 1].t) j++;
    const a = stops[j];
    const b = stops[Math.min(j + 1, stops.length - 1)];
    const span = Math.max(1e-6, b.t - a.t);
    const u = clamp((t - a.t) / span, 0, 1);
    const r = Math.round(a.r + (b.r - a.r) * u);
    const g = Math.round(a.g + (b.g - a.g) * u);
    const bb = Math.round(a.b + (b.b - a.b) * u);
    lut[i * 4 + 0] = r;
    lut[i * 4 + 1] = g;
    lut[i * 4 + 2] = bb;
    lut[i * 4 + 3] = Math.round(220); // base alpha; overall opacity controlled by ctx/global
  }
  return lut;
}

function drawColorized(intensityCtx, displayCtx, rampLUT, globalAlpha = 0.6) {
  const { width, height } = intensityCtx.canvas;
  const src = intensityCtx.getImageData(0, 0, width, height);
  const dst = displayCtx.createImageData(width, height);
  const s = src.data;
  const d = dst.data;
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3]; // use alpha as intensity
    if (a === 0) {
      // leave transparent
      continue;
    }
    const idx = a; // 0..255
    const off = idx * 4;
    d[i + 0] = rampLUT[off + 0];
    d[i + 1] = rampLUT[off + 1];
    d[i + 2] = rampLUT[off + 2];
    d[i + 3] = Math.min(255, Math.round(rampLUT[off + 3] * globalAlpha));
  }
  displayCtx.putImageData(dst, 0, 0);
}

function HeatmapOverlay({
  enabled,
  vehicles,
  settings,
  debug,
}) {
  const map = useMap();
  const paneName = "heatmapPane";
  const displayCanvasRef = useRef(null);
  const intensityCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastFrameRef = useRef(0);
  const lut = useMemo(() => makeColorRamp(), []);

  const cfg = useMemo(() => {
    const s = settings || {};
    return {
      fps: clamp(Number(s.fps) || 8, 2, 30),
      freeFlow: clamp(Number(s.freeFlowSpeed) || 13.9, 1, 40), // m/s
      radiusPx: clamp(Number(s.radiusPx) || 18, 4, 80),
      intensity: clamp(Number(s.intensity) || 1.0, 0.2, 3.0),
      halfLifeSec: clamp(Number(s.halfLifeSec) || 2.5, 0.5, 10.0),
      weighting: s.weighting || "speed", // 'speed' or 'count'
      opacity: clamp(Number(s.opacity) || 0.6, 0.1, 1.0),
      debugMarkerPx: clamp(Number(s.debugMarkerPx) || 8, 2, 24),
    };
  }, [settings]);

  // Create pane and canvases
  useEffect(() => {
    if (!map) return;
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
    }
    // Attach display canvas directly to map container so containerPoint coords match
    const container = map.getContainer();
    // Create canvases
    const dcv = document.createElement("canvas");
    const icv = document.createElement("canvas");
    dcv.style.position = "absolute";
    dcv.style.top = "0";
    dcv.style.left = "0";
    dcv.style.width = "100%";
    dcv.style.height = "100%";
    dcv.style.pointerEvents = "none";
    dcv.style.zIndex = 450; // above overlayPane(400), below markerPane(600)
    icv.width = dcv.width = map.getSize().x;
    icv.height = dcv.height = map.getSize().y;
    container.appendChild(dcv);
    // keep intensity canvas off-DOM (not appended)
    displayCanvasRef.current = dcv;
    intensityCanvasRef.current = icv;

    const handleResizeOrMove = () => {
      const size = map.getSize();
      if (dcv.width !== size.x || dcv.height !== size.y) {
        icv.width = dcv.width = size.x;
        icv.height = dcv.height = size.y;
      }
      // Clear on move for simplicity; decay will handle trails otherwise
      const dctx = dcv.getContext("2d");
      dctx.clearRect(0, 0, dcv.width, dcv.height);
      const ictx = icv.getContext("2d", { willReadFrequently: true });
      ictx.clearRect(0, 0, icv.width, icv.height);
    };

    map.on("move zoom resize", handleResizeOrMove);
    handleResizeOrMove();

    return () => {
      map.off("move zoom resize", handleResizeOrMove);
      if (dcv && dcv.parentNode) dcv.parentNode.removeChild(dcv);
      displayCanvasRef.current = null;
      intensityCanvasRef.current = null;
    };
  }, [map]);

  // Animation/render loop
  useEffect(() => {
    if (!map) return;

    const step = (t) => {
      const dcv = displayCanvasRef.current;
      const icv = intensityCanvasRef.current;
      // Wait until map has an initial view (Leaflet requires center/zoom)
      if (!map || !map._loaded) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      if (!enabled || !dcv || !icv) {
        lastFrameRef.current = t;
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const minDt = 1000 / cfg.fps;
      if (t - lastFrameRef.current < minDt) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const dtMs = Math.max(1, t - lastFrameRef.current || minDt);
      lastFrameRef.current = t;

      const dctx = dcv.getContext("2d");
      const ictx = icv.getContext("2d", { willReadFrequently: true });

      // Apply exponential decay to intensity canvas via destination-out
      const decayPerMs = Math.log(2) / (cfg.halfLifeSec * 1000);
      const decay = clamp(1 - Math.exp(-decayPerMs * dtMs), 0, 1); // fraction to remove
      ictx.save();
      ictx.globalCompositeOperation = "destination-out";
      ictx.fillStyle = `rgba(0,0,0,${decay})`;
      ictx.fillRect(0, 0, icv.width, icv.height);
      ictx.restore();

      // Draw new points to intensity canvas (white radial gradients, alpha = weight)
      if (Array.isArray(vehicles) && vehicles.length > 0) {
        let bounds;
        try {
          bounds = map.getBounds();
        } catch (_) {
          // Map not fully ready for bounds; skip this frame
          rafRef.current = requestAnimationFrame(step);
          return;
        }
        const pad = 0.00001; // net coords are meters; CRS.Simple lat=y, lng=x; bounds are in same units
        const inView = (lat, lng) =>
          lat >= bounds.getSouth() - pad &&
          lat <= bounds.getNorth() + pad &&
          lng >= bounds.getWest() - pad &&
          lng <= bounds.getEast() + pad;

        const points = [];
        for (let i = 0; i < vehicles.length; i++) {
          const v = vehicles[i];
          const lat = typeof v.netLat === "number" ? v.netLat : (typeof v.y === "number" ? v.y : null);
          const lng = typeof v.netLng === "number" ? v.netLng : (typeof v.x === "number" ? v.x : null);
          if (lat == null || lng == null) continue;
          if (!inView(lat, lng)) continue;
          const ll = L.latLng(lat, lng);
          const pt = map.latLngToContainerPoint(ll);
          let w = 1.0;
          if (cfg.weighting === "speed") {
            const sp = typeof v.speed === "number" ? v.speed : 0;
            w = clamp(1 - sp / cfg.freeFlow, 0.1, 1.0);
          }
          points.push({ x: pt.x, y: pt.y, w });
        }

        // Downsample if too many
        const MAX_POINTS = 2000;
        let proc = points;
        if (points.length > MAX_POINTS) {
          const step = Math.ceil(points.length / MAX_POINTS);
          proc = points.filter((_, i) => i % step === 0);
        }

        const r = cfg.radiusPx;
        for (let i = 0; i < proc.length; i++) {
          const p = proc[i];
          const g = ictx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          // Higher inner alpha for stronger weighting, outer fades to 0
          const a = clamp(p.w * cfg.intensity, 0.05, 0.9);
          g.addColorStop(0, `rgba(255,255,255,${a})`);
          g.addColorStop(1, `rgba(255,255,255,0)`);
          ictx.fillStyle = g;
          ictx.beginPath();
          ictx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ictx.fill();
        }

        // Optional debug: draw raw points and simple bin counts
        if (debug) {
          dctx.save();
          dctx.clearRect(0, 0, dcv.width, dcv.height);
          dctx.fillStyle = "rgba(0,0,0,0.0)";
          dctx.fillRect(0, 0, dcv.width, dcv.height);
          // Draw larger, high-contrast markers for testing
          const rr = cfg.debugMarkerPx;
          for (let i = 0; i < proc.length; i++) {
            const p = proc[i];
            // outer white ring
            dctx.beginPath();
            dctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
            dctx.fillStyle = "#ffffff";
            dctx.fill();
            // inner dark dot
            dctx.beginPath();
            dctx.arc(p.x, p.y, Math.max(2, rr * 0.5), 0, Math.PI * 2);
            dctx.fillStyle = "#111";
            dctx.fill();
          }
          // Show simple counts
          dctx.fillStyle = "rgba(0,0,0,0.6)";
          dctx.fillRect(8, 8, 200, 40);
          dctx.fillStyle = "#fff";
          dctx.font = "12px ui-monospace, monospace";
          dctx.fillText(`visible: ${proc.length}/${vehicles.length}`, 16, 26);
          dctx.restore();
        }
      }

      // Colorize intensity into display
      if (!debug) {
        drawColorized(ictx, dctx, lut, cfg.opacity);
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [map, enabled, vehicles, cfg, debug, lut]);

  return null; // purely imperative overlay
}

export default HeatmapOverlay;