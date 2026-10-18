/* Variance analysis view — same visual and data as original rAnalysis().
   Adds a "what this data means" explanation after calculations. */

import { useState } from "react";
import { fmt, mwh, sg, lakh, esc, per } from "../../utils/format";
import { Waterfall } from "../Waterfall";
import { EvidenceDrawer } from "../EvidenceDrawer";
import { DailyChart } from "../DailyChart";

interface AnalysisProps {
  a: any;
  v: any;
  scenario: string;
  period: string;
}

export const Analysis = ({ a, v, scenario, period }: AnalysisProps) => {
  const [method, setMethod] = useState("shapley");
  const [sel, setSel] = useState<string | undefined>(undefined);

  const u = a.unexplained;
  const w = a.weather;

  const steps = (() => {
    const out: any[] = [];
    let cum = 0;
    const comps = a.components.filter((c: any) => c.present);
    for (const c of comps) {
      const val = method === "shapley" ? c.kwh : c.main_effect_kwh;
      const half = (c.upper_kwh - c.lower_kwh) / 2;
      const mid = (c.upper_kwh + c.lower_kwh) / 2;
      out.push({
        id: c.id,
        label: c.cause,
        v: val,
        start: cum,
        end: cum + val,
        lo: cum + val + (c.lower_kwh - c.kwh),
        hi: cum + val + (c.upper_kwh - c.kwh),
        cls: c.class,
        c,
      });
      cum += val;
    }
    if (method !== "shapley") {
      out.push({
        id: "interaction",
        label: "Interaction",
        v: a.interaction.kwh,
        start: cum,
        end: cum + a.interaction.kwh,
        cls: "interaction",
      });
      cum += a.interaction.kwh;
    }
    out.push({
      id: "unexplained",
      label: "UNEXPLAINED",
      v: u.kwh,
      start: cum,
      end: cum + u.kwh,
      lo: cum + (u.lower_kwh - u.kwh),
      hi: cum + (u.upper_kwh - u.kwh),
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
      <h3>What the analysis numbers mean — in simple terms</h3>
      <div className="sub">
        <p>
          <strong>Forecast vs Actual:</strong> The plant was forecast to produce{" "}
          {mwh(a.forecast_kwh, 0)} MWh but actually produced {mwh(
            a.actual_kwh,
            0
          )} MWh — a gap of {sg(a.gap_kwh, 0)} MWh ({fmt(a.gap_pct, 1)}%).
        </p>
        <p>
          <strong>Each cause bar:</strong> shows how much that specific factor (e.g. low irradiance, inverter downtime, grid curtailment) contributed to the gap. Negative values mean the factor reduced production; positive values mean it added production relative to forecast.
        </p>
        <p>
          <strong>Shapley vs Isolated:</strong> "Order-independent (Shapley)" fairly splits the gap across all causes regardless of listing order. "Isolated effects + interaction" shows each cause's individual impact plus a separate interaction line for non-additive effects. Both views reconcile to the same total gap.
        </p>
        <p>
          <strong>90% bands (whiskers):</strong> the range within which the true value likely lies, given sensor and meter uncertainty. Calculated from 80 Monte Carlo runs.
        </p>
        <p>
          <strong>Unexplained ({sg(u.kwh, 1)} MWh):</strong> the part of the gap that none of the known causes can explain.{" "}
          {u.exceeds_band
            ? "It is larger than measurement uncertainty can account for — this is a signal worth investigating (missing data, unlogged failures, etc.)."
            : "It sits within normal measurement uncertainty — no additional cause is indicated by the data."}
        </p>
        <p>
          <strong>Reconciliation:</strong> Σ causes + unexplained = gap exactly (checked to the milli-kWh). Nothing is forced, hidden, or double-counted.
        </p>
      </div>
    </div>
  );

  return (
    <div className="grid">
      <div>
        <div className="kpis">
          <div className="kpi">
            <small>Forecast (P50 typical year)</small>
            <b>{mwh(a.forecast_kwh, 0)}</b>
            <em>{esc(a.period_label)}</em>
          </div>
          <div className="kpi">
            <small>Actual (metered)</small>
            <b>{mwh(a.actual_kwh, 0)}</b>
            <em>{esc(a.plant_name.split(",")[0])}</em>
          </div>
          <div className="kpi">
            <small>Gap</small>
            <b className={a.gap_kwh < 0 ? "neg" : "pos"}>
              {sg(a.gap_kwh, 0)}
            </b>
            <em>
              {fmt(a.gap_pct, 1)}% · {lakh(a.gap_inr)} at ₹{a.tariff_inr_per_kwh}/kWh
            </em>
          </div>
          <div className="kpi">
            <small>Unexplained</small>
            <b style={{ color: "var(--una-ink)" }}>{sg(u.kwh, 0)}</b>
            <em>
              {u.pct_of_gap == null ? "" : fmt(u.pct_of_gap, 0) + "% of gap · "}
              {u.exceeds_band ? "beyond uncertainty" : "within uncertainty"}
            </em>
          </div>
          <div className="kpi">
            <small>Weather percentile</small>
            <b>{fmt(w.percentile, 0)}</b>
            <em>{esc(w.statement)}</em>
          </div>
        </div>

        <div className="grid">
          <div>
            <div className="card">
              <h3>Variance waterfall</h3>
              <div className="sub">
                Each bar is a cause; whiskers are the 90% band under sensor, meter and calibration uncertainty. Click a bar for evidence.
              </div>
              <div className="seg" id="meth">
                <button
                  data-m="shapley"
                  className={method === "shapley" ? "on" : ""}
                  onClick={() => setMethod("shapley")}
                >
                  Order-independent (Shapley)
                </button>{" "}
                <button
                  data-m="isolated"
                  className={method === "isolated" ? "on" : ""}
                  onClick={() => setMethod("isolated")}
                >
                  Isolated effects + interaction
                </button>
              </div>
              <div id="wf">
                <Waterfall steps={steps} sel={sel} onSelect={setSel} />
              </div>
              <div className="note">
                Reconciliation: Σ causes {sg(a.reconciliation.sum_components_kwh, 3)} +
                unexplained {sg(u.kwh, 3)} = gap {sg(a.gap_kwh, 3)} ·{" "}
                {a.reconciliation.closes
                  ? "<b class='pass'>closes exactly ✓</b>"
                  : "<b class='fail'>DOES NOT CLOSE</b>"}
              </div>
              {simpleExplanation}
            </div>
            <div className={`card una ${u.exceeds_band ? "" : "ok"}`}>
              <h3>
                {u.exceeds_band
                  ? "⚠ Unexplained: part of this gap is not explained by current data"
                  : "✓ Unexplained is within measurement uncertainty"}
              </h3>
              <div>{esc(u.message)}</div>
              <div className="note" style={{ marginTop: 6 }}>
                {sg(u.kwh, 1)} · {lakh(u.inr)} · 90% band {sg(u.lower_kwh, 1)} to{" "}
                {sg(u.upper_kwh, 1)}
              </div>
              <b style={{ fontSize: 13, display: "block", marginTop: 8 }}>
                Data that would shrink it
              </b>
              <ul>
                {u.data_that_would_reduce_it.map((x: string) => (
                  <li key={x}>{esc(x)}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3>Why order-independent? A plain waterfall changes with the order of causes</h3>
              <div className="sub">
                Same simulator, same data. Listing a cause first vs last changes its bar by up to{" "}
                <b>{mwh(a.sequential_demo.max_order_swing_kwh, 0)}</b>. Shapley averages over all 5,040 orderings.
              </div>
              <table>
                <tr>
                  <th>Cause</th>
                  <th>Listed first</th>
                  <th>Listed last</th>
                  <th>Swing</th>
                  <th>Shapley (ours)</th>
                </tr>
                {a.sequential_demo.rows.map((r: any) => (
                  <tr key={r.id}>
                    <td>{esc(r.label)}</td>
                    <td>{fmt(r.listed_first / 1000, 1)}</td>
                    <td>{fmt(r.listed_last / 1000, 1)}</td>
                    <td>{fmt(r.order_swing_kwh / 1000, 1)}</td>
                    <td>
                      <b>{fmt(r.shapley / 1000, 1)}</b>
                    </td>
                  </tr>
                ))}
              </table>
              <div className="note">MWh. Totals are identical; only the split moves.</div>
            </div>
            <div className="card">
              <h3>Daily forecast vs actual</h3>
              <DailyChart
                dates={a.daily.dates}
                forecast_kwh={a.daily.forecast_kwh}
                actual_kwh={a.daily.actual_kwh}
              />
            </div>
          </div>
          <aside>
            <div className="card drawer" id="drawer">
              <EvidenceDrawer sel={sel} a={a} />
            </div>
            <div className="card">
              <h3>Data quality flags</h3>
              {a.data_quality_flags.map((f: string) => (
                <div key={f} className="note">
                  • {esc(f)}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
