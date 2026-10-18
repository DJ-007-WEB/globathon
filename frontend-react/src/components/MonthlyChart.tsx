/* Grouped "forecast vs actual" bar chart (pure SVG, no dependencies).
   Monthly bars for FY periods, daily bars for a single month.
   Theme-aware via CSS classes, print friendly. Used by Overview and Report. */

import { fmt } from "../utils/format";

interface MonthlyChartProps {
  labels: string[];
  forecast_kwh: number[];
  actual_kwh: number[];
  gap_pct?: number[];
  height?: number;
}

const niceStep = (x: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1e-9))));
  const n = x / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
};

export const MonthlyChart = ({
  labels,
  forecast_kwh,
  actual_kwh,
  gap_pct,
  height = 360,
}: MonthlyChartProps) => {
  const W = 980;
  const H = height;
  const showGap = !!gap_pct && labels.length <= 14;
  const m = { l: 66, r: 18, t: 20, b: showGap ? 62 : 44 };
  const n = Math.max(labels.length, 1);
  const maxV = Math.max(1, ...forecast_kwh, ...actual_kwh);
  const step = niceStep((maxV * 1.06) / 4);
  const top = Math.max(step, Math.ceil((maxV * 1.06) / step) * step);
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;
  const y = (v: number) => m.t + (1 - v / top) * plotH;
  const gw = plotW / n;
  const bw = Math.max(2.5, Math.min(20, gw * 0.33));
  const xc = (i: number) => m.l + gw * i + gw / 2;
  const labelEvery = Math.max(1, Math.ceil(n / 16));

  const ticks: number[] = [];
  for (let t = 0; t <= top * 1.0001; t += step) ticks.push(t);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Forecast versus actual generation"
      className="mchart"
    >
      {ticks.map((t) => (
        <g key={`tick-${t}`}>
          <line
            className={t === 0 ? "mchart-zero" : "mchart-grid"}
            x1={m.l}
            x2={W - m.r}
            y1={y(t)}
            y2={y(t)}
            strokeDasharray={t === 0 ? undefined : "3 4"}
          />
          <text className="mchart-tick" x={m.l - 9} y={y(t) + 4} textAnchor="end">
            {fmt(t / 1000, 0)}
          </text>
        </g>
      ))}
      <text
        className="mchart-tick"
        x={16}
        y={m.t + plotH / 2}
        textAnchor="middle"
        transform={`rotate(-90 16 ${m.t + plotH / 2})`}
      >
        MWh
      </text>
      {labels.map((lab, i) => {
        const f = forecast_kwh[i] ?? 0;
        const ac = actual_kwh[i] ?? 0;
        const p = f ? ((ac - f) / f) * 100 : 0;
        const shortfall = ac < f;
        const pctLabel = (p < 0 ? "−" : "+") + fmt(Math.abs(p), 1) + "%";
        return (
          <g key={`col-${i}-${lab}`}>
            <rect
              className="mchart-forecast"
              x={xc(i) - bw - 1.5}
              y={y(f)}
              width={bw}
              height={Math.max(1, y(0) - y(f))}
              rx={2.5}
            >
              <title>{`${lab} — forecast ${fmt(f / 1000, 0)} MWh`}</title>
            </rect>
            <rect
              className={shortfall ? "mchart-actual mchart-neg" : "mchart-actual mchart-pos"}
              x={xc(i) + 1.5}
              y={y(ac)}
              width={bw}
              height={Math.max(1, y(0) - y(ac))}
              rx={2.5}
            >
              <title>{`${lab} — actual ${fmt(ac / 1000, 0)} MWh (${pctLabel} vs forecast)`}</title>
            </rect>
            {(n <= 16 || i % labelEvery === 0) && (
              <text className="mchart-tick" x={xc(i)} y={H - m.b + 17} textAnchor="middle">
                {lab}
              </text>
            )}
            {showGap && (
              <text
                className={p < 0 ? "mchart-gap mchart-neg" : "mchart-gap mchart-pos"}
                x={xc(i)}
                y={H - m.b + 34}
                textAnchor="middle"
              >
                {pctLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
