/* Daily forecast vs actual line chart — same visual as original daily(). */

import { fmt, mwh, esc } from "../utils/format";

interface DailyChartProps {
  dates: string[];
  forecast_kwh: number[];
  actual_kwh: number[];
}

export const DailyChart = ({ dates, forecast_kwh, actual_kwh }: DailyChartProps) => {
  const W = 700;
  const H = 170;
  const m = { l: 44, r: 8, t: 10, b: 22 };
  const n = dates.length;
  const mx = Math.max(...forecast_kwh, ...actual_kwh) * 1.05;

  const x = (i: number) => m.l + (i / Math.max(n - 1, 1)) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - v / mx) * (H - m.t - m.b);

  const path = (arr: number[]) =>
    arr.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("");

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="#ccc" />
        <text
          x={m.l - 6}
          y={y(mx) + 12}
          textAnchor="end"
          fontSize={10}
          fill="#667085"
        >
          {fmt(mx / 1000, 0)}
        </text>
        <text
          x={m.l - 6}
          y={y(0)}
          textAnchor="end"
          fontSize={10}
          fill="#667085"
        >
          0
        </text>
        <path
          d={path(forecast_kwh)}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.6}
        />
        <path
          d={path(actual_kwh)}
          fill="none"
          stroke="#1f3a5f"
          strokeWidth={1.6}
        />
        <text
          x={m.l}
          y={H - 5}
          fontSize={10}
          fill="#667085"
        >
          {dates[0]}
        </text>
        <text
          x={W - m.r}
          y={H - 5}
          textAnchor="end"
          fontSize={10}
          fill="#667085"
        >
          {dates[n - 1]}
        </text>
        <text x={W - 120} y={18} fontSize={11} fill="#94a3b8">
          — forecast
        </text>
        <text x={W - 60} y={18} fontSize={11} fill="#1f3a5f">
          — actual
        </text>
      </svg>
      <div className="note">MWh per day</div>
    </>
  );
};
