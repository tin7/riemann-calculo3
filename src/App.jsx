import React, { useMemo, useState } from "react";
import { AlertCircle, Sigma, SlidersHorizontal, LineChart } from "lucide-react";

const presets1D = [
  { label: "x²", expr: "x^2" },
  { label: "sin(x)", expr: "sin(x)" },
  { label: "cos(x)", expr: "cos(x)" },
  { label: "exp(-x^2)", expr: "exp(-x^2)" },
  { label: "x^3 - 2*x + 1", expr: "x^3 - 2*x + 1" },
  { label: "sqrt(x+2)", expr: "sqrt(x+2)" },
  { label: "1/(1+x^2)", expr: "1/(1+x^2)" },
];

const presets2D = [
  { label: "x + y", expr: "x + y" },
  { label: "x*y", expr: "x*y" },
  { label: "x^2 + y^2", expr: "x^2 + y^2" },
  { label: "sin(x)*cos(y)", expr: "sin(x)*cos(y)" },
  { label: "exp(-(x^2+y^2))", expr: "exp(-(x^2+y^2))" },
  { label: "1/(1+x^2+y^2)", expr: "1/(1+x^2+y^2)" },
];

const riemannModes1D = [
  { value: "left", label: "Izquierda" },
  { value: "right", label: "Derecha" },
  { value: "mid", label: "Punto medio" },
];

const riemannModes2D = [
  { value: "lower", label: "Esquina inferior izquierda" },
  { value: "upper", label: "Esquina superior derecha" },
  { value: "mid", label: "Punto medio" },
];

function niceNumber(value) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1000 || (abs > 0 && abs < 0.001)) return value.toExponential(3);
  return value.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function normalizeExpression(expr) {
  return expr.replace(/\^/g, "**");
}

function createCompiledFunction(argumentNames, expr) {
  const normalized = normalizeExpression(expr.trim());
  if (!normalized) throw new Error("La función está vacía.");

  const allowedPattern = /^[0-9xy+\-*/().,^\s_a-zA-Z]+$/;
  if (!allowedPattern.test(expr)) {
    throw new Error("La función contiene caracteres no permitidos.");
  }

  const fn = new Function(
    ...argumentNames,
    `
      const {
        sin, cos, tan, asin, acos, atan, atan2,
        sinh, cosh, tanh,
        exp, log, abs, sqrt, pow,
        floor, ceil, round, min, max,
        PI, E
      } = Math;
      const pi = PI;
      const e = E;
      return ${normalized};
    `,
  );

  return (...values) => {
    const y = fn(...values);
    if (typeof y !== "number" || !Number.isFinite(y)) return NaN;
    return y;
  };
}

function compileFunction1D(expr) {
  return createCompiledFunction(["x"], expr);
}

function compileFunction2D(expr) {
  return createCompiledFunction(["x", "y"], expr);
}

function mapX(x, a, b, width, margin) {
  return margin.left + ((x - a) / (b - a)) * (width - margin.left - margin.right);
}

function mapY(y, ymin, ymax, height, margin) {
  return height - margin.bottom - ((y - ymin) / (ymax - ymin)) * (height - margin.top - margin.bottom);
}

function buildPath(points, a, b, ymin, ymax, width, height, margin) {
  let d = "";
  let open = false;
  for (const p of points) {
    if (!Number.isFinite(p.y)) {
      open = false;
      continue;
    }
    const X = mapX(p.x, a, b, width, margin);
    const Y = mapY(p.y, ymin, ymax, height, margin);
    d += `${open ? "L" : "M"}${X},${Y} `;
    open = true;
  }
  return d.trim();
}

function AxisTicks({ a, b, ymin, ymax, width, height, margin }) {
  const xticks = 6;
  const yticks = 6;
  const items = [];

  for (let i = 0; i <= xticks; i++) {
    const value = a + (i / xticks) * (b - a);
    const x = mapX(value, a, b, width, margin);
    items.push(
      <g key={`x-${i}`}>
        <line x1={x} x2={x} y1={margin.top} y2={height - margin.bottom} stroke="rgba(148,163,184,0.20)" />
        <text x={x} y={height - margin.bottom + 22} textAnchor="middle" fontSize="11" fill="#475569">
          {niceNumber(value)}
        </text>
      </g>,
    );
  }

  for (let i = 0; i <= yticks; i++) {
    const value = ymin + (i / yticks) * (ymax - ymin);
    const y = mapY(value, ymin, ymax, height, margin);
    items.push(
      <g key={`y-${i}`}>
        <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="rgba(148,163,184,0.20)" />
        <text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#475569">
          {niceNumber(value)}
        </text>
      </g>,
    );
  }

  return <>{items}</>;
}

