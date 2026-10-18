/* Cause classification view — same visual and data as original rClass().
   Adds simple explanation after calculation. */

import { fmt, mwh, sg, esc } from "../../utils/format";

interface ClassificationProps {
  a: any;
}

export const Classification = ({ a }: ClassificationProps) => {
  const w = a.weather;
  const groups = [
    [
      "predictable",
      "Predictable",
      "Foreseeable at forecast time → fix the forecast / underwriting",
    ],
    [
      "controllable",
      "Controllable",
      "Operator action could have avoided it",
    ],
    ["luck", "Luck", "Weather, measured against the multi-year record"],
    [
      "external",
      "Outside operator control",
      "Third-party action; possibly claimable",
    ],
  ];

  const dots = w.history_sorted;
  const mn = Math.min(...dots, w.irradiance_kwh_m2) - 5;
  const mx = Math.max(...dots, w.irradiance_kwh_m2) + 5;
  const X = (v: number) => 20 + ((v - mn) / (mx - mn)) * 660;

  const simpleExplanation = (
    <div className="card">
      <h3>What the classification means — in simple terms</h3>
      <div className="sub">
        <p>
          <strong>Predictable:</strong> causes the operator could have foreseen when making the forecast (e.g. degradation, model bias). These suggest fixing the forecast or underwriting assumptions.
        </p>
        <p>
          <strong>Controllable:</strong> causes within the operator's control (e.g. downtime, soiling/cleaning). These could have been reduced with operational action.
        </p>
        <p>
          <strong>Luck:</strong> weather-related causes (irradiance, temperature) measured against the 30-year synthetic record. These are not the operator's fault — they're just the weather that occurred.
        </p>
        <p>
          <strong>External:</strong> causes outside the operator's control (e.g. grid curtailment). Potentially claimable, but only via contract/PPA review — not a legal conclusion.
        </p>
        <p>
          <strong>Weather extreme vs luck:</strong> the irradiance percentile shows whether this period's weather was extreme (outside p10–p90) or just normal bad luck.
        </p>
      </div>
    </div>
  );

  return (
    <div className="cols">
      {groups.map(([k, t, s]) => {
        const cs = a.components.filter((c: any) => c.class === k && c.present);
        const tot = cs.reduce((p: number, c: any) => p + c.kwh, 0);
        return (
          <div key={k} className="card col">
            <h4>{t}</h4>
            <div className="note">{s}</div>
            <div className={`big ${tot < 0 ? "neg" : "pos"}`} style={{ margin: "6px 0" }}>
              {sg(tot)}
            </div>
            {cs.length > 0 ? (
              cs.map((c: any) => (
                <div key={c.id} className="item">
                  <span>
                    {esc(c.cause)}
                    <br />
                    <span className={`chip ${c.confidence}`}>{c.confidence}</span>{" "}
                    {c.claimable ? <span className="chip claim">claimable?</span> : ""}
                  </span>
                  <b className={c.kwh < 0 ? "neg" : "pos"}>{sg(c.kwh)}</b>
                </div>
              ))
            ) : (
              <div className="note">Nothing material in this period.</div>
            )}
          </div>
        );
      })}

      <div className="card">
        <h3>
          Is the weather luck or an extreme? {esc(a.period_label)}
        </h3>
        <div className="sub">
          Measured irradiance sum vs {w.history_years} synthetic years (stand-in for a reanalysis record such as ERA5; licence and real data to be confirmed).
        </div>
        <svg viewBox="0 0 700 80" width="100%">
          <rect
            x={X(dots[Math.floor(dots.length * 0.1)])}
            y={26}
            width={X(dots[Math.floor(dots.length * 0.9)]) - X(dots[Math.floor(dots.length * 0.1)])}
            height={22}
            fill="#e8f3f1"
          />
          <line x1={20} x2={680} y1={37} y2={37} stroke="#cbd5e1" />
          {dots.map((v: number) => (
            <circle
              key={v}
              cx={X(v)}
              cy={37}
              r={4}
              fill="#94a3b8"
            />
          ))}
          <line
            x1={X(w.irradiance_kwh_m2)}
            x2={X(w.irradiance_kwh_m2)}
            y1={12}
            y2={62}
            stroke={w.extreme ? "#b4452b" : "#1f3a5f"}
            strokeWidth={3}
          />
          <text
            x={X(w.irradiance_kwh_m2)}
            y={74}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill={w.extreme ? "#b4452b" : "#1f3a5f"}
          >
            this period: {fmt(w.irradiance_kwh_m2, 0)} kWh/m²
          </text>
          <text
            x={X(dots[Math.floor(dots.length * 0.1)])}
            y={20}
            fontSize={10}
            fill="#667085"
          >
            p10
          </text>
          <text
            x={X(dots[Math.floor(dots.length * 0.9)])}
            y={20}
            fontSize={10}
            fill="#667085"
          >
            p90
          </text>
        </svg>
        <div className="hl">
          <b>{w.extreme ? "Extreme event" : "Normal variability"}:</b> {esc(w.statement)}.{" "}
          Typical year: {fmt(w.typical_year_kwh_m2, 0)} kWh/m² ({fmt(w.delta_pct, 1)}%). Temperature percentile{" "}
          {fmt(w.temperature_percentile, 0)}.
        </div>
      </div>

      <div className="card">
        <h3>Confidence rules (written down, reproducible)</h3>
        <div className="note">
          High: 90% band ≤ 15% of the value, or directly logged cause (downtime, curtailment) with band ≤ 30%.
          Medium: band ≤ 60%. Low: wider. Band = 5–95th percentile of {a.monte_carlo.samples} Monte Carlo runs perturbing{" "}
          {esc(a.monte_carlo.perturbed)}.
        </div>
      </div>

      {simpleExplanation}
    </div>
  );
};
