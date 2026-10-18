/* Hand-drawn SVG waterfall — same visual as the original app.js waterfall().
   Props mirror the original `steps`/`waterfall` logic. */

import { fmt, sg, esc, wrap } from "../utils/format";

const niceStep = (x: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
};

interface Step {
  id: string;
  label: string;
  v: number;
  start: number;
  end: number;
  lo?: number;
  hi?: number;
  cls: string;
  c?: any;
}

interface WaterfallProps {
  steps: Step[];
  totalLabel?: string;
  width?: number;
  height?: number;
  sel?: string;
  onSelect?: (id: string) => void;
}

export const Waterfall = ({
  steps,
  totalLabel = "Total gap",
  width = 980,
  height = 400,
  sel,
  onSelect,
}: WaterfallProps) => {
  const m = { l: 74, r: 16, t: 20, b: 78 };
  const W = width;
  const H = height;

  const vals = steps.flatMap((s) => [s.start, s.end, s.lo ?? s.end, s.hi ?? s.end]).concat([0]);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad;
  hi += pad;

  const y = (v: number) => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
  const bw = (W - m.l - m.r) / steps.length;
  const bx = (i: number) => m.l + i * bw + bw * 0.16;
  const bwid = bw * 0.68;

  const ticks = 5;
  const step = niceStep((hi - lo) / ticks);

  const gridLines: React.ReactNode[] = [];
  for (
    let t = Math.ceil(lo / step) * step;
    t <= hi;
    t += step
  ) {
    gridLines.push(
      <line
        key={`g-${t}`}
        x1={m.l}
        x2={W - m.r}
        y1={y(t)}
        y2={y(t)}
        stroke={Math.abs(t) < 1e-9 ? "#1c2430" : "#e8e4d9"}
        strokeWidth={Math.abs(t) < 1e-9 ? 1.4 : 1}
      />
    );
    gridLines.push(
      <text
        key={`gt-${t}`}
        x={m.l - 8}
        y={y(t) + 4}
        textAnchor="end"
        fontSize={11}
        fill="#667085"
      >
        {fmt(t / 1000, 0)}
      </text>
    );
  }

  const bars: React.ReactNode[] = [];
  steps.forEach((s, i) => {
    const top = Math.min(y(s.start), y(s.end));
    const h = Math.max(2, Math.abs(y(s.start) - y(s.end)));
    const fill =
      s.cls === "unexplained"
        ? "url(#hatch)"
        : s.cls === "total"
          ? "#1f3a5f"
          : s.cls === "interaction"
            ? "#94a3b8"
            : s.v < 0
              ? "#b4452b"
              : "#0f766e";
    const stroke = s.cls === "unexplained" ? "#7c2d12" : "none";
    const sw = s.cls === "unexplained" ? 3 : 0;
    const isSel = sel === s.id ? " sel" : "";

    bars.push(
      <rect
        key={`bar-${i}`}
        className={`bar${isSel}`}
        data-id={s.id}
        x={bx(i)}
        y={top}
        width={bwid}
        height={h}
        rx={3}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        onClick={() => onSelect?.(s.id)}
        style={{ cursor: "pointer" }}
      >
        <title>{`${esc(s.label)}: ${sg(s.v)}`}</title>
      </rect>
    );

    if (s.lo != null && s.hi != null && s.cls !== "total") {
      const cx = bx(i) + bwid / 2;
      bars.push(
        <g key={`whisker-${i}`} stroke="#1c2430" strokeWidth={1.5}>
          <line x1={cx} x2={cx} y1={y(s.lo!)} y2={y(s.hi!)} />
          <line x1={cx - 6} x2={cx + 6} y1={y(s.lo!)} y2={y(s.lo!)} />
          <line x1={cx - 6} x2={cx + 6} y1={y(s.hi!)} y2={y(s.hi!)} />
        </g>
      );
    }

    const ty =
      s.v < 0
        ? Math.max(y(s.start), y(s.end), y(s.lo ?? s.end)) + 16
        : Math.min(y(s.start), y(s.end), y(s.hi ?? s.end)) - 8;

    bars.push(
      <text
        key={`val-${i}`}
        x={bx(i) + bwid / 2}
        y={ty}
        textAnchor="middle"
        fontSize={12}
        fontWeight={s.cls === "unexplained" ? 800 : 600}
        fill={s.cls === "unexplained" ? "#7c2d12" : "#1c2430"}
      >
        {fmt(s.v / 1000, 1)}
      </text>
    );

    const lbl = wrap(s.label, 14);
    lbl.forEach((l, k) => {
      bars.push(
        <text
          key={`lbl-${i}-${k}`}
          x={bx(i) + bwid / 2}
          y={H - m.b + 16 + k * 13}
          textAnchor="middle"
          fontSize={11.5}
          fontWeight={s.cls === "unexplained" ? 800 : 500}
          fill={s.cls === "unexplained" ? "#7c2d12" : "#1c2430"}
        >
          {esc(l)}
        </text>
      );
    });

    if (s.c) {
      bars.push(
        <text
          key={`cls-${i}`}
          x={bx(i) + bwid / 2}
          y={H - m.b + 16 + lbl.length * 13 + 2}
          textAnchor="middle"
          fontSize={10}
          fill="#667085"
        >
          {esc(s.c.class_label.toLowerCase())}
        </text>
      );
    }

    if (i < steps.length - 1 && s.cls !== "total") {
      bars.push(
        <line
          key={`conn-${i}`}
          x1={bx(i) + bwid}
          x2={bx(i + 1)}
          y1={y(s.end)}
          y2={y(s.end)}
          stroke="#98a2b3"
          strokeDasharray="3 3"
        />
      );
    }
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Variance waterfall"
    >
      <defs>
        <pattern
          id="hatch"
          width={8}
          height={8}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={8} height={8} fill="#fde68a" />
          <line x1={0} y1={0} x2={0} y2={8} stroke="#b45309" strokeWidth={4} />
        </pattern>
      </defs>
      <text
        x={14}
        y={H / 2 - 30}
        transform={`rotate(-90 14 ${H / 2 - 30})`}
        fontSize={11}
        fill="#667085"
        textAnchor="middle"
      >
        MWh vs forecast
      </text>
      {gridLines}
      {bars}
    </svg>
  );
};
