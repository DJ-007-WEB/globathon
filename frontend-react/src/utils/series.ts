/* Chart series helpers — turn the analysis payload's daily series into
   chart-ready arrays. FY periods are aggregated to calendar months;
   single-month periods stay daily. Used by Overview and the report. */

export interface ChartSeries {
  labels: string[];
  forecast_kwh: number[];
  actual_kwh: number[];
  gap_pct: number[];
  monthly: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pct = (f: number, ac: number) => (f ? ((ac - f) / f) * 100 : 0);

export const buildChartSeries = (a: any): ChartSeries => {
  const dates: string[] = a?.daily?.dates ?? [];
  const fc: number[] = a?.daily?.forecast_kwh ?? [];
  const ac: number[] = a?.daily?.actual_kwh ?? [];
  const monthly = a?.period === "FY" || dates.length > 62;

  if (!monthly) {
    return {
      labels: dates.map((d) => String(Number(d.slice(8, 10)))),
      forecast_kwh: fc,
      actual_kwh: ac,
      gap_pct: fc.map((f, i) => pct(f, ac[i] ?? 0)),
      monthly: false,
    };
  }

  const index = new Map<string, number>();
  const keys: string[] = [];
  const mf: number[] = [];
  const ma: number[] = [];

  dates.forEach((d, i) => {
    const key = d.slice(0, 7);
    let k = index.get(key);
    if (k === undefined) {
      k = keys.length;
      index.set(key, k);
      keys.push(key);
      mf.push(0);
      ma.push(0);
    }
    mf[k] += fc[i] ?? 0;
    ma[k] += ac[i] ?? 0;
  });

  return {
    labels: keys.map((k) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`),
    forecast_kwh: mf,
    actual_kwh: ma,
    gap_pct: mf.map((f, i) => pct(f, ma[i])),
    monthly: true,
  };
};