function buildPlotData1D(f, a, b, n, mode) {
  const sampleCount = 500;
  const points = [];
  let ymin = Infinity;
  let ymax = -Infinity;

  for (let i = 0; i <= sampleCount; i++) {
    const x = a + (i / sampleCount) * (b - a);
    const y = f(x);
    if (Number.isFinite(y)) {
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
      points.push({ x, y });
    } else {
      points.push({ x, y: NaN });
    }
  }

  const dx = (b - a) / n;
  const rects = [];
  let sum = 0;

  for (let i = 0; i < n; i++) {
    const x0 = a + i * dx;
    const x1 = x0 + dx;
    const xSample = mode === "left" ? x0 : mode === "right" ? x1 : (x0 + x1) / 2;
    const height = f(xSample);
    rects.push({ x0, x1, xSample, height });
    if (Number.isFinite(height)) {
      sum += height * dx;
      ymin = Math.min(ymin, height, 0);
      ymax = Math.max(ymax, height, 0);
    }
  }

  ymin = Math.min(ymin, 0);
  ymax = Math.max(ymax, 0);
  if (!Number.isFinite(ymin) || !Number.isFinite(ymax)) {
    ymin = -1;
    ymax = 1;
  }
  if (Math.abs(ymax - ymin) < 1e-12) {
    ymin -= 1;
    ymax += 1;
  }
  const pad = 0.12 * (ymax - ymin);

  return { points, rects, sum, ymin: ymin - pad, ymax: ymax + pad };
}

function Plot1D({ expr, a, b, n, mode }) {
  const width = 920;
  const height = 470;
  const margin = { top: 24, right: 28, bottom: 44, left: 70 };

  const { error, plot } = useMemo(() => {
    try {
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("El intervalo no es válido.");
      if (a === b) throw new Error("Los extremos del intervalo no pueden coincidir.");
      if (!Number.isInteger(n) || n < 1) throw new Error("La cantidad de divisiones debe ser un entero positivo.");
      const f = compileFunction1D(expr);
      return { error: null, plot: buildPlotData1D(f, a, b, n, mode) };
    } catch (err) {
      return { error: err.message || "No se pudo interpretar la función.", plot: null };
    }
  }, [expr, a, b, n, mode]);

  if (error || !plot) {
    return (
      <div className="flex h-[470px] items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-700">
        <div className="flex max-w-xl items-center gap-3 px-6 text-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const { points, rects, ymin, ymax, sum } = plot;
  const curvePath = buildPath(points, a, b, ymin, ymax, width, height, margin);
  const xAxisY = mapY(0, ymin, ymax, height, margin);
  const yAxisX = mapX(0, a, b, width, margin);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
          <rect x="0" y="0" width={width} height={height} fill="white" />
          <AxisTicks a={a} b={b} ymin={ymin} ymax={ymax} width={width} height={height} margin={margin} />

          {rects.map((r, idx) => {
            if (!Number.isFinite(r.height)) return null;
            const x0 = mapX(r.x0, a, b, width, margin);
            const x1 = mapX(r.x1, a, b, width, margin);
            const y0 = mapY(0, ymin, ymax, height, margin);
            const yh = mapY(r.height, ymin, ymax, height, margin);
            const top = Math.min(y0, yh);
            const h = Math.abs(yh - y0);
            return (
              <g key={idx}>
                <rect x={x0} y={top} width={Math.max(0, x1 - x0)} height={h} fill="rgba(37,99,235,0.15)" stroke="rgba(37,99,235,0.55)" strokeWidth="1" />
                <circle cx={mapX(r.xSample, a, b, width, margin)} cy={yh} r="2.6" fill="rgba(29,78,216,0.95)" />
              </g>
            );
          })}

          <line x1={margin.left} x2={width - margin.right} y1={xAxisY} y2={xAxisY} stroke="#0f172a" strokeWidth="1.4" />
          <line x1={yAxisX} x2={yAxisX} y1={margin.top} y2={height - margin.bottom} stroke="#0f172a" strokeWidth="1.4" />
          <path d={curvePath} fill="none" stroke="#0f172a" strokeWidth="2.5" />
          <text x={width - 20} y={xAxisY - 8} textAnchor="end" fontSize="12" fill="#334155">x</text>
          <text x={yAxisX + 10} y={margin.top + 8} fontSize="12" fill="#334155">y</text>
        </svg>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <InfoCard title="Δx" value={niceNumber((b - a) / n)} subtitle="Ancho de subintervalo" />
        <InfoCard title="n" value={String(n)} subtitle="Cantidad de divisiones" />
        <InfoCard title="Modo" value={riemannModes1D.find((m) => m.value === mode)?.label ?? "—"} subtitle="Tipo de suma" />
        <InfoCard title="Σ f(xᵢ*)Δx" value={niceNumber(sum)} subtitle="Aproximación de Riemann" />
      </div>
    </div>
  );
}

function projectIso(x, y, z, sx, sy, sz) {
  return { x: (x - y) * sx, y: (x + y) * sy - z * sz };
}

function fitSceneToViewport(points, width, height, padding = 40) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const sceneWidth = Math.max(maxX - minX, 1);
  const sceneHeight = Math.max(maxY - minY, 1);
  const scale = Math.min((width - 2 * padding) / sceneWidth, (height - 2 * padding) / sceneHeight);
  const offsetX = (width - sceneWidth * scale) / 2 - minX * scale;
  const offsetY = (height - sceneHeight * scale) / 2 - minY * scale;
  return { scale, offsetX, offsetY };
}

