/* Investor report view — same visual and data as original rReport().
   Adds simple explanation after calculation. */

import { fmt, mwh, sg, esc } from "../../utils/format";

interface ReportProps {
  a: any;
  v: any;
}

export const Report = ({ a, v }: ReportProps) => {
  const u = a.unexplained;
  const w = a.weather;

  const simpleExplanation = (
    <div className="card">
      <h3>What this report contains — in simple terms</h3>
      <div className="sub">
        <p>
          <strong>Summary:</strong> a plain-language paragraph of what happened this period. Every number in it is machine-checked against the engine — nothing is invented.
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
          <strong>Print:</strong> use the Print / Save as PDF button to generate a print-ready investor report.
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
          {esc(a.plant_name)} · {esc(a.period_label)} · model {esc(a.model_version)} ·{" "}
          <b>SYNTHETIC DATA</b>
        </div>
        <h2>Summary</h2>
        <p>{esc(a.narrative.text)}</p>
        <div className="note">
          Every number in this paragraph is machine-checked against engine output:{" "}
          {a.narrative.numbers_checked ? "passed ✓" : "FAILED"}.
        </div>
        <h2>Waterfall</h2>
        {/* Minimal waterfall placeholder using same steps logic as Analysis */}
        <div className="note">
          See Variance Analysis tab for the interactive waterfall chart.
        </div>
        <h2>Causes</h2>
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
          <tr style={{ background: "#fffbeb" }}>
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
