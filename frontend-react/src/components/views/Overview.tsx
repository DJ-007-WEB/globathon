/* Overview dashboard — same visual and data as original rOverview(). */

import { useEffect, useState } from "react";
import { fmt, mwh, sg, lakh, esc, per } from "../../utils/format";
import { Waterfall } from "../Waterfall";
import { EvidenceDrawer } from "../EvidenceDrawer";
import { useAuth } from "../../hooks/useAuth";

interface OverviewProps {
  a: any;
  meta: any;
  scenario: string;
  useApi: boolean;
  onGoto: (tab: string) => void;
}

export const Overview = ({ a, meta, scenario, useApi, onGoto }: OverviewProps) => {
  const { current, isAuthed } = useAuth();

  const scenMeta = meta.scenarios.find((x: any) => x.key === scenario);
  const months = scenMeta?.monthly || [];
  const forecast = a.forecast_kwh;
  const actual = a.actual_kwh;
  const gap = a.gap_kwh;

  const causes = a.components
    .filter((c: any) => c.present && c.kwh < 0)
    .sort((x: any, y: any) => x.kwh - y.kwh)
    .slice(0, 5);
  const maxCause = Math.max(1, ...causes.map((c: any) => Math.abs(c.kwh)));
  const maxMonth = Math.max(1, ...months.map((m: any) => Math.abs(m.gap_pct)));

  const bars = months.map((m: any) => {
    const h = Math.max(4, Math.min(100, (Math.abs(m.gap_pct) / maxMonth) * 100));
    return (
      <div key={m.period} className="chart-bar-group">
        <div className="chart-bar-pair">
          <div
            className={`chart-bar ${m.gap_pct < 0 ? "negative" : "positive"}`}
            style={{ height: `${h}%` }}
            title={fmt(m.gap_pct, 1) + "% vs forecast"}
          />
        </div>
        <span className="chart-bar-label">{per(m.period).split(" ")[0]}</span>
      </div>
    );
  });

  const simpleExplanation = (
    <div className="card">
      <h3>What this data means — in simple terms</h3>
      <div className="sub">
        <p>
          <strong>Forecast energy</strong> ({mwh(forecast, 0)}): what the plant was expected to generate this period based on a typical-year model.
        </p>
        <p>
          <strong>Actual energy</strong> ({mwh(actual, 0)}): what the plant actually produced, as measured by the meter.
        </p>
        <p>
          <strong>Production variance (gap)</strong> ({sg(gap, 0)}, {fmt(a.gap_pct, 1)}% vs forecast): the difference between actual and forecast. A negative value means the plant produced less than expected.
        </p>
        <p>
          <strong>Unexplained remainder</strong> ({sg(a.unexplained.kwh, 0)}): the part of the gap that none of the known causes (weather, downtime, curtailment, etc.) can explain. The engine leaves this visible rather than forcing it into a named cause.
        </p>
        <p>
          {a.unexplained.exceeds_band
            ? "The unexplained amount is larger than measurement uncertainty can account for — this may point to missing data or an unlogged issue."
            : "The unexplained amount sits within normal measurement uncertainty — nothing unusual beyond the known causes."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="overview-grid">
      <div className="overview-welcome">
        <div>
          <h2>
            Good to see you{isAuthed() ? ", " + esc(current()!.name.split(" ")[0]) : ""}.
          </h2>
          <p>
            Here is the performance story for {esc(a.plant_name)} · {esc(a.period_label)}.
          </p>
        </div>
        <span className="overview-badge">● SYNTHETIC DEMO DATA</span>
      </div>

      <div className="kpis">
        <div className="kpi">
          <small>Forecast energy</small>
          <b>{mwh(forecast, 0)}</b>
          <em>Expected generation · {esc(a.period_label)}</em>
        </div>
        <div className="kpi">
          <small>Actual energy</small>
          <b>{mwh(actual, 0)}</b>
          <em>Metered / simulated production</em>
        </div>
        <div className="kpi">
          <small>Production variance</small>
          <b className={gap < 0 ? "neg" : "pos"}>{sg(gap, 0)}</b>
          <em>
            {fmt(a.gap_pct, 1)}% vs forecast · {lakh(a.gap_inr)} illustrative impact
          </em>
        </div>
        <div className="kpi">
          <small>Unexplained remainder</small>
          <b style={{ color: "var(--amber)" }}>{sg(a.unexplained.kwh, 0)}</b>
          <em>
            {a.unexplained.exceeds_band ? "Beyond uncertainty band" : "Within uncertainty band"} ·
            {fmt(a.unexplained.pct_of_gap || 0, 1)}% of gap
          </em>
        </div>
      </div>

      <div className="overview-grid">
        <div>
          <div className="card">
            <div
              className="section-heading"
              style={{ marginBottom: 10, alignItems: "center" }}
            >
              <div>
                <h3>Monthly performance signal</h3>
                <div className="sub">
                  Relative gap magnitude across the selected scenario. Use Variance Analysis for the detailed daily curves.
                </div>
              </div>
              <div className="chart-legend">
                <span><i className="negative-key"></i> Shortfall</span>
                <span><i className="actual-key"></i> At / above forecast</span>
              </div>
            </div>
            <div className="chart-bars">{bars}</div>
            <div className="note" style={{ marginTop: 10 }}>
              Bar height shows the magnitude of monthly variance; color distinguishes underperformance from months at or above forecast. Detailed forecast and actual series are available in Variance Analysis.
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="sub">Ranked by estimated contribution to underperformance.</div>
            {causes.map((c: any) => (
              <div key={c.id} className="cause-row">
                <span className="cause-name">{esc(c.cause)}</span>
                <div className="cause-track">
                  <div
                    className="cause-fill negative"
                    style={{ width: (Math.abs(c.kwh) / maxCause) * 100 + "%" }}
                  />
                </div>
                <b className="cause-value neg">{mwh(c.kwh, 0)}</b>
              </div>
            ))}
            {causes.length === 0 && (
              <p className="note">No material negative contributors in this period.</p>
            )}
            <div className="overview-actions" style={{ marginTop: 15 }}>
              <button
                className="btn btn-primary"
                onClick={() => onGoto("analysis")}
              >
                Explain this variance <span> → </span>
              </button>{" "}
              <button
                className="small-action"
                onClick={() => onGoto("valid")}
              >
                Open validation lab
              </button>
            </div>
            {simpleExplanation}
          </div>
        </div>

        <div>
          <div className="card">
            <h3>Recommended next step</h3>
            <div className="sub">Evidence-led, not a black-box diagnosis.</div>
            <div className="feature-icon icon-unknown" style={{ margin: "15px 0" }}>
              ⌕
            </div>
            <b style={{ fontSize: 12 }}>
              {a.unexplained.exceeds_band
                ? "Investigate the unexplained signal"
                : "Review the largest supported cause"}
            </b>
            <p className="note" style={{ margin: "8px 0 14px" }}>
              {esc(a.unexplained.message)}
            </p>
            <button
              className="small-action"
              onClick={() => onGoto("analysis")}
            >
              Inspect evidence →
            </button>
          </div>

          <div className="card data-cta">
            <h3>Bring your own data</h3>
            <div className="sub">
              Import a monthly CSV and reconcile its gap, with validation and a visible unexplained remainder.
            </div>
            <button
              className="btn btn-primary"
              onClick={() => onGoto("data")}
            >
              Open data upload <span> → </span>
            </button>
          </div>

          <div className="card">
            <h3>Engine status</h3>
            <div className="item">
              <span>Analysis engine</span>
              <b className={useApi ? "pos" : "na"}>
                {useApi ? "Connected" : "Snapshot mode"}
              </b>
            </div>
            <div className="item">
              <span>Attribution</span>
              <b>Deterministic</b>
            </div>
            <div className="item">
              <span>Uncertainty</span>
              <b>90% bands</b>
            </div>
            <div className="item">
              <span>Reconciliation</span>
              <b className={a.reconciliation.closes ? "pos" : "neg"}>
                {a.reconciliation.closes ? "Passed" : "Review"}
              </b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
