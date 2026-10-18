/* Overview dashboard — clear, clearly formatted sections with comfortable type.
   Each section is a numbered card: chart (what happened), causes (why),
   plain-language definitions, and next steps. All styles live in views.css,
   scoped to .overview-page, so no other screen is affected. */

import { fmt, mwh, sg, lakh, esc } from "../../utils/format";
import { MonthlyChart } from "../MonthlyChart";
import { buildChartSeries } from "../../utils/series";
import { useAuth } from "../../hooks/useAuth";

interface OverviewProps {
  a: any;
  useApi: boolean;
  onGoto: (tab: string) => void;
}

export const Overview = ({ a, useApi, onGoto }: OverviewProps) => {
  const { current } = useAuth();
  const user = current();

  const series = buildChartSeries(a);
  const u = a.unexplained;
  const w = a.weather;

  // Ranked negative causes (largest losses first) for the "why" section.
  const causes = a.components
    .filter((c: any) => c.present && c.kwh < 0)
    .sort((x: any, y: any) => x.kwh - y.kwh)
    .slice(0, 5);
  const maxCause = Math.max(1, ...causes.map((c: any) => Math.abs(c.kwh)));

  // Timing sentence — where in the period the variance actually happened.
  const n = series.labels.length;
  const unit = series.monthly ? "month" : "day";
  const units = series.monthly ? "months" : "days";
  const pctv = (x: number) => (x > 0 ? "+" : "") + fmt(x, 1) + "%";
  const dayName = (i: number) => {
    const d = String(a.daily?.dates?.[i] ?? "");
    if (!d) return series.labels[i];
    return new Date(d + "T00:00:00").toLocaleString("en", { day: "numeric", month: "short" });
  };
  const label = (i: number) => (series.monthly ? series.labels[i] : dayName(i));
  let worstI = 0;
  let bestI = 0;
  series.gap_pct.forEach((p: number, i: number) => {
    if (p < series.gap_pct[worstI]) worstI = i;
    if (p > series.gap_pct[bestI]) bestI = i;
  });
  const below = series.gap_pct.filter((p: number) => p < 0).length;
  const timing =
    n === 0
      ? "No series is available for this period."
      : `${below} of ${n} ${units} finished below forecast. The weakest ${unit} was ${label(
          worstI
        )} at ${pctv(series.gap_pct[worstI])} vs forecast, the strongest ${label(bestI)} at ${pctv(
          series.gap_pct[bestI]
        )}${below ? " — start with the red bars." : " — performance held at or above forecast throughout."}`;

  const bridge = `These bars cover the ${n} ${units} in ${esc(a.period_label)} and are built from the same daily forecast and meter series as the Variance analysis tab, so they sum back to the totals above.`;

  const band = u.exceeds_band
    ? "Larger than measurement uncertainty can explain."
    : "Within normal measurement uncertainty.";

  // Recommended next step — driven by the unexplained remainder and top loss.
  const top = causes[0];
  const next = u.exceeds_band
    ? {
        title: "Investigate the unexplained signal",
        body: `The residual (${sg(u.kwh, 0)}) is larger than the 90% uncertainty band can explain. Review the evidence table and data-quality flags before acting on individual causes.`,
        tab: "valid",
        cta: "Open validation lab",
      }
    : top
      ? {
          title: "Review the largest supported cause",
          body: `Start with ${esc(top.cause)} (${mwh(top.kwh, 0)}, ${esc(
            String(top.class_label).toLowerCase()
          )}, ${esc(top.confidence)} confidence).${
            top.claimable ? " " + esc(top.claim_note) : ""
          }`,
          tab: "analysis",
          cta: "See the full breakdown",
        }
      : {
          title: "Keep monitoring",
          body: "No material losses were attributed this period, so no corrective action is indicated.",
          tab: "analysis",
          cta: "See the full breakdown",
        };

  return (
    <div className="overview-page">
      {/* Welcome header */}
      <div className="overview-welcome">
        <div>
          <h2>Good to see you{user ? `, ${esc(user.name.split(" ")[0])}` : ""}.</h2>
          <p>
            {esc(a.plant_name)} · {esc(a.period_label)} — what happened, why, and what to check
            next.
          </p>
        </div>
        <span className="ov-badge">Synthetic demo data</span>
      </div>

      {/* KPI row — the four numbers everything else explains */}
      <section className="ov-section">
        <div className="kpis">
          <div className="kpi">
            <small>Forecast energy</small>
            <b>{mwh(a.forecast_kwh, 0)}</b>
            <em>Expected generation · {esc(a.period_label)}</em>
          </div>
          <div className="kpi">
            <small>Actual energy</small>
            <b>{mwh(a.actual_kwh, 0)}</b>
            <em>Metered / simulated production</em>
          </div>
          <div className="kpi">
            <small>Production variance</small>
            <b className={a.gap_kwh < 0 ? "neg" : "pos"}>{sg(a.gap_kwh, 0)}</b>
            <em>
              {fmt(a.gap_pct, 1)}% vs forecast · {lakh(a.gap_inr)} illustrative impact
            </em>
          </div>
          <div className="kpi">
            <small>Unexplained remainder</small>
            <b className={u.exceeds_band ? "neg" : "pos"}>{sg(u.kwh, 0)}</b>
            <em>
              {fmt(u.pct_of_gap || 0, 1)}% of the gap · {band.toLowerCase()}
            </em>
          </div>
        </div>
      </section>

      {/* Section 1 — performance chart */}
      <section className="ov-section">
        <div className="ov-head">
          <div className="ov-step">1</div>
          <div>
            <h3>How did the plant perform?</h3>
            <p>
              Forecast versus actual generation, {series.monthly ? "month by month" : "day by day"}
              , across {esc(a.period_label)}.
            </p>
          </div>
        </div>
        <div className="card ov-chart-card">
          <div className="ov-legend">
            <span>
              <i className="ov-key-forecast" aria-hidden="true" /> Forecast
            </span>
            <span>
              <i className="ov-key-ontrack" aria-hidden="true" /> Actual · at or above forecast
            </span>
            <span>
              <i className="ov-key-shortfall" aria-hidden="true" /> Actual · below forecast
            </span>
          </div>
          <MonthlyChart
            labels={series.labels}
            forecast_kwh={series.forecast_kwh}
            actual_kwh={series.actual_kwh}
            gap_pct={series.gap_pct}
          />
          <div className="ov-read">
            <p>
              <b>Timing.</b> {timing}
            </p>
            <p>
              <b>Period bridge.</b> {bridge}
            </p>
            {w && (
              <p>
                <b>Weather context.</b> Plane-of-array irradiance was{" "}
                {fmt(w.irradiance_kwh_m2, 0)} kWh/m² against a typical-year{" "}
                {fmt(w.typical_year_kwh_m2, 0)} kWh/m² ({fmt(w.delta_pct, 1)}%), {esc(w.statement)}
                ; ambient temperature averaged {fmt(w.temperature_c, 1)} °C. Weather explains part
                of the gap but never all of it — the causes are ranked next.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Section 2 — why: ranked causes + unexplained */}
      <section className="ov-section">
        <div className="ov-head">
          <div className="ov-step">2</div>
          <div>
            <h3>What caused the variance?</h3>
            <p>
              Ranked losses from an order-independent (Shapley) attribution. Each cause is
              independently computed from plant signals, and all of them plus the unexplained
              remainder add up to the total gap.
            </p>
          </div>
        </div>
        <div className="ov-cols">
          <div className="card">
            {causes.length > 0 ? (
              causes.map((c: any) => (
                <div key={c.id} className="ov-cause">
                  <div className="ov-cause-top">
                    <span className="ov-cause-name">{esc(c.cause)}</span>
                    <b>{mwh(c.kwh, 0)}</b>
                  </div>
                  <div className="cause-track">
                    <div
                      className="ov-cause-fill"
                      style={{ width: (Math.abs(c.kwh) / maxCause) * 100 + "%" }}
                    />
                  </div>
                  <p className="ov-cause-meta">
                    {esc(c.class_label)} · {esc(c.confidence)} confidence
                    {c.claimable ? " · potentially claimable" : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="ov-hint">No material negative contributors in this period.</p>
            )}
            <div className="ov-cta-row">
              <button className="btn btn-primary" onClick={() => onGoto("analysis")}>
                Explain this variance <span>→</span>
              </button>
              <button className="btn btn-ghost" onClick={() => onGoto("valid")}>
                Open validation lab
              </button>
            </div>
          </div>

          <div className="ov-side">
            <div className={`card ov-unexplained${u.exceeds_band ? "" : " ov-within"}`}>
              <div className="ov-head-title">Unexplained remainder</div>
              <p className="ov-head-sub">{band}</p>
              <b className="ov-stat">{sg(u.kwh, 0)}</b>
              <p className="ov-stat-sub">
                {fmt(u.pct_of_gap || 0, 1)}% of the total gap · 90% band{" "}
                {mwh(u.lower_kwh, 0)} to {mwh(u.upper_kwh, 0)}
              </p>
              <p className="ov-msg">{esc(u.message)}</p>
              <p className="ov-msg">
                <b>Data that would shrink it:</b>{" "}
                {u.data_that_would_reduce_it.map(esc).join("; ")}
              </p>
            </div>

            <div className="card">
              <div className="ov-head-title">Recommended next step</div>
              <p className="ov-next-title">{next.title}</p>
              <p className="ov-msg">{next.body}</p>
              <div className="ov-cta-row" style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={() => onGoto(next.tab)}>
                  {next.cta} <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — plain-language definitions */}
      <section className="ov-section">
        <div className="ov-head">
          <div className="ov-step">3</div>
          <div>
            <h3>What this means in plain terms</h3>
            <p>
              The four numbers every reader asks about, defined without jargon. All values come
              from the engine output for {esc(a.period_label)}.
            </p>
          </div>
        </div>
        <div className="ov-terms">
          <div className="ov-term">
            <span className="ov-term-label">Forecast energy</span>
            <b>{mwh(a.forecast_kwh, 0)}</b>
            <p>
              What the plant was expected to generate this period, from a model calibrated on its
              own recent history — the baseline everything else is measured against.
            </p>
          </div>
          <div className="ov-term">
            <span className="ov-term-label">Actual energy</span>
            <b>{mwh(a.actual_kwh, 0)}</b>
            <p>
              What the plant actually produced over the same days, as metered (simulated in this
              demo).
            </p>
          </div>
          <div className="ov-term">
            <span className="ov-term-label">Production variance (gap)</span>
            <b>
              {sg(a.gap_kwh, 0)} · {fmt(a.gap_pct, 1)}%
            </b>
            <p>
              Actual minus forecast —{" "}
              {a.gap_kwh < 0 ? "a shortfall" : "a surplus"} worth {lakh(a.gap_inr)} at the
              illustrative tariff. Positive means the plant beat forecast.
            </p>
          </div>
          <div className="ov-term">
            <span className="ov-term-label">Unexplained remainder</span>
            <b>{sg(u.kwh, 0)}</b>
            <p>
              {u.exceeds_band
                ? "The part of the gap that no named cause can account for. It is larger than measurement uncertainty, so it may point to missing data or an unlogged issue."
                : "The part of the gap that no named cause can account for. It sits inside measurement uncertainty, so no hidden cause is indicated."}
            </p>
          </div>
        </div>
      </section>

      {/* Section 4 — engine status + next actions */}
      <section className="ov-section">
        <div className="ov-head">
          <div className="ov-step">4</div>
          <div>
            <h3>Next steps</h3>
            <p>How this analysis was produced, and how to take it further.</p>
          </div>
        </div>
        <div className="ov-cols">
          <div className="card ov-status">
            <div className="item">
              <span>Analysis engine</span>
              <b>{useApi ? "Connected (live API)" : "Snapshot mode (precomputed)"}</b>
            </div>
            <div className="item">
              <span>Attribution method</span>
              <b>Shapley — order independent</b>
            </div>
            <div className="item">
              <span>Uncertainty</span>
              <b>
                90% bands · {a.monte_carlo?.samples ?? "n/a"} simulations
              </b>
            </div>
            <div className="item">
              <span>Unexplained check</span>
              <b className={u.exceeds_band ? "neg" : "pos"}>
                {u.exceeds_band ? "Beyond band" : "Within band"}
              </b>
            </div>
            <div className="item">
              <span>Reconciliation</span>
              <b className={a.reconciliation.closes ? "pos" : "neg"}>
                {a.reconciliation.closes ? "Closes exactly ✓" : "Review"}
              </b>
            </div>
          </div>
          <div className="card data-cta">
            <div>
              <div className="ov-head-title">Bring your own data</div>
              <p className="ov-msg">
                Run the same attribution on your plant: upload monthly generation and irradiance
                and get a validated bridge with a visible unexplained remainder.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => onGoto("data")}>
              Open data upload <span>→</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
