/* Validation lab view — same visual and data as original rValid().
   Adds simple explanation after calculation. */

import { fmt, mwh, sg, esc } from "../../utils/format";

interface ValidationProps {
  v: any;
}

export const Validation = ({ v }: ValidationProps) => {
  const s = v.summary;
  const h = v.hidden;

  const simpleExplanation = (
    <div className="card">
      <h3>What the validation means — in simple terms</h3>
      <div className="sub">
        <p>
          <strong>Truth vs recovered:</strong> Because this is a synthetic demo, we know the true size of every cause. The validation compares what the engine recovered (from noisy, measured inputs) against the true injected values.
        </p>
        <p>
          <strong>Recovered:</strong> a cause is "recovered" if the engine's estimate is within 20% of the truth (or within 0.1% of forecast). {s.named_recovered} of {s.named_causes_material} material causes were recovered.
        </p>
        <p>
          <strong>Hidden cause:</strong> every scenario has one deliberately hidden loss (e.g. unlogged string failures) that no log or sensor captures. A good engine should NOT invent a name for it — it should leave it in the Unexplained bucket. Here:{" "}
          {h.landed_in_unexplained
            ? "✓ correctly landed in Unexplained"
            : h.below_detection_floor
              ? "below the detection floor (too small to detect)"
              : "missed"}.
        </p>
        <p>
          <strong>Reconciliation:</strong> the engine's internal math closes exactly — Σ causes + unexplained = gap to the milli-kWh. If this fails, something is wrong with the bookkeeping.
        </p>
        <p>
          <strong>Limitation:</strong> engine and truth share one physics model, so this tests attribution logic and noise robustness — it does not prove real-world accuracy for a live plant.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <small>Named causes recovered</small>
          <b>{s.named_recovered} / {s.named_causes_material}</b>
          <em>{esc(v.tolerance)}</em>
        </div>
        <div className="kpi">
          <small>Truth inside our 90% band</small>
          <b>{s.named_within_band} / {s.named_causes_material}</b>
          <em>calibration of the uncertainty</em>
        </div>
        <div className="kpi">
          <small>Hidden cause</small>
          <b className={h.landed_in_unexplained ? "pos" : "neg"}>
            {h.landed_in_unexplained
              ? "found in Unexplained ✓"
              : h.below_detection_floor
                ? "below detection floor"
                : "missed"}
          </b>
          <em>{esc(h.scenario_hidden)}</em>
        </div>
        <div className="kpi">
          <small>Reconciliation</small>
          <b className={s.reconciliation_closes ? "pos" : "neg"}>
            {s.reconciliation_closes ? "closes exactly ✓" : "FAILS"}
          </b>
          <em>integer milli-kWh check</em>
        </div>
      </div>

      <div className="card">
        <h3>
          Injected truth vs recovered · {esc(v.scenario_name)} · full year
        </h3>
        <div className="sub">
          We know the true cause sizes because we generated the plant. The engine only sees noisy sensors, logs and a meter. Nothing here is tuned per scenario.
        </div>
        <table>
          <tr>
            <th>Cause</th>
            <th>Truth (MWh)</th>
            <th>Recovered (MWh)</th>
            <th>Error (MWh)</th>
            <th>Error %</th>
            <th>Our 90% band</th>
            <th>Result</th>
          </tr>
          {v.rows.map((r: any) => (
            <tr key={r.id}>
              <td>{esc(r.cause)}</td>
              <td>{fmt(r.truth_kwh / 1000, 1)}</td>
              <td>{fmt(r.recovered_kwh / 1000, 1)}</td>
              <td>{fmt(r.error_kwh / 1000, 1)}</td>
              <td>
                {r.error_pct == null ? "–" : fmt(r.error_pct, 0) + "%"}
              </td>
              <td>
                {fmt(r.lower_kwh / 1000, 0)} to {fmt(r.upper_kwh / 1000, 0)}
                {r.within_band ? " ✓" : " ✗"}
              </td>
              <td
                className={
                  !r.material
                    ? "na"
                    : r.recovered
                      ? "pass"
                      : "fail"
                }
              >
                {!r.material ? "immaterial" : r.recovered ? "recovered" : "off"}
              </td>
            </tr>
          ))}
          <tr style={{ background: "#fffbeb" }}>
            <td>
              <b>HIDDEN (unlogged) → should land in Unexplained</b>
            </td>
            <td>{fmt(h.truth_kwh / 1000, 1)}</td>
            <td>{fmt(h.unexplained_kwh / 1000, 1)}</td>
            <td>{fmt(h.error_kwh / 1000, 1)}</td>
            <td>
              {h.error_pct == null ? "–" : fmt(h.error_pct, 0) + "%"}
            </td>
            <td>floor {fmt(h.detection_floor_kwh / 1000, 0)} MWh</td>
            <td
              className={
                h.landed_in_unexplained
                  ? "pass"
                  : h.below_detection_floor
                    ? "fail"
                    : "fail"
              }
            >
              {h.landed_in_unexplained
                ? "refused to invent a cause ✓"
                : h.below_detection_floor
                  ? "too small to detect"
                  : "missed"}
            </td>
          </tr>
        </table>
        <p className="hl">
          Honest reading: irradiance and forecast-model bias are the hardest to separate, because a constant irradiance-sensor bias is absorbed into the calibrated model derate. The 90% bands say so.{" "}
          {esc(v.limitation)}
        </p>
      </div>

      {simpleExplanation}
    </>
  );
};
