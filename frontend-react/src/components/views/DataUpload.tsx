/* Data upload view — same visual and data as original rData() + data.js logic.
   Browser-side CSV validation and reconciliation. */

import { useState, useCallback } from "react";
import { fmt, mwh, sg, lakh, esc } from "../../utils/format";
import { niceStep, wrap } from "../../utils/format";

const CSV_REQUIRED = ["month", "forecast_kwh", "actual_kwh"];
const CSV_CAUSES = [
  ["weather_loss_kwh", "Weather"],
  ["downtime_loss_kwh", "Equipment downtime"],
  ["curtailment_loss_kwh", "Grid curtailment"],
];

interface DataUploadProps {
  meta: any;
  scenario: string;
}

export const DataUpload = ({ meta, scenario }: DataUploadProps) => {
  const [uploaded, setUploaded] = useState<any>(null);

  const parseCsvLine = useCallback((line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"' && q) {
        cur += '"';
        i++;
      } else if (ch === '"') {
        q = !q;
      } else if (ch === "," && !q) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }, []);

  const validateCsv = useCallback((raw: string) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lines = raw.replace(/^\ufeff/, "").split(/\r?\n/).filter((x) => x.trim());
    if (lines.length < 2) {
      return {
        errors: ["The CSV needs a header row and at least one data row."],
        warnings,
        rows: [],
        hasCols: [],
      };
    }
    const headers = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
    const missing = CSV_REQUIRED.filter((h) => !headers.includes(h));
    if (missing.length) {
      return {
        errors: [
          "Missing required column(s): " + missing.join(", ") + ". Download the template to see the supported format.",
        ],
        warnings,
        rows: [],
        hasCols: [],
      };
    }
    const hasCols = CSV_CAUSES.filter(([k]) => headers.includes(k)).map(([k]) => k);
    const rows: any[] = [];
    const seen = new Set<string>();
    lines.slice(1).forEach((line, i) => {
      const cells = parseCsvLine(line);
      const r: any = {};
      headers.forEach((h, j) => {
        r[h] = cells[j] ?? "";
      });
      const n = i + 2;
      const bad: string[] = [];
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)) {
        bad.push(`Row ${n}: month "${r.month}" must use YYYY-MM.`);
      } else if (seen.has(r.month)) {
        bad.push(`Row ${n}: duplicate month ${r.month}. Each month may appear once.`);
      } else {
        seen.add(r.month);
      }
      for (const k of ["forecast_kwh", "actual_kwh"]) {
        if (r[k] === "" || !Number.isFinite(Number(r[k])) || Number(r[k]) < 0) {
          bad.push(`Row ${n}: ${k} must be a non-negative number.`);
        }
      }
      for (const [k] of CSV_CAUSES) {
        if (r[k] !== undefined && r[k] !== "" && !Number.isFinite(Number(r[k]))) {
          bad.push(`Row ${n}: ${k} must be numeric.`);
        }
      }
      if (bad.length) {
        errors.push(...bad);
      } else {
        rows.push({
          month: r.month,
          forecast: Number(r.forecast_kwh),
          actual: Number(r.actual_kwh),
          weather: Number(r.weather_loss_kwh || 0),
          downtime: Number(r.downtime_loss_kwh || 0),
          curtailment: Number(r.curtailment_loss_kwh || 0),
        });
      }
    });
    if (errors.length > 6) {
      const extra = errors.length - 6;
      errors.length = 6;
      errors.push(`…and ${extra} more problem(s).`);
    }
    if (!errors.length) {
      rows.sort((a: any, b: any) => a.month.localeCompare(b.month));
      if (rows.length !== 12) {
        warnings.push(`${rows.length} month(s) found. A full reporting year has 12.`);
      }
      const idx = rows.map((r: any) => Number(r.month.slice(0, 4)) * 12 + Number(r.month.slice(5)) - 1);
      const gaps = idx.slice(1).filter((x: number, i: number) => x - idx[i] !== 1).length;
      if (gaps) {
        warnings.push("Some months are missing between the first and last row.");
      }
      const off = CSV_CAUSES.filter(([k]) => !hasCols.includes(k)).map(([, n]) => n.toLowerCase());
      if (off.length) {
        warnings.push(`No ${off.join(", ")} column: those losses are not attributed and remain in Unexplained.`);
      }
    }
    return { errors, warnings, rows, hasCols };
  }, [parseCsvLine]);

  const readPlantCsv = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploaded({ error: ["Please choose a .csv file."], name: file.name });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploaded({ error: ["File is larger than the 2 MB demo limit."], name: file.name });
      return;
    }
    const text = await file.text();
    ingestCsv(text, file.name);
  }, []);

  const ingestCsv = useCallback((raw: string, name: string) => {
    const v = validateCsv(raw);
    if (v.errors.length) {
      setUploaded({ error: v.errors, name, warnings: v.warnings });
      return;
    }
    setUploaded({ name, rows: v.rows, warnings: v.warnings, hasCols: v.hasCols, error: null });
  }, [validateCsv]);

  const loadSample = useCallback(async (path: string, name: string) => {
    try {
      const r = await fetch(path);
      if (!r.ok) throw new Error();
      ingestCsv(await r.text(), name);
    } catch {
      // sample load failed silently
    }
  }, [ingestCsv]);

  const downloadSampleCsv = useCallback(async () => {
    try {
      const months = meta.scenarios.find((x: any) => x.key === scenario)?.monthly || [];
      const rows: string[] = [];
      for (const m of months) {
        try {
          const resp = await fetch(`/data/${scenario}_${m.period}.json`);
          const a = await resp.json();
          const c: any = Object.fromEntries(a.components.map((x: any) => [x.id, x.kwh]));
          rows.push(
            [m.period, a.forecast_kwh, a.actual_kwh, c.irradiance + c.temperature, c.downtime, c.curtailment]
              .map((v: any, i: number) => (i ? Math.round(v) : v))
              .join(",")
          );
        } catch {}
      }
      const csv = "month,forecast_kwh,actual_kwh,weather_loss_kwh,downtime_loss_kwh,curtailment_loss_kwh\n" + rows.join("\n") + "\n";
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `solarsleuth_${scenario}_template.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // download failed silently
    }
  }, [meta, scenario]);

  const uploadWaterfall = useCallback((items: any[], total: number) => {
    const W = 820;
    const H = 300;
    const m = { l: 70, r: 14, t: 18, b: 52 };
    let cum = 0;
    const steps = items.map(([label, v, kind]) => {
      const s = { label, v, kind, a: cum, b: cum + v };
      cum += v;
      return s;
    });
    steps.push({ label: "Total gap", v: total, kind: "total", a: 0, b: total });
    const vals = steps.flatMap((s) => [s.a, s.b]).concat(0);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const pad = (hi - lo) * 0.12 || 1;
    lo -= pad;
    hi += pad;
    const y = (v: number) => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
    const bw = (W - m.l - m.r) / steps.length;
    const st = niceStep((hi - lo) / 5);
    let g = "";
    for (let t = Math.ceil(lo / st) * st; t <= hi; t += st) {
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(t / 1000, 0)}</text>`;
    }
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--ink-2)" stroke-width="1.3"/>`;
    const bars = steps.map((s: any, i: number) => {
      const x = m.l + i * bw + bw * 0.18;
      const w = bw * 0.64;
      const top = Math.min(y(s.a), y(s.b));
      const h = Math.max(2, Math.abs(y(s.a) - y(s.b)));
      const fill =
        s.kind === "una"
          ? "url(#uhatch)"
          : s.kind === "total"
            ? "var(--ink-2)"
            : s.v < 0
              ? "var(--red)"
              : "var(--green-2)";
      return `
        <rect x="${x}" y="${top}" width="${w}" height="${h}" rx="3" fill="${fill}" ${s.kind === "una" ? 'stroke="var(--amber)" stroke-width="2.5"' : ""}>
          <title>${esc(s.label)}: ${sg(s.v, 1)}</title>
        </rect>
        <text x="${x + w / 2}" y="${s.v < 0 ? top + h + 15 : top - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">
          ${fmt(s.v / 1000, 1)}
        </text>
        <text x="${x + w / 2}" y="${H - m.b + 18}" text-anchor="middle" font-size="12" font-weight="${s.kind === "una" ? 800 : 500}" fill="${s.kind === "una" ? "var(--amber)" : "var(--ink-2)"}">
          ${esc(s.label)}
        </text>
      `;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Reconciliation waterfall of the uploaded data"><defs><pattern id="uhatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--amber-soft)"/><line x1="0" y1="0" x2="0" y2="8" stroke="var(--amber)" stroke-width="4"/></pattern></defs>${g}${bars}</svg>`;
  }, []);

  const simpleExplanation = (
    <div className="card">
      <h3>What the uploaded data means — in simple terms</h3>
      <div className="sub">
        <p>
          <strong>Forecast total:</strong> sum of all forecast_kwh values from your CSV.
        </p>
        <p>
          <strong>Actual total:</strong> sum of all actual_kwh values from your CSV.
        </p>
        <p>
          <strong>Gap:</strong> actual minus forecast. A negative gap means you produced less than expected.
        </p>
        <p>
          <strong>Unexplained remainder:</strong> the part of the gap that your uploaded cause columns (weather, downtime, curtailment) don't explain. It stays visible — never hidden.
        </p>
        <p>
          <strong>Nothing is uploaded:</strong> the file is parsed and validated entirely in your browser. It is not sent to any server and not run through the hourly engine.
        </p>
      </div>
    </div>
  );

  const renderUploadResult = () => {
    if (!uploaded) return null;
    const u = uploaded;
    if (u.error) {
      return (
        <div className="card problem-card">
          <h3>We couldn't import {esc(u.name || "this file")}</h3>
          <div className="sub">
            Fix the items below and upload again. Nothing was saved.
          </div>
          <ul>
            {u.error.map((e: string, i: number) => (
              <li key={i}>{esc(e)}</li>
            ))}
          </ul>
        </div>
      );
    }

    const rows = u.rows;
    const sum = (k: string) => rows.reduce((n: number, r: any) => n + r[k], 0);
    const F = sum("forecast");
    const A = sum("actual");
    const gap = A - F;
    const wLoss = sum("weather");
    const dLoss = sum("downtime");
    const cLoss = sum("curtailment");
    const un = gap - (wLoss + dLoss + cLoss);
    const share = Math.abs(gap) > 1 ? (Math.abs(un) / Math.abs(gap)) * 100 : 0;
    const maxM = Math.max(1, ...rows.map((r: any) => Math.abs(r.actual - r.forecast)));
    const need =
      share > 25
        ? [
            "Inverter status or outage log (explains downtime)",
            "Grid curtailment notices or setpoint flags",
            "Irradiance and temperature data for the period",
            "Soiling or cleaning records",
          ]
        : [];

    return (
      <>
        <div className="success-banner">
          ✓ Imported {rows.length} monthly records from {esc(u.name)}. Calculated from the uploaded columns only, not from the plant simulator.
        </div>
        {u.warnings.map((x: string, i: number) => (
          <div key={i} className="warning-banner" style={{ margin: "8px 0" }}>
            {esc(x)}
          </div>
        ))}
        <div className="kpis">
          <div className="kpi">
            <small>Forecast total</small>
            <b>{mwh(F, 0)}</b>
          </div>
          <div className="kpi">
            <small>Actual total</small>
            <b>{mwh(A, 0)}</b>
          </div>
          <div className="kpi">
            <small>Gap (actual − forecast)</small>
            <b className={gap < 0 ? "neg" : "pos"}>{sg(gap, 0)}</b>
            <em>{fmt(F ? (gap / F) * 100 : 0, 1)}% vs forecast</em>
          </div>
          <div className="kpi">
            <small>Unexplained remainder</small>
            <b style={{ color: "var(--amber)" }}>{sg(un, 0)}</b>
            <em>{fmt(share, 0)}% of the gap</em>
          </div>
        </div>
        <div className="card">
          <h3>Reconciliation waterfall</h3>
          <div className="sub">
            MWh. Named causes from your columns, then what remains unexplained.
          </div>
          <div
            className="upload-waterfall-html"
            dangerouslySetInnerHTML={{ __html: uploadWaterfall([["Weather", wLoss, "c"], ["Downtime", dLoss, "c"], ["Curtailment", cLoss, "c"], ["Unexplained", un, "una"]], gap) }}
          />
          <div className="note">
            Reconciliation: {sg(wLoss, 1)} + {sg(dLoss, 1)} + {sg(cLoss, 1)} + {sg(un, 1)} = {sg(gap, 1)} total gap. Figures come from this CSV and have not been independently verified.
          </div>
        </div>
        {need.length > 0 && (
          <div className="card una-card">
            <h3>Large unexplained share: data that would reduce it</h3>
            <ul>
              {need.map((x: string, i: number) => (
                <li key={i}>{esc(x)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="card">
          <h3>Monthly gap</h3>
          <div className="sub">Actual minus forecast, by month.</div>
          <div className="upload-table-wrap">
            <table>
              <tr>
                <th>Month</th>
                <th>Forecast kWh</th>
                <th>Actual kWh</th>
                <th>Gap kWh</th>
                <th></th>
              </tr>
              {rows.map((r: any) => {
                const g = r.actual - r.forecast;
                return (
                  <tr key={r.month}>
                    <td>{esc(r.month)}</td>
                    <td>{fmt(r.forecast)}</td>
                    <td>{fmt(r.actual)}</td>
                    <td className={g < 0 ? "neg" : "pos"}>{sg(g, 0).replace(" MWh", "")}</td>
                    <td style={{ width: "26%" }}>
                      <div className="cause-track">
                        <div className={`cause-fill ${g < 0 ? "negative" : ""}`} style={{ width: (Math.abs(g) / maxM) * 100 + "%" }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </table>
          </div>
        </div>
        {simpleExplanation}
      </>
    );
  };

  return (
    <>
      <div className="data-steps">
        <div className="data-step">
          <span>1</span>
          <div>
            <b>Get the template</b>
            <small>Monthly forecast, actual and optional cause columns</small>
          </div>
        </div>
        <div className="data-step">
          <span>2</span>
          <div>
            <b>Upload your CSV</b>
            <small>Checked in your browser, never sent anywhere</small>
          </div>
        </div>
        <div className="data-step">
          <span>3</span>
          <div>
            <b>Review the reconciliation</b>
            <small>Named causes plus a visible unexplained remainder</small>
          </div>
        </div>
      </div>
      <div className="data-grid">
        <div className="card">
          <h3>Upload plant data</h3>
          <div className="sub">Drop a monthly CSV, or start from a sample.</div>
          <div className="upload-card" id="uploadDrop">
            <div className="upload-glyph">⇧</div>
            <h3>Drop your CSV here</h3>
            <p>.csv · up to 2 MB · one row per month (YYYY-MM)</p>
            <div className="upload-actions">
              <label htmlFor="csvFile">Choose CSV</label>{" "}
              <button id="downloadCsv" type="button" onClick={downloadSampleCsv}>
                Download template
              </button>
            </div>
            <input
              id="csvFile"
              type="file"
              accept=".csv,text/csv"
              className="hide"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  readPlantCsv(e.target.files[0]);
                  e.target.value = "";
                }
              }}
            />
          </div>
          <div className="sample-row">
            <span className="note">Demo helpers</span>{" "}
            <button
              className="small-action"
              id="sampleGood"
              type="button"
              onClick={() => loadSample("/samples/monsoon_miss_monthly.csv", "monsoon_miss_monthly.csv")}
            >
              Load valid sample
            </button>{" "}
            <button
              className="small-action"
              id="sampleBad"
              type="button"
              onClick={() => loadSample("/samples/broken_example.csv", "broken_example.csv")}
            >
              Try a broken file
            </button>{" "}
            {uploaded && !uploaded.error && (
              <button
                className="small-action"
                id="resetUpload"
                type="button"
                onClick={() => setUploaded(null)}
              >
                Clear data
              </button>
            )}
          </div>
        </div>
        <div className="card">
          <h3>Supported format</h3>
          <div className="sub">Header row, one row per month.</div>
          <div className="item">
            <span><code>month</code></span>
            <b>YYYY-MM</b>
          </div>
          <div className="item">
            <span><code>forecast_kwh</code></span>
            <b>required</b>
          </div>
          <div className="item">
            <span><code>actual_kwh</code></span>
            <b>required</b>
          </div>
          <div className="item">
            <span><code>weather_loss_kwh</code></span>
            <b>optional, signed</b>
          </div>
          <div className="item">
            <span><code>downtime_loss_kwh</code></span>
            <b>optional, signed</b>
          </div>
          <div className="item">
            <span><code>curtailment_loss_kwh</code></span>
            <b>optional, signed</b>
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            Losses are negative, gains positive. Anything the provided columns do not explain is shown as{" "}
            <b>Unexplained</b>, never hidden.
          </div>
        </div>
      </div>
      <div id="uploadResult" className="upload-result">
        {renderUploadResult()}
      </div>
    </>
  );
};
