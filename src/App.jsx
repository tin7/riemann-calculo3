import React, { useMemo, useState } from "react";
import { AlertCircle, Sigma, SlidersHorizontal, LineChart } from "lucide-react";

const presets = [
  { label: "x²", expr: "x^2" },
  { label: "sin(x)", expr: "sin(x)" },
  { label: "cos(x)", expr: "cos(x)" },
  { label: "exp(-x^2)", expr: "exp(-x^2)" },
  { label: "x^3 - 2*x + 1", expr: "x^3 - 2*x + 1" },
  { label: "sqrt(x+2)", expr: "sqrt(x+2)" },
  { label: "1/(1+x^2)", expr: "1/(1+x^2)" },
];

const riemannModes = [
  { value: "left", label: "Izquierda" },
  { value: "right", label: "Derecha" },
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

function compileFunction(expr) {
  const normalized = normalizeExpression(expr.trim());

  if (!normalized) {
    throw new Error("La función está vacía.");
  }

  const allowedPattern = /^[0-9x+\-*/().,^\s_a-zA-Z]+$/;
  if (!allowedPattern.test(expr)) {
    throw new Error("La función contiene caracteres no permitidos.");
  }

  const fn = new Function(
    "x",
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
    `
  );

  return (x) => {
    const y = fn(x);
    if (typeof y !== "number" || !Number.isFinite(y)) return NaN;
    return y;
  };
}

function buildPlotData(f, a, b, n, mode) {
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
  return {
    points,
    rects,
    sum,
    ymin: ymin - pad,
    ymax: ymax + pad,
  };
}

function mapX(x, a, b, width, margin) {
  if (a === b) return margin.left;
  return margin.left + ((x - a) / (b - a)) * (width - margin.left - margin.right);
}

function mapY(y, ymin, ymax, height, margin) {
  if (ymin === ymax) return height / 2;
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
      </g>
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
      </g>
    );
  }

  return <>{items}</>;
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

function Plot({ expr, a, b, n, mode }) {
  const width = 920;
  const height = 470;
  const margin = { top: 24, right: 28, bottom: 44, left: 70 };

  const { error, plot } = useMemo(() => {
    try {
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        throw new Error("El intervalo no es válido.");
      }
      if (a === b) {
        throw new Error("Los extremos del intervalo no pueden coincidir.");
      }
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("La cantidad de divisiones debe ser un entero positivo.");
      }
      const f = compileFunction(expr);
      return { error: null, plot: buildPlotData(f, a, b, n, mode) };
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
                <rect
                  x={x0}
                  y={top}
                  width={Math.max(0, x1 - x0)}
                  height={h}
                  fill="rgba(37,99,235,0.15)"
                  stroke="rgba(37,99,235,0.55)"
                  strokeWidth="1"
                />
                <circle
                  cx={mapX(r.xSample, a, b, width, margin)}
                  cy={yh}
                  r="2.6"
                  fill="rgba(29,78,216,0.95)"
                />
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
        <InfoCard title="Modo" value={riemannModes.find((m) => m.value === mode)?.label ?? "—"} subtitle="Tipo de suma" />
        <InfoCard title="Σ f(xᵢ*)Δx" value={niceNumber(sum)} subtitle="Aproximación de Riemann" />
      </div>
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

export default function RiemannSumsCalculo3Page() {
  const [expr, setExpr] = useState("sin(x)");
  const [aText, setAText] = useState(String(-Math.PI));
  const [bText, setBText] = useState(String(Math.PI));
  const [n, setN] = useState(8);
  const [mode, setMode] = useState("mid");

  const a = Number(aText);
  const b = Number(bText);

  function fixIntervalOrder() {
    const aVal = Number(aText);
    const bVal = Number(bText);

    if (!Number.isFinite(aVal) || !Number.isFinite(bVal)) return;
    if (aVal === bVal) {
      setBText(String(aVal + 1));
      return;
    }
    if (aVal > bVal) {
      setAText(String(bVal));
      setBText(String(aVal));
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 lg:px-10">
        <div className="mb-8 rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                Visualización interactiva · Sumas de Riemann
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                  Cátedra de Cálculo 3
                </h1>
                <p className="text-base text-slate-700 md:text-lg">
                  Facultad de Ciencias Exactas, Ingeniería y Agrimensura
                </p>
              </div>

              <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                Herramienta académica para explorar la relación entre la gráfica de una función y su aproximación mediante sumas de Riemann. Permite modificar la función, el intervalo y la cantidad de subdivisiones.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Pill icon={<LineChart className="h-4 w-4" />} label="Funciones editables" />
              <Pill icon={<Sigma className="h-4 w-4" />} label="Suma izquierda, derecha y media" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2 text-xl font-semibold text-slate-900">
              <SlidersHorizontal className="h-5 w-5" />
              <span>Parámetros de exploración</span>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-800">Función f(x)</label>
                <input
                  value={expr}
                  onChange={(e) => setExpr(e.target.value)}
                  placeholder="Ej.: sin(x)"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none ring-0 transition focus:border-slate-500"
                />
                <p className="text-sm text-slate-500">
                  Podés escribir: x^2, sin(x), cos(x), exp(-x^2), sqrt(x+2), 1/(1+x^2).
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700">Funciones sugeridas</div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.expr}
                      type="button"
                      onClick={() => setExpr(preset.expr)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-200" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-800">Extremo izquierdo a</label>
                  <input
                    type="number"
                    step="any"
                    value={aText}
                    onChange={(e) => setAText(e.target.value)}
                    onBlur={fixIntervalOrder}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-800">Extremo derecho b</label>
                  <input
                    type="number"
                    step="any"
                    value={bText}
                    onChange={(e) => setBText(e.target.value)}
                    onBlur={fixIntervalOrder}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-800">Tipo de suma de Riemann</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-slate-500"
                >
                  {riemannModes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-800">Cantidad de divisiones</label>
                  <span className="text-sm font-medium text-slate-700">n = {n}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="80"
                  step="1"
                  value={n}
                  onChange={(e) => setN(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                La aproximación se calcula como <span className="font-semibold text-slate-900">Σ f(xᵢ*)Δx</span> sobre el intervalo [a,b], donde el punto xᵢ* depende del tipo de suma elegido.
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 text-xl font-semibold text-slate-900">Gráfica y aproximación</div>
              <Plot expr={expr} a={a} b={b} n={n} mode={mode} />
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-3">
                <TextBlock title="Lectura geométrica">
                  Los rectángulos muestran cómo se construye la suma de Riemann a partir de una partición uniforme del intervalo.
                </TextBlock>
                <TextBlock title="Exploración conceptual">
                  Al aumentar n, la aproximación mejora en muchos casos y permite discutir el concepto de integral definida.
                </TextBlock>
                <TextBlock title="Uso en clase">
                  Útil para comparar visualmente sumas por izquierda, derecha y punto medio en distintas funciones y dominios.
                </TextBlock>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
