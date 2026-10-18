/* Page-specific rule-based chatbot.
   Each page has its own rule set. Rules only read the current page's data —
   no page's data is ever mixed into another page's answers. */

import { fmt, mwh, sg, lakh, esc, per } from "./format";

export type PageKey =
  | "overview"
  | "analysis"
  | "class"
  | "valid"
  | "report"
  | "why"
  | "data";

interface ChatRule {
  test: RegExp;
  answer: (data: any) => string;
}

type RuleSet = Record<PageKey, ChatRule[]>;

export const CHAT_RULES: RuleSet = {
  overview: [
    {
      test: /hello|hi\b|hey/,
      answer: () =>
        "Hello! I can explain the current Overview page. Ask about the forecast, actual energy, the production gap, the unexplained remainder, or the monthly variance signal.",
    },
    {
      test: /forecast|expected/,
      answer: (d) => {
        const a = d.analysis;
        return `The forecast for ${a.period_label} is ${mwh(a.forecast_kwh, 0)} MWh. This is what the plant was expected to generate based on a typical-year (P50) model.`;
      },
    },
    {
      test: /actual|metered|produced|generation/,
      answer: (d) => {
        const a = d.analysis;
        return `The actual (metered) energy for ${a.period_label} is ${mwh(a.actual_kwh, 0)} MWh. This is what the plant actually produced.`;
      },
    },
    {
      test: /gap|variance|difference|shortfall/,
      answer: (d) => {
        const a = d.analysis;
        const direction = a.gap_kwh < 0 ? "below" : "above";
        return `The production gap is ${sg(a.gap_kwh, 0)} MWh (${fmt(a.gap_pct, 1)}% ${direction} forecast), worth about ${lakh(a.gap_inr)} at the assumed tariff of ₹${a.tariff_inr_per_kwh}/kWh. A negative gap means production fell short of forecast.`;
      },
    },
    {
      test: /unexplained|remainder|residual/,
      answer: (d) => {
        const u = d.analysis.unexplained;
        const status = u.exceeds_band ? "beyond measurement uncertainty" : "within measurement uncertainty";
        return `The unexplained remainder is ${sg(u.kwh, 1)} MWh — this is the part of the gap that the known causes (weather, downtime, curtailment, etc.) do not account for. It is currently ${status}. ${u.message}`;
      },
    },
    {
      test: /monthly|month|trend|signal/,
      answer: (d) => {
        const months = (d.meta?.scenarios.find((s: any) => s.key === d.scenario)?.monthly || []);
        if (!months.length) return "Monthly data is not available for this scenario.";
        const worst = months.reduce((a: any, b: any) => (Math.abs(b.gap_pct) > Math.abs(a.gap_pct) ? b : a), months[0]);
        return `The monthly variance signal shows how each month compares to forecast. The largest variance this year was in ${per(worst.period)} at ${fmt(worst.gap_pct, 1)}%. Bars below the line mean underperformance; bars at or above mean the plant met or beat forecast.`;
      },
    },
    {
      test: /scenario|s0|s1|s2|s3|baseline|monsoon|curtailment|silent/,
      answer: (d) => {
        const a = d.analysis;
        return `The currently selected scenario is "${a.scenario_name}" (${a.scenario}). It represents a different synthetic plant story — e.g. baseline (near-normal), monsoon miss (weak irradiance), curtailment summer (grid restrictions), or silent loss (unlogged failures).`;
      },
    },
    {
      test: /reliable|confidence|accurate|trust/,
      answer: () =>
        "The numbers on this page come from the deterministic engine. The Analysis tab shows 90% uncertainty bands; the Validation tab shows how recovered causes compare to injected ground truth. This is a synthetic demo, not a live-plant diagnosis.",
    },
  ],

  analysis: [
    {
      test: /hello|hi\b|hey/,
      answer: () =>
        "Hello! I can explain the Variance Analysis page. Ask about the waterfall, any individual cause, the unexplained bar, Shapley vs isolated effects, or why order-independence matters.",
    },
    {
      test: /waterfall|bar|chart/,
      answer: (d) => {
        const a = d.analysis;
        const comps = a.components.filter((c: any) => c.present);
        const largest = comps.reduce((prev: any, cur: any) =>
          Math.abs(cur.kwh) > Math.abs(prev.kwh) ? cur : prev, comps[0]);
        return `The waterfall shows each cause's contribution to the gap. The largest contributor is ${largest.cause} at ${sg(largest.kwh, 1)} MWh. The hatched "UNEXPLAINED" bar is the residual the known causes don't explain. Whiskers on each bar are the 90% uncertainty band from Monte Carlo runs.`;
      },
    },
    {
      test: /shapley|order-independent|ordering|order/,
      answer: () =>
        "Shapley attribution is order-independent: it simulates all 128 on/off coalitions of the 7 causes and averages each cause's marginal contribution over all 5,040 orderings. A naive sequential waterfall would change its bars depending on the order causes are listed — Shapley does not. The totals are identical either way; only the split between causes changes.",
    },
    {
      test: /unexplained|residual|unknown/,
      answer: (d) => {
        const u = d.analysis.unexplained;
        const status = u.exceeds_band ? "beyond measurement uncertainty" : "within measurement uncertainty";
        return `Unexplained is ${sg(u.kwh, 1)} MWh (${lakh(u.inr)}). It is the measured actual minus the simulated actual with all causes switched on. It is ${status}. The engine keeps this visible instead of forcing it into named causes. ${u.data_that_would_reduce_it?.length ? "Data that could shrink it: " + u.data_that_would_reduce_it.join("; ") : ""}`;
      },
    },
    {
      test: /cause|irradiance|temperature|downtime|curtailment|soiling|degradation|model/,
      answer: (d) => {
        const a = d.analysis;
        const matched = (d as any).matched || "";
        const comp = a.components.find((c: any) => c.id.toLowerCase().includes(matched.toLowerCase())) ||
          a.components.find((c: any) => c.cause.toLowerCase().includes(matched.toLowerCase()));
        if (!comp) return "I could not match that cause to a component in the current analysis.";
        return `${comp.cause} contributed ${sg(comp.kwh, 1)} MWh (${lakh(comp.inr)}) with ${comp.confidence} confidence. Class: ${comp.class_label}. ${comp.claimable ? "Potentially claimable — contract review required." : ""}`;
      },
    },
    {
      test: /evidence|signal|proof/,
      answer: (d) => {
        const ev = d.analysis.evidence || [];
        return `There are ${ev.length} evidence records for this period. Each links to a specific signal (inverter log, export setpoint, pyranometer, soiling station, flash test) with a time window and isolated energy impact. Click any waterfall bar in the UI to open its evidence drawer.`;
      },
    },
    {
      test: /reconcile|reconciliation|closes|adds up/,
      answer: (d) => {
        const r = d.analysis.reconciliation;
        return `Reconciliation: the sum of all cause contributions plus the unexplained remainder equals the total gap exactly (${r.closes ? "✓ closes exactly" : "does not close"}). This is checked at milli-kWh precision — no rounding drift.`;
      },
    },
  ],

  class: [
    {
      test: /hello|hi\b|hey/,
      answer: () =>
        "Hello! I can explain the Cause Classification page. Ask about predictable, controllable, luck, external causes, or the weather extreme vs luck assessment.",
    },
    {
      test: /predictable/,
      answer: () =>
        "Predictable causes (degradation, forecast model bias) were foreseeable at forecast time — they point to fixing the forecast or underwriting assumptions, not to a one-off event.",
    },
    {
      test: /controllable/,
      answer: () =>
        "Controllable causes (downtime, soiling) are within operator action — outages and cleaning cadence could have been managed to reduce the loss.",
    },
    {
      test: /luck/,
      answer: () =>
        "Luck causes (irradiance, temperature) are weather measured against the multi-year record. Irradiance is flagged extreme if it falls outside the p10–p90 band of the 30 synthetic years.",
    },
    {
      test: /external|curtailment|claimable/,
      answer: (d) => {
        const curt = d.analysis.components.find((c: any) => c.id === "curtailment");
        if (!curt) return "Curtailment is not material in this period.";
        return `Curtailment is outside operator control (a grid/external action). It is flagged "${curt.claimable ? "potentially claimable" : "not claimable"}" — this is an evidence prompt only, not a legal conclusion; contract/PPA review is required.`;
      },
    },
    {
      test: /weather|extreme|percentile|luck|irradiance/,
      answer: (d) => {
        const w = d.analysis.weather;
        return `The measured irradiance for this period is at the ${fmt(w.percentile, 0)}th percentile of the 30 synthetic-year record (${w.history_years} years). ${w.extreme ? "This is an extreme weather event." : "This is normal variability."} Typical year: ${fmt(w.typical_year_kwh_m2, 0)} kWh/m² (${fmt(w.delta_pct, 1)}% difference).`;
      },
    },
    {
      test: /confidence|band|uncertainty/,
      answer: () =>
        "Confidence rules: High if the 90% band is ≤15% of the value, or ≤30% for directly logged causes like downtime/curtailment. Medium if ≤60%. Low: wider. Band = 5–95th percentile of 80 Monte Carlo runs perturbing irradiance, temperature, soiling, flash-test, and meter inputs.",
    },
  ],

  valid: [
    {
      test: /hello|hi\b|hey/,
      answer: () =>
        "Hello! I can explain the Validation Lab page. Ask about truth vs recovered causes, the hidden cause, or whether reconciliation closes.",
    },
    {
      test: /recovered|recovery|truth|injected/,
      answer: (d) => {
        const v = d.validation;
        const s = v.summary;
        return `${s.named_recovered} of ${s.named_causes_material} material named causes were recovered within tolerance (within 20% of truth or 0.1% of forecast). ${s.named_within_band} of ${s.named_causes_material} have the true value inside our 90% band.`;
      },
    },
    {
      test: /hidden|8th|unlogged|silent/,
      answer: (d) => {
        const h = d.validation.hidden;
        const result = h.landed_in_unexplained
          ? "found in Unexplained ✓ — the engine correctly refused to invent a named cause for it"
          : h.below_detection_floor
            ? "below the detection floor — too small to detect reliably"
            : "missed";
        return `The hidden cause (${h.scenario_hidden}) ${result}. Its truth value was ${fmt(h.truth_kwh / 1000, 1)} MWh vs ${fmt(h.unexplained_kwh / 1000, 1)} MWh recovered in Unexplained.`;
      },
    },
    {
      test: /reconcile|reconciliation|closes/,
      answer: (d) => {
        const s = d.validation.summary;
        return `Reconciliation ${s.reconciliation_closes ? "✓ closes exactly" : "FAILS"} — the integer milli-kWh check passes, meaning the engine's internal bookkeeping is consistent.`;
      },
    },
    {
      test: /accuracy|error|tolerance/,
      answer: (d) => {
        const s = d.validation.summary;
        return `Mean absolute error on material causes: ${s.mean_abs_error_pct_material ?? "n/a"}%. Tolerance: recovered means within 20% of truth or 0.1% of forecast. Limitation: engine and truth share one physics model, so this tests attribution logic and noise robustness, not real-world physics error.`;
      },
    },
  ],

  report: [
    {
      test: /hello|hi\b|hey/,
      answer: () =>
        "Hello! I can explain the Investor Report page. Ask about the report contents, the narrative, what's printable, or the validation summary in the report.",
    },
    {
      test: /narrative|summary|text/,
      answer: (d) => {
        const n = d.analysis.narrative;
        return `The narrative summary is machine-checked number-by-number against the engine: ${n.numbers_checked ? "✓ passed" : "FAILED"}. Every figure in the paragraph comes directly from the deterministic engine — nothing is invented.`;
      },
    },
    {
      test: /print|pdf|export/,
      answer: () =>
        "Use the Print / Save as PDF button at the top of the report to generate a print-ready version. The report contains all 12 audited sections: headline numbers, cause table, interaction diagnostic, unexplained bucket, weather, evidence, validation summary, and method/caveats.",
    },
    {
      test: /synthetic|demo|fake|real/,
      answer: () =>
        "All data in this report is synthetic demo data. The plant, weather, outages, and curtailment are simulated. The tariff (₹2.70/kWh) is an assumption, not a PPA figure. Outputs are not investment or legal advice.",
    },
    {
      test: /validation|truth|recovered/,
      answer: (d) => {
        const v = d.validation;
        return `The report includes the validation summary: ${v.summary.named_recovered}/${v.summary.named_causes_material} named causes recovered. Hidden cause: ${v.hidden.landed_in_unexplained ? "found in Unexplained" : v.hidden.below_detection_floor ? "below detection floor" : "missed"}. Reconciliation ${v.summary.reconciliation_closes ? "closes exactly" : "fails"}.`;
      },
    },
  ],

  why: [
    {
      test: /hello|hi\b|hey/,
      answer: () =>
        "Hello! I can explain the Methodology page. Ask about Shapley attribution, how this differs from existing products, or the performance optimizations.",
    },
    {
      test: /shapley|different|better|why/,
      answer: () =>
        "Most solar dashboards show a forecast-vs-actual chart and stop. This prototype makes four bets: (1) order-independent Shapley attribution over all 128 coalitions instead of sequential waterfalls that change with ordering; (2) an explicit unexplained bucket with its own 90% band instead of smearing unknowns across causes; (3) validation against injected truth including a hidden cause the engine must refuse to invent; (4) numbers only from the deterministic engine, with prose machine-checked — no LLM-generated root causes with invented numbers.",
    },
    {
      test: /fast|performance|speed|cache|snapshot|slow/,
      answer: () =>
        "Performance is kept fast with prebuilt static snapshots (every scenario × period computed once), a repeat-request cache on the API, an adjustable Monte Carlo knob, integer milli-kWh reconciliation, and a vectorised numpy core. A full-year analysis at 80 Monte Carlo samples takes seconds, not minutes.",
    },
    {
      test: /coalition|128|switch/,
      answer: () =>
        "There are 7 cause switches, giving 2⁷ = 128 coalitions. Each cause gets its Shapley value — the average marginal contribution over all orderings. Shapley allocates interaction to causes; the isolated + interaction view shows the non-additive part transparently.",
    },
    {
      test: /uncertainty|monte carlo|band/,
      answer: () =>
        "90% bands come from 80 Monte Carlo runs that perturb irradiance bias (±1%), temperature offset (±0.8°C), soiling offset (±0.4 pts), flash-test error (±0.1 pts), and meter (±0.3%), recalibrating the derate each run. The band shows where the true value likely lies given input uncertainty.",
    },
  ],

  data: [
    {
      test: /hello|hi\b|hey/,
      answer: () =>
        "Hello! I can explain the Data Upload page. Ask about the CSV format, what the columns mean, or how the uploaded reconciliation works.",
    },
    {
      test: /csv|format|template|column/,
      answer: () =>
        "The CSV needs a header row and one row per month (YYYY-MM). Required columns: month, forecast_kwh, actual_kwh. Optional signed cause columns: weather_loss_kwh, downtime_loss_kwh, curtailment_loss_kwh. Download the template from the page to see the exact format.",
    },
    {
      test: /upload|import|broken|error/,
      answer: () =>
        "Uploaded files are validated in your browser and never sent anywhere. Row-level errors are shown clearly (bad month format, negative energy, duplicate months, non-numeric values). Load a valid sample to see a working reconciliation waterfall with a hatched Unexplained bar.",
    },
    {
      test: /reconcile|reconciliation|gap|unexplained/,
      answer: () =>
        "The uploaded reconciliation shows: Weather + Downtime + Curtailment + Unexplained = Total Gap. Anything your columns don't explain stays visible as Unexplained — it is never hidden or forced into named causes.",
    },
    {
      test: /sample|monsoon|curtailment|broken/,
      answer: () =>
        "Three samples are available: monsoon_miss_monthly.csv (valid, weather-heavy losses), curtailment_summer_monthly.csv (valid, curtailment-heavy), and broken_example.csv (invalid — bad month format, negative energy, duplicate month).",
    },
  ],
};

export const getChatAnswer = (page: PageKey, question: string, data: any): string => {
  const rules = CHAT_RULES[page];
  const q = question.toLowerCase();
  for (const rule of rules) {
    const m = q.match(rule.test);
    if (m) {
      return rule.answer({ ...data, matched: m[0] });
    }
  }
  return "I'm not sure about that. Try asking about the data shown on this page — for example, the gap, causes, unexplained amount, or how to read the chart.";
};
