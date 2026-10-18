/* Investor report view — printable page with inline variance analysis charts
   (waterfall + forecast-vs-actual bars), each explained in plain language. */

import { fmt, mwh, sg, esc, lakh } from "../../utils/format";
import { Waterfall } from "../Waterfall";
import { MonthlyChart } from "../MonthlyChart";
import { buildChartSeries } from "../../utils/series";

interface ReportProps {
  a: any;
  v: any;
}

export const Report = ({ a, v }: ReportProps) => {
  const u = a.unexplained;
  const w = a.weather;
  const series = buildChartSeries(a);

  // Same waterfall steps as the interactive Variance analysis view (Shapley).
  const steps = (() => {
    const out: any[] = [];
    let cum = 0;
    for (const c of a.components.filter((c: any) => c.present)) {
      out.push({
        id: c.id,
        label: c.cause,
        v: c.kwh,
        start: cum,
        end: cum + c.kwh,
        lo: cum + c.lower_kwh,
        hi: cum + c.upper_kwh,
        cls: c.class,
        c,
      });
      cum += c.kwh;
    }
    out.push({
      id: "unexplained",
      label: "UNEXPLAINED",
      v: u.kwh,
      start: cum,
      end: cum + u.kwh,
      lo: cum + u.lower_kwh,
      hi: cum + u.upper_kwh,
      cls: "unexplained",
    });
    cum += u.kwh;
    out.push({
      id: "total",
      label: "Total gap",
      v: cum,
      start: 0,
      end: cum,
      cls: "total",
    });
    return out;
  })();

  const simpleExplanation = (
    <div className="card">
      <h3>What this report contains — in simple terms</h3>
      <div className="sub">
        <p>
          <strong>Summary:</strong> a plain-language paragraph of what happened this period. Every number in it is machine-checked against the engine — nothing is invented.
        </p>
        <p>
          <strong>Charts:</strong> Chart 1 (variance waterfall) shows where the megawatt-hours went — starting from the forecast, each named cause, then the unexplained remainder, landing exactly on the metered actual. Chart 2 shows when the variance occurred. Thin whiskers on the waterfall bars are the 90% uncertainty band from Monte Carlo runs.
        </p>
        <p>
          <strong>Cause table:</strong> each named cause with its contribution (MWh), monetary impact (₹ lakh), 90% uncertainty band, and confidence level. Curtailment may be flagged "potentially claimable — contract review required."
        </p>
        <p>
          <strong>Unexplained:</strong> the residual the known causes can't explain, with its own band and guidance on what data would shrink it.
        </p>
        <p>
          <strong>Weather:</strong> the irradiance percentile vs 30 synthetic years — whether this period's weather was extreme or normal luck.
        </p>
        <p>
          <strong>Evidence:</strong> the specific signals (inverter logs, setpoint flags, pyranometer, soiling station, flash test) behind each cause.
        </p>
        <p>
          <strong>Validation:</strong> how recovered causes compare to injected truth, and whether the hidden cause landed in Unexplained.
        </p>
        <p>
          <strong>Print:</strong> use the Print / Save as PDF button to generate a print-ready investor report — the charts are included.
        </p>
        <p>
          <strong>All data is synthetic:</strong> this is a demo with simulated plant, weather, and tariff — not real operational data.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div className="noprint" style={{ textAlign: "right", marginBottom: 10 }}>
        <button className="btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
      <div className="report">
        <h1>Investor variance report</h1>
        <div className="note">
          {esc(a.plant_name)} · {esc(a.period_label)} · scenario “{esc(a.scenario_name)}” · model{" "}
          {esc(a.model_version)} · <b>SYNTHETIC DATA</b>
        </div>
        <h2>Summary</h2>
        <p>{esc(a.narrative.text)}</p>
        <div className="note">
          Every number in this paragraph is machine-checked against engine output:{" "}
          {a.narrative.numbers_checked ? "passed ✓" : "FAILED"}.
        </div>

        <h2>Variance analysis — from forecast to actual</h2>
        <p>
          The two charts below explain this period's gap of <b>{sg(a.gap_kwh, 0)}</b> (
          {fmt(a.gap_pct, 1)}% vs forecast). Chart 1 bridges the megawatt-hours: starting from the
          forecast, every named cause moves the running total up or down, the hatched bar is the
          unexplained remainder, and the final bar lands on the metered actual. Chart 2 shows when in
          the period the variance occurred. Both charts reconcile to the same gap as the table below.
        </p>
        <div className="rpt-kpis">
          <div className="rpt-kpi">
            <small>Forecast energy</small>
            <b>{mwh(a.forecast_kwh, 0)}</b>
            <em>Expected generation · {esc(a.period_label)}</em>
          </div>
          <div className="rpt-kpi">
            <small>Actual energy</small>
            <b>{mwh(a.actual_kwh, 0)}</b>
            <em>Metered / simulated production</em>
          </div>
          <div className="rpt-kpi">
            <small>Production variance (gap)</small>
            <b className={a.gap_kwh < 0 ? "neg" : "pos"}>{sg(a.gap_kwh, 0)}</b>
            <em>
              {fmt(a.gap_pct, 1)}% vs forecast · {lakh(a.gap_inr)} illustrative
            </em>
          </div>
        </div>
        <div className="rpt-figure">
          <Waterfall steps={steps} totalLabel="Total gap" width={960} height={420} />
          <div className="rpt-caption">
            <b>Chart 1 — variance waterfall (MWh vs forecast).</b> How to read: each bar is one cause
            of the gap. Red bars reduced production versus forecast; green bars added production; the
            hatched bar is the part of the gap that the known causes cannot explain. Thin whiskers on
            the bars are the 90% uncertainty band ({a.monte_carlo?.samples ?? 80} Monte Carlo runs).
            The dark bar on the right is the total gap — the difference between metered actual and
            forecast.
          </div>
        </div>
        <div className="rpt-figure">
          <MonthlyChart
            labels={series.labels}
            forecast_kwh={series.forecast_kwh}
            actual_kwh={series.actual_kwh}
            gap_pct={series.gap_pct}
          />
          <div className="rpt-caption">
            <b>Chart 2 — {series.monthly ? "monthly" : "daily"} forecast vs actual (MWh).</b> How to
            read: each group is one {series.monthly ? "month" : "day"}. The grey bar is the forecast;
            the colored bar is the metered actual — red when the plant fell short, green when it met
            or beat forecast
            {series.monthly
              ? ". The percentage under each month is the variance versus that month's forecast; the widest shortfalls usually drive the total gap."
              : "."}
          </div>
        </div>
        <div className="note">
          Bridge check: Σ named causes {sg(a.reconciliation.sum_components_kwh, 0)} + unexplained{" "}
          {sg(u.kwh, 0)} = total gap {sg(a.gap_kwh, 0)} —{" "}
          {a.reconciliation.closes ? "reconciles exactly ✓" : "DOES NOT CLOSE"}. Illustrative
          monetary impact: {lakh(a.gap_inr)} at ₹{a.tariff_inr_per_kwh}/kWh.
        </div>

        <h2>Causes</h2>
        <p className="note">
          One row per named cause: its contribution to the gap in MWh and ₹ lakh, the 90% uncertainty
          band, and a confidence rating. Rows flagged "potentially claimable" (curtailment) require
          contract review — they are not legal conclusions.
        </p>
        <table>
          <tr>
            <th>Cause</th>
            <th>Class</th>
            <th>MWh</th>
            <th>₹ lakh</th>
            <th>90% band (MWh)</th>
            <th>Confidence</th>
          </tr>
          {a.components
            .filter((c: any) => c.present)
            .map((c: any) => (
              <tr key={c.id}>
                <td>
                  {esc(c.cause)}{c.claimable ? " (potentially claimable)" : ""}
                </td>
                <td>{esc(c.class_label)}</td>
                <td>{fmt(c.kwh / 1000, 1)}</td>
                <td>{fmt(c.inr / 1e5, 1)}</td>
                <td>
                  {fmt(c.lower_kwh / 1000, 0)} to {fmt(c.upper_kwh / 1000, 0)}
                </td>
                <td>{c.confidence}</td>
              </tr>
            ))}
          <tr>
            <td>Interaction (non-additive diagnostic)</td>
            <td>–</td>
            <td>{fmt(a.interaction.kwh / 1000, 1)}</td>
            <td>{fmt(a.interaction.inr / 1e5, 1)}</td>
            <td>–</td>
            <td>–</td>
          </tr>
          <tr className="rpt-una-row">
            <td><b>Unexplained</b></td>
            <td>–</td>
            <td><b>{fmt(u.kwh / 1000, 1)}</b></td>
            <td>{fmt(u.inr / 1e5, 1)}</td>
            <td>
              {fmt(u.lower_kwh / 1000, 0)} to {fmt(u.upper_kwh / 1000, 0)}
            </td>
            <td>{u.confidence}</td>
          </tr>
          <tr>
            <td><b>Total gap</b></td>
            <td></td>
            <td><b>{fmt(a.gap_kwh / 1000, 1)}</b></td>
            <td>{fmt(a.gap_inr / 1e5, 1)}</td>
            <td></td>
            <td></td>
          </tr>
        </table>
        <div className="note">{esc(a.interaction.note)}</div>
        <h2>Unexplained</h2>
        <p>{esc(u.message)}</p>
        {u.pct_of_gap == null ? null : (
          <p>It is {fmt(u.pct_of_gap, 1)}% of the total gap.</p>
        )}
        <p className="note">
          Data that would reduce it: {u.data_that_would_reduce_it.map(esc).join("; ")}.
        </p>
        <h2>Weather</h2>
        <p>
          Irradiance percentile <b>{fmt(w.percentile, 0)}</b> of {w.history_years} synthetic years (stand-in for a reanalysis record such as ERA5; licence and real data pending):{" "}
          {esc(w.statement)}. Typical year {fmt(w.typical_year_kwh_m2, 0)} kWh/m² ({fmt(w.delta_pct, 1)}%). Mean temperature {fmt(w.temperature_c, 1)} °C (percentile {fmt(w.temperature_percentile, 0)}).
        </p>
        <h2>Evidence</h2>
        {a.evidence.map((e: any) => (
          <p key={e.id} className="note">
            <b>{esc(e.title)}</b> — {esc(e.window)} · {esc(e.signal)}
            {e.kwh != null ? ` · ${sg(e.kwh, 1)}` : ""}
            <br />
            {esc(e.detail)}
          </p>
        ))}
        <h2>Validation</h2>
        <p className="note">
          Injected truth vs recovered ({esc(v.scenario_name)}):{" "}
          {v.summary.named_recovered}/{v.summary.named_causes_material} named causes recovered ({esc(v.tolerance)}). Hidden cause:{" "}
          {v.hidden.landed_in_unexplained
            ? "found in Unexplained ✓"
            : v.hidden.below_detection_floor
              ? "below detection floor"
              : "missed"}. Reconciliation {v.summary.reconciliation_closes ? "closes exactly ✓" : "FAILS"}.{" "}
          {esc(v.limitation)}
        </p>
        <h2>Method and caveats</h2>
        <p className="note">
          Order-independent (Shapley) attribution over a 7-switch plant simulator; unexplained = metered − simulated; 90% bands from {a.monte_carlo.samples} Monte Carlo runs. Forecast-model derate calibrated on {a.calibration.hours_used} hours ({esc(a.calibration.window)}).{" "}
          {a.data_quality_flags.map(esc).join(" ")} Curtailment flags are not legal conclusions.
        </p>
      </div>

      {simpleExplanation}
    </>
  );
};
