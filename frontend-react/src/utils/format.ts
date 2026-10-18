/* Formatting utilities — ported exactly from the original frontend/app.js.
   No UI/UX/design changes; only the same formatting helpers reused in React. */

export const fmt = (x: number, d = 0) =>
  (x < 0 ? "−" : "") + Math.abs(x).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });

export const mwh = (kwh: number, d = 1) => fmt(kwh / 1000, d) + " MWh";
export const sg = (kwh: number, d = 1) => (kwh > 0 ? "+" : "") + mwh(kwh, d);
export const lakh = (inr: number) =>
  (inr < 0 ? "−" : "") + "₹" + fmt(Math.abs(inr) / 1e5, 1) + " L";
export const per = (p: string) =>
  p === "FY" ? "FY 25-26" : new Date(p + "-01").toLocaleString("en", { month: "short", year: "2-digit" });
export const esc = (s: any) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

export const niceStep = (x: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
};

export const wrap = (t: string, n: number) => {
  const w = t.split(" ");
  const out: string[] = [];
  let c = "";
  for (const x of w) {
    if ((c + " " + x).trim().length > n) {
      out.push(c);
      c = x;
    } else c = (c + " " + x).trim();
  }
  if (c) out.push(c);
  return out;
};