function transformPoint(p, fit) {
  return { x: p.x * fit.scale + fit.offsetX, y: p.y * fit.scale + fit.offsetY };
}

function polygonString(points) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function buildVolumeData2D(f, ax, bx, ay, by, nx, ny, mode) {
  const dx = (bx - ax) / nx;
  const dy = (by - ay) / ny;
  const cells = [];
  let sum = 0;
  let zmin = Infinity;
  let zmax = -Infinity;
  let maxAbsHeight = 0;

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const xs = mode === "lower" ? ax + i * dx : mode === "upper" ? ax + (i + 1) * dx : ax + (i + 0.5) * dx;
      const ys = mode === "lower" ? ay + j * dy : mode === "upper" ? ay + (j + 1) * dy : ay + (j + 0.5) * dy;
      const height = f(xs, ys);
      cells.push({ i, j, height });
      if (Number.isFinite(height)) {
        sum += height * dx * dy;
        zmin = Math.min(zmin, height, 0);
        zmax = Math.max(zmax, height, 0);
        maxAbsHeight = Math.max(maxAbsHeight, Math.abs(height));
      }
    }
  }

  if (!Number.isFinite(zmin) || !Number.isFinite(zmax)) {
    zmin = -1;
    zmax = 1;
  }

  return { cells, dx, dy, sum, zmin, zmax, maxAbsHeight };
}

function buildSurfaceMesh2D(f, nx, ny, resolution = 22) {
  const quads = [];
  let zmin = Infinity;
  let zmax = -Infinity;
  let maxAbsHeight = 0;

  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const u0 = (i / resolution) * nx;
      const u1 = ((i + 1) / resolution) * nx;
      const v0 = (j / resolution) * ny;
      const v1 = ((j + 1) / resolution) * ny;
      const x00 = u0 / nx;
      const x10 = u1 / nx;
      const y00 = v0 / ny;
      const y01 = v1 / ny;

      const z00 = f(x00, y00);
      const z10 = f(x10, y00);
      const z11 = f(x10, y01);
      const z01 = f(x00, y01);

      const vals = [z00, z10, z11, z01].filter(Number.isFinite);
      if (!vals.length) continue;
      vals.forEach((v) => {
        zmin = Math.min(zmin, v, 0);
        zmax = Math.max(zmax, v, 0);
        maxAbsHeight = Math.max(maxAbsHeight, Math.abs(v));
      });
      quads.push({ u0, u1, v0, v1, z00, z10, z11, z01, depth: i + j });
    }
  }

  if (!Number.isFinite(zmin) || !Number.isFinite(zmax)) {
    zmin = -1;
    zmax = 1;
  }

  return { quads, zmin, zmax, maxAbsHeight };
}

