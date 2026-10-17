// Data upload page: validates a monthly CSV in the browser and reconciles the gap from the columns provided.
// Nothing is uploaded to a server. Uploaded data is NOT run through the plant simulator (it has no sensor or log data);
// whatever the provided causes do not explain stays visible as "Unexplained".
const CSV_REQUIRED = ["month", "forecast_kwh", "actual_kwh"];
const CSV_CAUSES = [["weather_loss_kwh", "Weather"], ["downtime_loss_kwh", "Equipment downtime"], ["curtailment_loss_kwh", "Grid curtailment"]];

function rData() {
  $("#view-data").innerHTML = `
  <div class="data-steps">
    <div class="data-step"><span>1</span><div><b>Get the template</b><small>Monthly forecast, actual and optional cause columns</small></div></div>
    <div class="data-step"><span>2</span><div><b>Upload your CSV</b><small>Checked in your browser, never sent anywhere</small></div></div>
    <div class="data-step"><span>3</span><div><b>Review the reconciliation</b><small>Named causes plus a visible unexplained remainder</small></div></div>
  </div>
  <div class="data-grid">
    <div class="card"><h3>Upload plant data</h3><div class="sub">Drop a monthly CSV, or start from a sample.</div>
      <div class="upload-card" id="uploadDrop"><div class="upload-glyph">⇧</div><h3>Drop your CSV here</h3><p>.csv · up to 2 MB · one row per month (YYYY-MM)</p>
        <div class="upload-actions"><label for="csvFile">Choose CSV</label><button id="downloadCsv" type="button">Download template</button></div>
        <input id="csvFile" type="file" accept=".csv,text/csv" class="hide"></div>
      <div class="sample-row"><span class="note">Demo helpers</span>
        <button class="small-action" id="sampleGood" type="button">Load valid sample</button>
        <button class="small-action" id="sampleBad" type="button">Try a broken file</button>
        ${S.uploaded ? '<button class="small-action" id="resetUpload" type="button">Clear data</button>' : ""}</div></div>
    <div class="card"><h3>Supported format</h3><div class="sub">Header row, one row per month.</div>
      <div class="item"><span><code>month</code></span><b>YYYY-MM</b></div><div class="item"><span><code>forecast_kwh</code></span><b>required</b></div><div class="item"><span><code>actual_kwh</code></span><b>required</b></div>
      <div class="item"><span><code>weather_loss_kwh</code></span><b>optional, signed</b></div><div class="item"><span><code>downtime_loss_kwh</code></span><b>optional, signed</b></div><div class="item"><span><code>curtailment_loss_kwh</code></span><b>optional, signed</b></div>
      <div class="note" style="margin-top:10px">Losses are negative, gains positive. Anything the provided columns do not explain is shown as <b>Unexplained</b>, never hidden.</div></div>
  </div>
  <div id="uploadResult" class="upload-result"></div>`;
  $("#downloadCsv").onclick = downloadSampleCsv;
  $("#csvFile").onchange = e => { if (e.target.files[0]) readPlantCsv(e.target.files[0]); e.target.value = ""; };
  $("#sampleGood").onclick = () => loadSample("samples/monsoon_miss_monthly.csv", "monsoon_miss_monthly.csv");
  $("#sampleBad").onclick = () => loadSample("samples/broken_example.csv", "broken_example.csv");
  const rs = $("#resetUpload"); if (rs) rs.onclick = () => { S.uploaded = null; showToast("Uploaded data cleared."); rData(); };
  const drop = $("#uploadDrop");
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("dragover"); }; drop.ondragleave = () => drop.classList.remove("dragover");
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove("dragover"); const f = e.dataTransfer.files[0]; if (f) readPlantCsv(f); };
  if (S.uploaded) renderUploadResult();
}