function buildSurfaceQuads(raw, ax, bx, ay, by, resolution = 22) {
  const quads = [];
  let zmin = Infinity;
  let zmax = -Infinity;
  let maxAbsHeight = 0;

  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const tx0 = i / resolution;
      const tx1 = (i + 1) / resolution;
      const ty0 = j / resolution;
      const ty1 = (j + 1) / resolution;

      const x00 = ax + tx0 * (bx - ax);
      const x10 = ax + tx1 * (bx - ax);
      const y00 = ay + ty0 * (by - ay);
      const y01 = ay + ty1 * (by - ay);

      const z00 = raw(x00, y00);
      const z10 = raw(x10, y00);
      const z11 = raw(x10, y01);
      const z01 = raw(x00, y01);

      const vals = [z00, z10, z11, z01].filter(Number.isFinite);
      if (!vals.length) continue;
      vals.forEach((v) => {
        zmin = Math.min(zmin, v, 0);
        zmax = Math.max(zmax, v, 0);
        maxAbsHeight = Math.max(maxAbsHeight, Math.abs(v));
      });

      quads.push({
        corners: [
          { x: x00, y: y00, z: Number.isFinite(z00) ? z00 : 0 },
          { x: x10, y: y00, z: Number.isFinite(z10) ? z10 : 0 },
          { x: x10, y: y01, z: Number.isFinite(z11) ? z11 : 0 },
          { x: x00, y: y01, z: Number.isFinite(z01) ? z01 : 0 },
        ],
        depth: i + j,
        avgZ: vals.reduce((a, b) => a + b, 0) / vals.length,
      });
    }
  }

  if (!Number.isFinite(zmin) || !Number.isFinite(zmax)) {
    zmin = -1;
    zmax = 1;
  }

  return { quads, zmin, zmax, maxAbsHeight };
}

function project3DPoint(x, y, z, params) {
  const { cx, cy, cz, theta, phi, zScale } = params;
  const dx = x - cx;
  const dy = y - cy;
  const dz = (z - cz) * zScale;

  const xr = dx * Math.cos(theta) - dy * Math.sin(theta);
  const yr = dx * Math.sin(theta) + dy * Math.cos(theta);
  const yp = yr * Math.cos(phi) - dz * Math.sin(phi);
  const zp = yr * Math.sin(phi) + dz * Math.cos(phi);

  return { x: xr, y: yp, depth: zp };
}