async function downloadSampleCsv() {
  try {
    const months = S.meta.months || (S.meta.scenarios.find(x => x.key === S.scen)?.monthly || []).map(m => m.period);
    const rows = [];
    for (const m of months) {
      const a = await (await fetchT(`data/${S.scen}_${m}.json`)).json(); const c = Object.fromEntries(a.components.map(x => [x.id, x.kwh]));
      rows.push([m, a.forecast_kwh, a.actual_kwh, c.irradiance + c.temperature, c.downtime, c.curtailment].map((v, i) => i ? Math.round(v) : v).join(","));
    }
    const csv = "month,forecast_kwh,actual_kwh,weather_loss_kwh,downtime_loss_kwh,curtailment_loss_kwh\n" + rows.join("\n") + "\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = `solarsleuth_${S.scen}_template.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast("Template downloaded (synthetic example values).");
  } catch (e) { showToast("Could not build the template. Try a sample instead."); }
}
async function loadSample(path, name) {
  try { const r = await fetchT(path); if (!r.ok) throw new Error(); ingestCsv(await r.text(), name); } catch (e) { showToast("Sample file could not be loaded."); }
}
function parseCsvLine(line) { const out = []; let cur = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"' && line[i + 1] === '"' && q) { cur += '"'; i++; } else if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; } else cur += ch; } out.push(cur.trim()); return out; }

async function readPlantCsv(file) {
  const out = $("#uploadResult");
  if (!file.name.toLowerCase().endsWith(".csv")) { out.innerHTML = problemCard(["Please choose a .csv file."], file.name); S.uploaded = null; return; }
  if (file.size > 2 * 1024 * 1024) { out.innerHTML = problemCard(["File is larger than the 2 MB demo limit."], file.name); S.uploaded = null; return; }
  ingestCsv(await file.text(), file.name);
}
function ingestCsv(raw, name) {
  const v = validateCsv(raw), out = $("#uploadResult");
  if (v.errors.length) { S.uploaded = null; out.innerHTML = problemCard(v.errors, name); showToast("CSV has problems. See details below."); return; }
  S.uploaded = { name, rows: v.rows, warnings: v.warnings, hasCols: v.hasCols };
  renderUploadResult(); showToast("CSV validated and imported."); const rs = $("#resetUpload"); if (!rs) rData();
}
function validateCsv(raw) {
  const errors = [], warnings = [];
  const lines = raw.replace(/^﻿/, "").split(/\r?\n/).filter(x => x.trim());
  if (lines.length < 2) return { errors: ["The CSV needs a header row and at least one data row."], warnings, rows: [] };
  const headers = parseCsvLine(lines[0]).map(x => x.toLowerCase());
  const missing = CSV_REQUIRED.filter(h => !headers.includes(h));
  if (missing.length) return { errors: ["Missing required column(s): " + missing.join(", ") + ". Download the template to see the supported format."], warnings, rows: [] };
  const hasCols = CSV_CAUSES.filter(([k]) => headers.includes(k)).map(([k]) => k);
  const rows = [], seen = new Set();
  lines.slice(1).forEach((line, i) => {
    const cells = parseCsvLine(line), r = {}; headers.forEach((h, j) => r[h] = cells[j] ?? ""); const n = i + 2, bad = [];
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)) bad.push(`Row ${n}: month "${r.month}" must use YYYY-MM.`);
    else if (seen.has(r.month)) bad.push(`Row ${n}: duplicate month ${r.month}. Each month may appear once.`); else seen.add(r.month);
    for (const k of ["forecast_kwh", "actual_kwh"]) if (r[k] === "" || !Number.isFinite(Number(r[k])) || Number(r[k]) < 0) bad.push(`Row ${n}: ${k} must be a non-negative number.`);
    for (const [k] of CSV_CAUSES) if (r[k] !== undefined && r[k] !== "" && !Number.isFinite(Number(r[k]))) bad.push(`Row ${n}: ${k} must be numeric.`);
    if (bad.length) errors.push(...bad);
    else rows.push({ month: r.month, forecast: Number(r.forecast_kwh), actual: Number(r.actual_kwh), weather: Number(r.weather_loss_kwh || 0), downtime: Number(r.downtime_loss_kwh || 0), curtailment: Number(r.curtailment_loss_kwh || 0) });
  });
  if (errors.length > 6) { const extra = errors.length - 6; errors.length = 6; errors.push(`…and ${extra} more problem(s).`); }
  if (!errors.length) {
    rows.sort((a, b) => a.month.localeCompare(b.month));
    if (rows.length !== 12) warnings.push(`${rows.length} month(s) found. A full reporting year has 12.`);
    const idx = rows.map(r => Number(r.month.slice(0, 4)) * 12 + Number(r.month.slice(5)) - 1), gaps = idx.slice(1).filter((x, i) => x - idx[i] !== 1).length;
    if (gaps) warnings.push("Some months are missing between the first and last row.");
    const off = CSV_CAUSES.filter(([k]) => !hasCols.includes(k)).map(([, n]) => n.toLowerCase());
    if (off.length) warnings.push(`No ${off.join(", ")} column: those losses are not attributed and remain in Unexplained.`);
  }
  return { errors, warnings, rows, hasCols };
}
function problemCard(errs, name) {
  return `<div class="card problem-card"><h3>We couldn't import ${esc(name || "this file")}</h3><div class="sub">Fix the items below and upload again. Nothing was saved.</div><ul>${errs.map(e => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
}

function uploadWaterfall(items, total) {
  const W = 820, H = 300, m = { l: 70, r: 14, t: 18, b: 52 }; let cum = 0; const steps = items.map(([label, v, kind]) => { const s = { label, v, kind, a: cum, b: cum + v }; cum += v; return s; });
  steps.push({ label: "Total gap", v: total, kind: "total", a: 0, b: total });
  const vals = steps.flatMap(s => [s.a, s.b]).concat(0); let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * .12 || 1; lo -= pad; hi += pad;
  const y = v => m.t + (hi - v) / (hi - lo) * (H - m.t - m.b), bw = (W - m.l - m.r) / steps.length, st = niceStep((hi - lo) / 5); let g = "";
  for (let t = Math.ceil(lo / st) * st; t <= hi; t += st) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(t / 1000, 0)}</text>`;
  g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--ink-2)" stroke-width="1.3"/>`;
  const bars = steps.map((s, i) => { const x = m.l + i * bw + bw * .18, w = bw * .64, top = Math.min(y(s.a), y(s.b)), h = Math.max(2, Math.abs(y(s.a) - y(s.b)));
    const fill = s.kind === "una" ? "url(#uhatch)" : s.kind === "total" ? "var(--ink-2)" : s.v < 0 ? "var(--red)" : "var(--green-2)";
    return `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="3" fill="${fill}" ${s.kind === "una" ? 'stroke="var(--amber)" stroke-width="2.5"' : ""}><title>${esc(s.label)}: ${sg(s.v, 1)}</title></rect>
      <text x="${x + w / 2}" y="${s.v < 0 ? top + h + 15 : top - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${fmt(s.v / 1000, 1)}</text>
      <text x="${x + w / 2}" y="${H - m.b + 18}" text-anchor="middle" font-size="12" font-weight="${s.kind === "una" ? 800 : 500}" fill="${s.kind === "una" ? "var(--amber)" : "var(--ink-2)"}">${esc(s.label)}</text>`; }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Reconciliation waterfall of the uploaded data"><defs><pattern id="uhatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--amber-soft)"/><line x1="0" y1="0" x2="0" y2="8" stroke="var(--amber)" stroke-width="4"/></pattern></defs>${g}${bars}</svg>`;
}
function renderUploadResult() {
  const out = $("#uploadResult"); if (!out || !S.uploaded) return;
  const u = S.uploaded, rows = u.rows, sum = k => rows.reduce((n, r) => n + r[k], 0);
  const F = sum("forecast"), A = sum("actual"), gap = A - F, w = sum("weather"), d = sum("downtime"), c = sum("curtailment"), un = gap - (w + d + c);
  const share = Math.abs(gap) > 1 ? Math.abs(un) / Math.abs(gap) * 100 : 0, maxM = Math.max(1, ...rows.map(r => Math.abs(r.actual - r.forecast)));
  const need = share > 25 ? ["Inverter status or outage log (explains downtime)", "Grid curtailment notices or setpoint flags", "Irradiance and temperature data for the period", "Soiling or cleaning records"] : [];
  out.innerHTML = `<div class="success-banner">✓ Imported ${rows.length} monthly records from ${esc(u.name)}. Calculated from the uploaded columns only, not from the plant simulator.</div>
  ${u.warnings.map(x => `<div class="warning-banner" style="margin:8px 0">${esc(x)}</div>`).join("")}
  <div class="kpis"><div class="kpi"><small>Forecast total</small><b>${mwh(F, 0)}</b></div><div class="kpi"><small>Actual total</small><b>${mwh(A, 0)}</b></div><div class="kpi"><small>Gap (actual − forecast)</small><b class="${gap < 0 ? "neg" : "pos"}">${sg(gap, 0)}</b><em>${fmt(F ? gap / F * 100 : 0, 1)}% vs forecast</em></div><div class="kpi"><small>Unexplained remainder</small><b style="color:var(--amber)">${sg(un, 0)}</b><em>${fmt(share, 0)}% of the gap</em></div></div>
  <div class="card"><h3>Reconciliation waterfall</h3><div class="sub">MWh. Named causes from your columns, then what remains unexplained.</div>${uploadWaterfall([["Weather", w, "c"], ["Downtime", d, "c"], ["Curtailment", c, "c"], ["Unexplained", un, "una"]], gap)}
    <div class="note">Reconciliation: ${sg(w, 1)} + ${sg(d, 1)} + ${sg(c, 1)} + ${sg(un, 1)} = ${sg(gap, 1)} total gap. Figures come from this CSV and have not been independently verified.</div></div>
  ${need.length ? `<div class="card una-card"><h3>Large unexplained share: data that would reduce it</h3><ul>${need.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
  <div class="card"><h3>Monthly gap</h3><div class="sub">Actual minus forecast, by month.</div><div class="upload-table-wrap"><table><tr><th>Month</th><th>Forecast kWh</th><th>Actual kWh</th><th>Gap kWh</th><th></th></tr>
  ${rows.map(r => { const g = r.actual - r.forecast; return `<tr><td>${esc(r.month)}</td><td>${fmt(r.forecast)}</td><td>${fmt(r.actual)}</td><td class="${g < 0 ? "neg" : "pos"}">${sg(g, 0).replace(" MWh", "")}</td><td style="width:26%"><div class="cause-track"><div class="cause-fill ${g < 0 ? "negative" : ""}" style="width:${Math.abs(g) / maxM * 100}%"></div></div></td></tr>`; }).join("")}</table></div></div>`;
}
function initUploadControls() {}