function Plot2D({ expr, ax, bx, ay, by, nx, ny, mode, azimuthDeg, elevationDeg }) {
  const width = 920;
  const height = 560;

  const { error, scene } = useMemo(() => {
    try {
      if (![ax, bx, ay, by].every(Number.isFinite)) throw new Error("El dominio no es válido.");
      if (ax === bx || ay === by) throw new Error("Los extremos del rectángulo no pueden coincidir.");
      if (!Number.isInteger(nx) || nx < 1 || !Number.isInteger(ny) || ny < 1) throw new Error("La cantidad de divisiones debe ser un entero positivo en ambas direcciones.");

      const raw = compileFunction2D(expr);
      const volumes = buildVolumeData2D(raw, ax, bx, ay, by, nx, ny, mode);
      const surface = buildSurfaceQuads(raw, ax, bx, ay, by, 22);
      const zmin = Math.min(volumes.zmin, surface.zmin);
      const zmax = Math.max(volumes.zmax, surface.zmax);
      const maxAbsHeight = Math.max(volumes.maxAbsHeight, surface.maxAbsHeight, 1e-9);
      const params = {
        cx: (ax + bx) / 2,
        cy: (ay + by) / 2,
        cz: 0,
        theta: (azimuthDeg * Math.PI) / 180,
        phi: (elevationDeg * Math.PI) / 180,
        zScale: (bx - ax + by - ay) / (3.2 * maxAbsHeight),
      };

      const drawable = [];
      const allProjected = [];

      surface.quads.forEach((quad, idx) => {
        const projected = quad.corners.map((p) => project3DPoint(p.x, p.y, p.z, params));
        projected.forEach((p) => allProjected.push(p));
        drawable.push({
          kind: "surface",
          key: `surface-${idx}`,
          points: projected,
          depth: projected.reduce((s, p) => s + p.depth, 0) / projected.length,
          avgZ: quad.avgZ,
        });
      });

      const dx = (bx - ax) / nx;
      const dy = (by - ay) / ny;
      volumes.cells.forEach((cell, idx) => {
        if (!Number.isFinite(cell.height) || Math.abs(cell.height) < 1e-12) return;
        const x0 = ax + cell.i * dx;
        const x1 = x0 + dx;
        const y0 = ay + cell.j * dy;
        const y1 = y0 + dy;
        const h = cell.height;
        const z0 = h >= 0 ? 0 : h;
        const z1 = h >= 0 ? h : 0;

        const baseA = project3DPoint(x0, y0, z0, params);
        const baseB = project3DPoint(x1, y0, z0, params);
        const baseC = project3DPoint(x1, y1, z0, params);
        const baseD = project3DPoint(x0, y1, z0, params);
        const topA = project3DPoint(x0, y0, z1, params);
        const topB = project3DPoint(x1, y0, z1, params);
        const topC = project3DPoint(x1, y1, z1, params);
        const topD = project3DPoint(x0, y1, z1, params);

        [baseA, baseB, baseC, baseD, topA, topB, topC, topD].forEach((p) => allProjected.push(p));

        drawable.push({ kind: "prism-right", key: `prism-r-${idx}`, points: [baseB, baseC, topC, topB], depth: (baseB.depth + baseC.depth + topC.depth + topB.depth) / 4, sign: h >= 0 ? "pos" : "neg" });
        drawable.push({ kind: "prism-back", key: `prism-b-${idx}`, points: [baseC, baseD, topD, topC], depth: (baseC.depth + baseD.depth + topD.depth + topC.depth) / 4, sign: h >= 0 ? "pos" : "neg" });
        drawable.push({ kind: "prism-top", key: `prism-t-${idx}`, points: [topA, topB, topC, topD], depth: (topA.depth + topB.depth + topC.depth + topD.depth) / 4, sign: h >= 0 ? "pos" : "neg" });
      });

      const axisPoints = [
        project3DPoint(ax, ay, 0, params),
        project3DPoint(bx + 0.2 * (bx - ax), ay, 0, params),
        project3DPoint(ax, by + 0.2 * (by - ay), 0, params),
        project3DPoint(ax, ay, zmax + 0.25 * (zmax - zmin + 1e-9), params),
      ];
      axisPoints.forEach((p) => allProjected.push(p));

      const fit = fitSceneToViewport(allProjected, width, height, 44);

      return {
        error: null,
        scene: {
          volumes,
          zmin,
          zmax,
          drawable: drawable.sort((a, b) => a.depth - b.depth).map((item) => ({
            ...item,
            points: item.points.map((p) => transformPoint(p, fit)),
          })),
          axis: {
            origin: transformPoint(axisPoints[0], fit),
            x: transformPoint(axisPoints[1], fit),
            y: transformPoint(axisPoints[2], fit),
            z: transformPoint(axisPoints[3], fit),
          },
        },
      };
    } catch (err) {
      return { error: err.message || "No se pudo interpretar la función de dos variables.", scene: null };
    }
  }, [expr, ax, bx, ay, by, nx, ny, mode, azimuthDeg, elevationDeg]);

  if (error || !scene) {
    return (
      <div className="flex h-[560px] items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-700">
        <div className="flex max-w-xl items-center gap-3 px-6 text-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const { volumes, zmin, zmax, drawable, axis } = scene;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
          <rect x="0" y="0" width={width} height={height} fill="white" />

          {drawable.map((item) => {
            if (item.kind === "surface") {
              return (
                <polygon
                  key={item.key}
                  points={polygonString(item.points)}
                  fill={item.avgZ >= 0 ? "rgba(8,47,73,0.72)" : "rgba(30,41,59,0.64)"}
                  stroke={item.avgZ >= 0 ? "rgba(8,47,73,0.92)" : "rgba(30,41,59,0.82)"}
                  strokeWidth="0.8"
                />
              );
            }

            const style = item.sign === "pos"
              ? item.kind === "prism-top"
                ? { fill: "rgba(59,130,246,0.32)", stroke: "rgba(37,99,235,0.78)" }
                : item.kind === "prism-right"
                  ? { fill: "rgba(59,130,246,0.20)", stroke: "rgba(37,99,235,0.72)" }
                  : { fill: "rgba(29,78,216,0.24)", stroke: "rgba(37,99,235,0.72)" }
              : item.kind === "prism-top"
                ? { fill: "rgba(239,68,68,0.26)", stroke: "rgba(220,38,38,0.76)" }
                : item.kind === "prism-right"
                  ? { fill: "rgba(239,68,68,0.17)", stroke: "rgba(220,38,38,0.70)" }
                  : { fill: "rgba(185,28,28,0.20)", stroke: "rgba(220,38,38,0.70)" };

            return <polygon key={item.key} points={polygonString(item.points)} fill={style.fill} stroke={style.stroke} strokeWidth="0.95" />;
          })}

          <line x1={axis.origin.x} y1={axis.origin.y} x2={axis.x.x} y2={axis.x.y} stroke="#0f172a" strokeWidth="1.6" />
          <line x1={axis.origin.x} y1={axis.origin.y} x2={axis.y.x} y2={axis.y.y} stroke="#0f172a" strokeWidth="1.6" />
          <line x1={axis.origin.x} y1={axis.origin.y} x2={axis.z.x} y2={axis.z.y} stroke="#0f172a" strokeWidth="1.6" />
          <text x={axis.x.x + 10} y={axis.x.y + 2} fontSize="13" fill="#334155">x</text>
          <text x={axis.y.x - 8} y={axis.y.y + 14} fontSize="13" fill="#334155">y</text>
          <text x={axis.z.x + 8} y={axis.z.y - 8} fontSize="13" fill="#334155">z</text>
          <text x={24} y={30} fontSize="12" fill="#475569">z min = {niceNumber(zmin)}</text>
          <text x={24} y={48} fontSize="12" fill="#475569">z max = {niceNumber(zmax)}</text>
        </svg>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <InfoCard title="Δx" value={niceNumber(volumes.dx)} subtitle="Ancho en dirección x" />
        <InfoCard title="Δy" value={niceNumber(volumes.dy)} subtitle="Ancho en dirección y" />
        <InfoCard title="nₓ × nᵧ" value={`${nx} × ${ny}`} subtitle="Cantidad de prismas" />
        <InfoCard title="Modo" value={riemannModes2D.find((m) => m.value === mode)?.label ?? "—"} subtitle="Punto de muestreo" />
        <InfoCard title="Σ f(xᵢ*,yⱼ*)ΔA" value={niceNumber(volumes.sum)} subtitle="Aproximación del volumen" />
      </div>
    </div>
  );
}

function InfoCard({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
    </div>
  );
}

function Pill({ icon, label }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm">
      <span className="text-slate-900">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function TextBlock({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <p className="text-sm leading-6 text-slate-700">{children}</p>
    </div>
  );
}

function SectionSwitcher({ view, setView }) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      <button type="button" onClick={() => setView("1d")} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${view === "1d" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"}`}>1 variable</button>
      <button type="button" onClick={() => setView("2d")} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${view === "2d" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"}`}>2 variables</button>
    </div>
  );
}

function OneVariablePage({ goTo2D }) {
  const [expr, setExpr] = useState("sin(x)");
  const [aText, setAText] = useState(String(-Math.PI));
  const [bText, setBText] = useState(String(Math.PI));
  const [n, setN] = useState(8);
  const [mode, setMode] = useState("mid");
  const a = Number(aText);
  const b = Number(bText);

  function fixIntervalOrder() {
    const av = Number(aText);
    const bv = Number(bText);
    if (!Number.isFinite(av) || !Number.isFinite(bv)) return;
    if (av === bv) setBText(String(av + 1));
    else if (av > bv) {
      setAText(String(bv));
      setBText(String(av));
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 text-xl font-semibold text-slate-900"><SlidersHorizontal className="h-5 w-5" /><span>Parámetros de exploración</span></div>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">Función f(x)</label>
            <input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="Ej.: sin(x)" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500" />
            <p className="text-sm text-slate-500">Podés escribir: x^2, sin(x), cos(x), exp(-x^2), sqrt(x+2), 1/(1+x^2).</p>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-700">Funciones sugeridas</div>
            <div className="flex flex-wrap gap-2">{presets1D.map((p) => <button key={p.expr} type="button" onClick={() => setExpr(p.expr)} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">{p.label}</button>)}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><label className="block text-sm font-medium text-slate-800">Extremo izquierdo a</label><input type="number" step="any" value={aText} onChange={(e) => setAText(e.target.value)} onBlur={fixIntervalOrder} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500" /></div>
            <div className="space-y-2"><label className="block text-sm font-medium text-slate-800">Extremo derecho b</label><input type="number" step="any" value={bText} onChange={(e) => setBText(e.target.value)} onBlur={fixIntervalOrder} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500" /></div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">Tipo de suma de Riemann</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500">{riemannModes1D.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between"><label className="block text-sm font-medium text-slate-800">Cantidad de divisiones</label><span className="text-sm font-medium text-slate-700">n = {n}</span></div>
            <input type="range" min="1" max="80" step="1" value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full" />
          </div>

          <button type="button" onClick={goTo2D} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">Ir a la simulación de 2 variables</button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 text-xl font-semibold text-slate-900">Gráfica y aproximación</div><Plot1D expr={expr} a={a} b={b} n={n} mode={mode} /></div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-4 md:grid-cols-3"><TextBlock title="Lectura geométrica">Los rectángulos muestran cómo se construye la suma de Riemann a partir de una partición uniforme del intervalo.</TextBlock><TextBlock title="Exploración conceptual">Al aumentar n, la aproximación mejora en muchos casos y permite discutir el concepto de integral definida.</TextBlock><TextBlock title="Uso en clase">Útil para comparar visualmente sumas por izquierda, derecha y punto medio en distintas funciones y dominios.</TextBlock></div></div>
      </div>
    </div>
  );
}

function TwoVariablePage({ goTo1D }) {
  const [expr, setExpr] = useState("sin(x)*cos(y)");
  const [axText, setAxText] = useState("-2");
  const [bxText, setBxText] = useState("2");
  const [ayText, setAyText] = useState("-2");
  const [byText, setByText] = useState("2");
  const [nx, setNx] = useState(6);
  const [ny, setNy] = useState(6);
  const [mode, setMode] = useState("mid");
  const [azimuthDeg, setAzimuthDeg] = useState(38);
  const [elevationDeg, setElevationDeg] = useState(24);
  const ax = Number(axText);
  const bx = Number(bxText);
  const ay = Number(ayText);
  const by = Number(byText);

  function fixRectDomain() {
    const vals = [Number(axText), Number(bxText), Number(ayText), Number(byText)];
    if (!vals.every(Number.isFinite)) return;
    let [newAx, newBx, newAy, newBy] = vals;
    if (newAx === newBx) newBx = newAx + 1;
    if (newAy === newBy) newBy = newAy + 1;
    if (newAx > newBx) [newAx, newBx] = [newBx, newAx];
    if (newAy > newBy) [newAy, newBy] = [newBy, newAy];
    setAxText(String(newAx));
    setBxText(String(newBx));
    setAyText(String(newAy));
    setByText(String(newBy));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 text-xl font-semibold text-slate-900"><SlidersHorizontal className="h-5 w-5" /><span>Parámetros del dominio</span></div>
        <div className="space-y-6">
          <div className="space-y-2"><label className="block text-sm font-medium text-slate-800">Función f(x,y)</label><input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="Ej.: sin(x)*cos(y)" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500" /><p className="text-sm text-slate-500">Podés escribir: x+y, x*y, x^2+y^2, sin(x)*cos(y), exp(-(x^2+y^2)).</p></div>
          <div className="space-y-3"><div className="text-sm font-medium text-slate-700">Funciones sugeridas</div><div className="flex flex-wrap gap-2">{presets2D.map((p) => <button key={p.expr} type="button" onClick={() => setExpr(p.expr)} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">{p.label}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><label className="block text-sm font-medium text-slate-800">x mínimo</label><input type="number" step="any" value={axText} onChange={(e) => setAxText(e.target.value)} onBlur={fixRectDomain} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500" /></div>
            <div className="space-y-2"><label className="block text-sm font-medium text-slate-800">x máximo</label><input type="number" step="any" value={bxText} onChange={(e) => setBxText(e.target.value)} onBlur={fixRectDomain} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500" /></div>
            <div className="space-y-2"><label className="block text-sm font-medium text-slate-800">y mínimo</label><input type="number" step="any" value={ayText} onChange={(e) => setAyText(e.target.value)} onBlur={fixRectDomain} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500" /></div>
            <div className="space-y-2"><label className="block text-sm font-medium text-slate-800">y máximo</label><input type="number" step="any" value={byText} onChange={(e) => setByText(e.target.value)} onBlur={fixRectDomain} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500" /></div>
          </div>
          <div className="space-y-2"><label className="block text-sm font-medium text-slate-800">Punto de muestreo</label><select value={mode} onChange={(e) => setMode(e.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500">{riemannModes2D.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <div className="space-y-4"><div className="flex items-center justify-between"><label className="block text-sm font-medium text-slate-800">Divisiones en x</label><span className="text-sm font-medium text-slate-700">nₓ = {nx}</span></div><input type="range" min="1" max="18" step="1" value={nx} onChange={(e) => setNx(Number(e.target.value))} className="w-full" /></div>
          <div className="space-y-4"><div className="flex items-center justify-between"><label className="block text-sm font-medium text-slate-800">Divisiones en y</label><span className="text-sm font-medium text-slate-700">nᵧ = {ny}</span></div><input type="range" min="1" max="18" step="1" value={ny} onChange={(e) => setNy(Number(e.target.value))} className="w-full" /></div>
          <div className="space-y-4"><div className="flex items-center justify-between"><label className="block text-sm font-medium text-slate-800">Rotación horizontal</label><span className="text-sm font-medium text-slate-700">{azimuthDeg}°</span></div><input type="range" min="-180" max="180" step="1" value={azimuthDeg} onChange={(e) => setAzimuthDeg(Number(e.target.value))} className="w-full" /></div>
          <div className="space-y-4"><div className="flex items-center justify-between"><label className="block text-sm font-medium text-slate-800">Inclinación</label><span className="text-sm font-medium text-slate-700">{elevationDeg}°</span></div><input type="range" min="5" max="80" step="1" value={elevationDeg} onChange={(e) => setElevationDeg(Number(e.target.value))} className="w-full" /></div>
          <button type="button" onClick={goTo1D} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50">Volver a la simulación de 1 variable</button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 text-xl font-semibold text-slate-900">Gráfica de la superficie y suma de volúmenes</div><Plot2D expr={expr} ax={ax} bx={bx} ay={ay} by={by} nx={nx} ny={ny} mode={mode} azimuthDeg={azimuthDeg} elevationDeg={elevationDeg} /></div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-4 md:grid-cols-3"><TextBlock title="Interpretación">Cada prisma representa el volumen de una celda de la partición del rectángulo del dominio en el plano xy.</TextBlock><TextBlock title="Discusión didáctica">Sirve para introducir integrales dobles como límite de sumas de Riemann y comparar distintos puntos de muestreo.</TextBlock><TextBlock title="Lectura del signo">Los prismas azules representan valores positivos y los rojizos valores negativos, para enfatizar el volumen orientado.</TextBlock></div></div>
      </div>
    </div>
  );
}

export default function RiemannSumsCalculo3Page() {
  const [view, setView] = useState("1d");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 lg:px-10">
        <div className="mb-8 rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-700">Visualización interactiva · Sumas de Riemann en 1 y 2 variables</div>
              <div className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">Cátedra de Cálculo 3</h1><p className="text-base text-slate-700 md:text-lg">Facultad de Ciencias Exactas, Ingeniería y Agrimensura</p></div>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">Herramienta académica para explorar sumas de Riemann en una y dos variables. Permite pasar de la interpretación de áreas con rectángulos a la interpretación de volúmenes con prismas rectangulares.</p>
            </div>
            <div className="flex flex-col items-start gap-4 lg:items-end">
              <SectionSwitcher view={view} setView={setView} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Pill icon={<LineChart className="h-4 w-4" />} label="Funciones editables" /><Pill icon={<Sigma className="h-4 w-4" />} label={view === "1d" ? "Suma por áreas" : "Suma por volúmenes"} /></div>
            </div>
          </div>
        </div>

        {view === "1d" ? <OneVariablePage goTo2D={() => setView("2d")} /> : <TwoVariablePage goTo1D={() => setView("1d")} />}
      </div>
    </div>
  );
}
