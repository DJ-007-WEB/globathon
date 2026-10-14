// Variance Explainer – vanilla JS, hand-drawn SVG (no external dependencies).
const $ = (s, r = document) => r.querySelector(s);
const S = { scen: "s1", period: "FY", tab: "analysis", method: "shapley", sel: null, meta: null, a: null, v: null, useApi: false };
const fmt = (x, d = 0) => (x < 0 ? "−" : "") + Math.abs(x).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
const mwh = (kwh, d = 1) => fmt(kwh / 1000, d) + " MWh";
const sg = (kwh, d = 1) => (kwh > 0 ? "+" : "") + mwh(kwh, d);
const lakh = inr => (inr < 0 ? "−" : "") + "₹" + fmt(Math.abs(inr) / 1e5, 1) + " L";
const per = p => p === "FY" ? "FY 25-26" : new Date(p + "-01").toLocaleString("en", { month: "short", year: "2-digit" });
const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

async function fetchT(url, ms = 30000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { signal: c.signal }); }
  finally { clearTimeout(t); }
}
async function getJSON(apiUrl, staticUrl) {
  if (S.useApi) { try { const r = await fetchT(apiUrl); if (r.ok) return r.json(); } catch (e) {} }
  const r = await fetchT(staticUrl); if (!r.ok) throw new Error("Cannot load " + staticUrl); return r.json();
}
const loadA = () => getJSON(`api/analysis?scenario=${S.scen}&period=${S.period}`, `data/${S.scen}_${S.period}.json`);
const loadV = () => getJSON(`api/validation?scenario=${S.scen}`, `data/${S.scen}_validation.json`);

async function init() {
  try { S.useApi = (await fetchT("api/health", 5000)).ok; } catch (e) { S.useApi = false; }
  S.meta = await (await fetchT("data/scenarios.json")).json();
  $("#landscen").innerHTML = S.meta.scenarios.map(s => `<button class="sc" data-k="${s.key}"><b>${esc(s.name)}</b><span>${esc(s.blurb)}</span><span><b>Open →</b></span></button>`).join("");
  $("#landscen").onclick = e => { const b = e.target.closest(".sc"); if (b) enterApp(b.dataset.k); };
  $("#launch").onclick = () => enterApp(S.scen);
  $("#tabs").onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tab === "overview") { goLanding(); return; }
    S.tab = b.dataset.tab;
    if ($("#app").classList.contains("hide")) enterApp(); else render();
  };
}
function enterApp(scen) {
  if (scen) { S.scen = scen; S.period = "FY"; }
  $("#landing").classList.add("hide"); $("#app").classList.remove("hide");
  refresh();
}
function goLanding() {
  $("#app").classList.add("hide"); $("#landing").classList.remove("hide");
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === "overview"));
}
async function refresh() {
  $("#loading").style.display = "block";
  try {
    const [a, v] = await Promise.all([loadA(), loadV()]);
    if (!a || !Array.isArray(a.components) || !a.unexplained || !v || !Array.isArray(v.rows)) throw new Error("Unexpected response shape");
    S.a = a; S.v = v;
  } catch (err) {
    $("#loading").style.display = "none";
    document.querySelectorAll(".view").forEach(x => x.classList.add("hide"));
    const vw = $("#view-" + S.tab); vw.classList.remove("hide");
    vw.innerHTML = `<div class="card"><h3>Could not load data</h3><div class="note">${esc(err && err.message || err)}. The API may be down and no static snapshot was found.</div><div style="margin-top:8px"><button class="btn" id="retry">Retry</button></div></div>`;
    $("#retry").onclick = refresh;
    return;
  }
  S.sel = null; $("#loading").style.display = "none"; render();
}
function controls() {
  $("#scen").innerHTML = S.meta.scenarios.map(s => `<button class="sc ${s.key === S.scen ? "on" : ""}" data-k="${s.key}"><b>${esc(s.name)}</b><span>${esc(s.blurb)}</span></button>`).join("");
  $("#scen").onclick = e => { const b = e.target.closest(".sc"); if (b && b.dataset.k !== S.scen) { S.scen = b.dataset.k; S.period = "FY"; refresh(); } };
  const sc = S.meta.scenarios.find(s => s.key === S.scen), mx = Math.max(...sc.monthly.map(m => Math.abs(m.gap_pct)), 1);
  $("#periods").innerHTML = `<button class="pc ${S.period === "FY" ? "on" : ""}" data-p="FY">Full year<i style="background:${sc.fy_gap_pct < 0 ? "var(--loss)" : "var(--gain)"};width:100%"></i></button>` +
    sc.monthly.map(m => `<button class="pc ${S.period === m.period ? "on" : ""}" data-p="${m.period}" title="${m.gap_pct}% vs forecast">${per(m.period).split(" ")[0]}<i style="background:${m.gap_pct < 0 ? "var(--loss)" : "var(--gain)"};width:${Math.max(8, Math.abs(m.gap_pct) / mx * 100)}%"></i></button>`).join("");
  $("#periods").onclick = e => { const b = e.target.closest(".pc"); if (b && b.dataset.p !== S.period) { S.period = b.dataset.p; refresh(); } };
}
function render() {
  controls();
  $("#apinote").textContent = S.useApi ? "" : "Static snapshot mode — API unavailable; showing prebuilt engine output. All data synthetic.";
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === S.tab));
  document.querySelectorAll(".view").forEach(v => v.classList.add("hide"));
  $("#view-" + S.tab).classList.remove("hide");
  ({ analysis: rAnalysis, class: rClass, valid: rValid, report: rReport })[S.tab]();
}

// ---------------------------------------------------------------- waterfall
function steps(a, method) {
  const out = []; let cum = 0;
  const comps = a.components.filter(c => c.present);
  for (const c of comps) {
    const v = method === "shapley" ? c.kwh : c.main_effect_kwh;
    const half = (c.upper_kwh - c.lower_kwh) / 2, mid = (c.upper_kwh + c.lower_kwh) / 2;
    // band expressed around the plotted value (shifted if method differs)
    out.push({ id: c.id, label: c.cause, v, start: cum, end: cum + v, lo: cum + v + (c.lower_kwh - c.kwh), hi: cum + v + (c.upper_kwh - c.kwh), cls: c.class, c });
    cum += v;
  }
  if (method !== "shapley") { out.push({ id: "interaction", label: "Interaction", v: a.interaction.kwh, start: cum, end: cum + a.interaction.kwh, cls: "interaction" }); cum += a.interaction.kwh; }
  const u = a.unexplained;
  out.push({ id: "unexplained", label: "UNEXPLAINED", v: u.kwh, start: cum, end: cum + u.kwh, lo: cum + (u.lower_kwh - u.kwh), hi: cum + (u.upper_kwh - u.kwh), cls: "unexplained" });
  cum += u.kwh;
  out.push({ id: "total", label: "Total gap", v: cum, start: 0, end: cum, cls: "total" });
  return out;
}
function waterfall(a, opts = {}) {
  const st = steps(a, S.method), W = 980, H = 400, m = { l: 74, r: 16, t: 20, b: 78 };
  const vals = st.flatMap(s => [s.start, s.end, s.lo ?? s.end, s.hi ?? s.end]).concat([0]);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * .08 || 1; lo -= pad; hi += pad;
  const y = v => m.t + (hi - v) / (hi - lo) * (H - m.t - m.b), bw = (W - m.l - m.r) / st.length, bx = i => m.l + i * bw + bw * .16, bwid = bw * .68;
  const ticks = 5, step = niceStep((hi - lo) / ticks); let g = "";
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="${Math.abs(t) < 1e-9 ? "#1c2430" : "#e8e4d9"}" stroke-width="${Math.abs(t) < 1e-9 ? 1.4 : 1}"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="#667085">${fmt(t / 1000, 0)}</text>`;
  let bars = "";
  st.forEach((s, i) => {
    const top = Math.min(y(s.start), y(s.end)), h = Math.max(2, Math.abs(y(s.start) - y(s.end)));
    const fill = s.cls === "unexplained" ? "url(#hatch)" : s.cls === "total" ? "#1f3a5f" : s.cls === "interaction" ? "#94a3b8" : s.v < 0 ? "#b4452b" : "#0f766e";
    const stroke = s.cls === "unexplained" ? "#7c2d12" : "none", sw = s.cls === "unexplained" ? 3 : 0;
    const sel = S.sel === s.id ? " sel" : "";
    bars += `<rect class="bar${sel}" data-id="${s.id}" x="${bx(i)}" y="${top}" width="${bwid}" height="${h}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"><title>${esc(s.label)}: ${sg(s.v)}</title></rect>`;
    if (s.lo != null && s.cls !== "total") { const cx = bx(i) + bwid / 2; bars += `<g stroke="#1c2430" stroke-width="1.5"><line x1="${cx}" x2="${cx}" y1="${y(s.lo)}" y2="${y(s.hi)}"/><line x1="${cx - 6}" x2="${cx + 6}" y1="${y(s.lo)}" y2="${y(s.lo)}"/><line x1="${cx - 6}" x2="${cx + 6}" y1="${y(s.hi)}" y2="${y(s.hi)}"/></g>`; }
    const ty = s.v < 0 ? Math.max(y(s.start), y(s.end), y(s.lo ?? s.end)) + 16 : Math.min(y(s.start), y(s.end), y(s.hi ?? s.end)) - 8;
    bars += `<text x="${bx(i) + bwid / 2}" y="${ty}" text-anchor="middle" font-size="12" font-weight="${s.cls === "unexplained" ? 800 : 600}" fill="${s.cls === "unexplained" ? "#7c2d12" : "#1c2430"}">${fmt(s.v / 1000, 1)}</text>`;
    const lbl = wrap(s.label, 14); lbl.forEach((l, k) => bars += `<text x="${bx(i) + bwid / 2}" y="${H - m.b + 16 + k * 13}" text-anchor="middle" font-size="11.5" font-weight="${s.cls === "unexplained" ? 800 : 500}" fill="${s.cls === "unexplained" ? "#7c2d12" : "#1c2430"}">${esc(l)}</text>`);
    if (s.c) bars += `<text x="${bx(i) + bwid / 2}" y="${H - m.b + 16 + lbl.length * 13 + 2}" text-anchor="middle" font-size="10" fill="#667085">${esc(s.c.class_label.toLowerCase())}</text>`;
    if (i < st.length - 1 && s.cls !== "total") bars += `<line x1="${bx(i) + bwid}" x2="${bx(i + 1)}" y1="${y(s.end)}" y2="${y(s.end)}" stroke="#98a2b3" stroke-dasharray="3 3"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Variance waterfall"><defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#fde68a"/><line x1="0" y1="0" x2="0" y2="8" stroke="#b45309" stroke-width="4"/></pattern></defs>
  <text x="14" y="${H / 2 - 30}" transform="rotate(-90 14 ${H / 2 - 30})" font-size="11" fill="#667085" text-anchor="middle">MWh vs forecast</text>${g}${bars}</svg>`;
}
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))), n = x / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }
function wrap(t, n) { const w = t.split(" "), out = []; let c = ""; for (const x of w) { if ((c + " " + x).trim().length > n) { out.push(c); c = x; } else c = (c + " " + x).trim(); } if (c) out.push(c); return out; }

// ---------------------------------------------------------------- analysis view
function rAnalysis() {
  const a = S.a, u = a.unexplained, w = a.weather;
  $("#view-analysis").innerHTML = `
  <div class="kpis">
    <div class="kpi"><small>Forecast (P50 typical year)</small><b>${mwh(a.forecast_kwh, 0)}</b><em>${esc(a.period_label)}</em></div>
    <div class="kpi"><small>Actual (metered)</small><b>${mwh(a.actual_kwh, 0)}</b><em>${esc(a.plant_name.split(",")[0])}</em></div>
    <div class="kpi"><small>Gap</small><b class="${a.gap_kwh < 0 ? "neg" : "pos"}">${sg(a.gap_kwh, 0)}</b><em>${fmt(a.gap_pct, 1)}% · ${lakh(a.gap_inr)} at ₹${a.tariff_inr_per_kwh}/kWh</em></div>
    <div class="kpi"><small>Unexplained</small><b style="color:var(--una-ink)">${sg(u.kwh, 0)}</b><em>${u.pct_of_gap == null ? "" : fmt(u.pct_of_gap, 0) + "% of gap · "}${u.exceeds_band ? "beyond uncertainty" : "within uncertainty"}</em></div>
    <div class="kpi"><small>Weather percentile</small><b>${fmt(w.percentile, 0)}</b><em>${esc(w.statement)}</em></div>
  </div>
  <div class="grid"><div>
    <div class="card"><h3>Variance waterfall</h3><div class="sub">Each bar is a cause; whiskers are the 90% band under sensor, meter and calibration uncertainty. Click a bar for evidence.</div>
      <div class="seg" id="meth"><button data-m="shapley" class="${S.method === "shapley" ? "on" : ""}">Order-independent (Shapley)</button><button data-m="isolated" class="${S.method === "isolated" ? "on" : ""}">Isolated effects + interaction</button></div>
      <div id="wf">${waterfall(a)}</div>
      <div class="note">Reconciliation: Σ causes ${sg(a.reconciliation.sum_components_kwh, 3)} + unexplained ${sg(u.kwh, 3)} = gap ${sg(a.gap_kwh, 3)} · ${a.reconciliation.closes ? "<b class='pass'>closes exactly ✓</b>" : "<b class='fail'>DOES NOT CLOSE</b>"}</div></div>
    <div class="card una ${u.exceeds_band ? "" : "ok"}"><h3>${u.exceeds_band ? "⚠ Unexplained: part of this gap is not explained by current data" : "✓ Unexplained is within measurement uncertainty"}</h3>
      <div>${esc(u.message)}</div><div class="note" style="margin-top:6px">${sg(u.kwh, 1)} · ${lakh(u.inr)} · 90% band ${sg(u.lower_kwh, 1)} to ${sg(u.upper_kwh, 1)}</div>
      <b style="font-size:13px;display:block;margin-top:8px">Data that would shrink it</b><ul>${u.data_that_would_reduce_it.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="card"><h3>Why order-independent? A plain waterfall changes with the order of causes</h3>
      <div class="sub">Same simulator, same data. Listing a cause first vs last changes its bar by up to <b>${mwh(a.sequential_demo.max_order_swing_kwh, 0)}</b>. Shapley averages over all 5,040 orderings.</div>
      <table><tr><th>Cause</th><th>Listed first</th><th>Listed last</th><th>Swing</th><th>Shapley (ours)</th></tr>
      ${a.sequential_demo.rows.map(r => `<tr><td>${esc(r.label)}</td><td>${fmt(r.listed_first / 1000, 1)}</td><td>${fmt(r.listed_last / 1000, 1)}</td><td>${fmt(r.order_swing_kwh / 1000, 1)}</td><td><b>${fmt(r.shapley / 1000, 1)}</b></td></tr>`).join("")}</table><div class="note">MWh. Totals are identical; only the split moves.</div></div>
    <div class="card"><h3>Daily forecast vs actual</h3>${daily(a)}</div>
  </div><aside><div class="card drawer" id="drawer"></div>
    <div class="card"><h3>Data quality flags</h3>${a.data_quality_flags.map(f => `<div class="note">• ${esc(f)}</div>`).join("")}</div></aside></div>`;
  $("#meth").onclick = e => { const b = e.target.closest("button"); if (b) { S.method = b.dataset.m; rAnalysis(); } };
  $("#wf").onclick = e => { const r = e.target.closest(".bar"); if (r) { S.sel = r.dataset.id; rAnalysis(); } };
  drawer();
}
function drawer() {
  const a = S.a, d = $("#drawer"), id = S.sel;
  if (!id) { d.innerHTML = `<h4>Evidence drawer</h4><div class="note">Click any bar in the waterfall to see the evidence, formula, confidence and (for curtailment) the claimable flag behind it.</div>`; return; }
  if (id === "unexplained") { const u = a.unexplained; d.innerHTML = `<h4>Unexplained</h4><div class="big" style="color:var(--una-ink)">${sg(u.kwh)}</div><div class="note">${lakh(u.inr)} · band ${sg(u.lower_kwh)} to ${sg(u.upper_kwh)}</div><span class="chip ${u.confidence}">${u.status.replace("_", " ").toLowerCase()}</span><span class="mono">${esc(u.formula)}</span><p>${esc(u.message)}</p>`; return; }
  if (id === "interaction") { d.innerHTML = `<h4>Interaction</h4><div class="big">${sg(a.interaction.kwh)}</div><p>${esc(a.interaction.note)}</p>`; return; }
  if (id === "total") { d.innerHTML = `<h4>Total gap</h4><div class="big">${sg(a.gap_kwh)}</div><p class="note">Actual minus forecast. Equals Σ causes + unexplained.</p>`; return; }
  const c = a.components.find(x => x.id === id); if (!c) return;
  const ev = a.evidence.filter(e => c.evidence_ids.includes(e.id));
  d.innerHTML = `<h4>${esc(c.cause)}</h4><div class="big ${c.kwh < 0 ? "neg" : "pos"}">${sg(c.kwh)}</div><div class="note">${lakh(c.inr)} · 90% band ${sg(c.lower_kwh)} to ${sg(c.upper_kwh)}</div>
   <div style="margin:8px 0"><span class="chip">${esc(c.class_label)}</span><span class="chip ${c.confidence}">${c.confidence} confidence</span>${c.claimable ? '<span class="chip claim">potentially claimable</span>' : ""}</div>
   ${c.class_detail ? `<div class="hl">${esc(c.class_detail)}</div>` : ""}${c.claimable ? `<p class="note">${esc(c.claim_note)}</p>` : ""}
   <b style="font-size:13px">Formula</b><span class="mono">${esc(c.formula)}</span><b style="font-size:13px">Signals</b><div class="note">${c.signals.map(esc).join(" · ")}</div><div class="note">Model ${esc(c.model_version)} · isolated effect ${sg(c.main_effect_kwh)}</div>
   <b style="font-size:13px;display:block;margin-top:8px">Evidence (${ev.length})</b>${ev.map(e => `<div class="ev"><b>${esc(e.title)}${e.kwh != null ? " · " + sg(e.kwh, 1).replace(" MWh", "") + " MWh" : ""}</b><small>${esc(e.window)} · ${esc(e.signal)}</small><div>${esc(e.detail)}</div></div>`).join("") || '<div class="note">No events in this period.</div>'}`;
}
function daily(a) {
  const d = a.daily, W = 700, H = 170, m = { l: 44, r: 8, t: 10, b: 22 }, n = d.dates.length, mx = Math.max(...d.forecast_kwh, ...d.actual_kwh) * 1.05;
  const x = i => m.l + i / Math.max(n - 1, 1) * (W - m.l - m.r), y = v => m.t + (1 - v / mx) * (H - m.t - m.b);
  const path = arr => arr.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%"><line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="#ccc"/><text x="${m.l - 6}" y="${y(mx) + 12}" text-anchor="end" font-size="10" fill="#667085">${fmt(mx / 1000, 0)}</text><text x="${m.l - 6}" y="${y(0)}" text-anchor="end" font-size="10" fill="#667085">0</text>
  <path d="${path(d.forecast_kwh)}" fill="none" stroke="#94a3b8" stroke-width="1.6"/><path d="${path(d.actual_kwh)}" fill="none" stroke="#1f3a5f" stroke-width="1.6"/>
  <text x="${m.l}" y="${H - 5}" font-size="10" fill="#667085">${d.dates[0]}</text><text x="${W - m.r}" y="${H - 5}" text-anchor="end" font-size="10" fill="#667085">${d.dates[n - 1]}</text>
  <text x="${W - 120}" y="18" font-size="11" fill="#94a3b8">— forecast</text><text x="${W - 60}" y="18" font-size="11" fill="#1f3a5f">— actual</text></svg><div class="note">MWh per day</div>`;
}

// ---------------------------------------------------------------- classification
function rClass() {
  const a = S.a, w = a.weather, groups = [["predictable", "Predictable", "Foreseeable at forecast time → fix the forecast / underwriting"], ["controllable", "Controllable", "Operator action could have avoided it"], ["luck", "Luck", "Weather, measured against the multi-year record"], ["external", "Outside operator control", "Third-party action; possibly claimable"]];
  const dots = w.history_sorted, mn = Math.min(...dots, w.irradiance_kwh_m2) - 5, mx = Math.max(...dots, w.irradiance_kwh_m2) + 5, X = v => 20 + (v - mn) / (mx - mn) * 660;
  $("#view-class").innerHTML = `<div class="cols">${groups.map(([k, t, s]) => { const cs = a.components.filter(c => c.class === k && c.present); const tot = cs.reduce((p, c) => p + c.kwh, 0);
    return `<div class="card col"><h4>${t}</h4><div class="note">${s}</div><div class="big ${tot < 0 ? "neg" : "pos"}" style="margin:6px 0">${sg(tot)}</div>${cs.map(c => `<div class="item"><span>${esc(c.cause)}<br><span class="chip ${c.confidence}">${c.confidence}</span>${c.claimable ? '<span class="chip claim">claimable?</span>' : ""}</span><b class="${c.kwh < 0 ? "neg" : "pos"}">${sg(c.kwh)}</b></div>`).join("") || '<div class="note">Nothing material in this period.</div>'}</div>`; }).join("")}</div>
  <div class="card"><h3>Is the weather luck or an extreme? ${esc(a.period_label)}</h3><div class="sub">Measured irradiance sum vs ${w.history_years} synthetic years (stand-in for a reanalysis record such as ERA5; licence and real data to be confirmed).</div>
   <svg viewBox="0 0 700 80" width="100%"><rect x="${X(dots[Math.floor(dots.length * .1)])}" y="26" width="${X(dots[Math.floor(dots.length * .9)]) - X(dots[Math.floor(dots.length * .1)])}" height="22" fill="#e8f3f1"/><line x1="20" x2="680" y1="37" y2="37" stroke="#cbd5e1"/>
   ${dots.map(v => `<circle cx="${X(v)}" cy="37" r="4" fill="#94a3b8"/>`).join("")}<line x1="${X(w.irradiance_kwh_m2)}" x2="${X(w.irradiance_kwh_m2)}" y1="12" y2="62" stroke="${w.extreme ? "#b4452b" : "#1f3a5f"}" stroke-width="3"/>
   <text x="${X(w.irradiance_kwh_m2)}" y="74" text-anchor="middle" font-size="11" font-weight="700" fill="${w.extreme ? "#b4452b" : "#1f3a5f"}">this period: ${fmt(w.irradiance_kwh_m2, 0)} kWh/m²</text><text x="${X(dots[Math.floor(dots.length * .1)])}" y="20" font-size="10" fill="#667085">p10</text><text x="${X(dots[Math.floor(dots.length * .9)])}" y="20" font-size="10" fill="#667085">p90</text></svg>
   <div class="hl"><b>${w.extreme ? "Extreme event" : "Normal variability"}:</b> ${esc(w.statement)}. Typical year: ${fmt(w.typical_year_kwh_m2, 0)} kWh/m² (${fmt(w.delta_pct, 1)}%). Temperature percentile ${fmt(w.temperature_percentile, 0)}.</div></div>
  <div class="card"><h3>Confidence rules (written down, reproducible)</h3><div class="note">High: 90% band ≤ 15% of the value, or directly logged cause (downtime, curtailment) with band ≤ 30%. Medium: band ≤ 60%. Low: wider. Band = 5–95th percentile of ${a.monte_carlo.samples} Monte Carlo runs perturbing ${esc(a.monte_carlo.perturbed)}.</div></div>`;
}

// ---------------------------------------------------------------- validation
function rValid() {
  const v = S.v, s = v.summary, h = v.hidden;
  $("#view-valid").innerHTML = `<div class="kpis">
   <div class="kpi"><small>Named causes recovered</small><b>${s.named_recovered} / ${s.named_causes_material}</b><em>${esc(v.tolerance)}</em></div>
   <div class="kpi"><small>Truth inside our 90% band</small><b>${s.named_within_band} / ${s.named_causes_material}</b><em>calibration of the uncertainty</em></div>
   <div class="kpi"><small>Hidden cause</small><b class="${h.landed_in_unexplained ? "pos" : "neg"}">${h.landed_in_unexplained ? "found in Unexplained ✓" : h.below_detection_floor ? "below detection floor" : "missed"}</b><em>${esc(h.scenario_hidden)}</em></div>
   <div class="kpi"><small>Reconciliation</small><b class="${s.reconciliation_closes ? "pos" : "neg"}">${s.reconciliation_closes ? "closes exactly ✓" : "FAILS"}</b><em>integer milli-kWh check</em></div></div>
  <div class="card"><h3>Injected truth vs recovered · ${esc(v.scenario_name)} · full year</h3><div class="sub">We know the true cause sizes because we generated the plant. The engine only sees noisy sensors, logs and a meter. Nothing here is tuned per scenario.</div>
  <table><tr><th>Cause</th><th>Truth (MWh)</th><th>Recovered (MWh)</th><th>Error (MWh)</th><th>Error %</th><th>Our 90% band</th><th>Result</th></tr>
  ${v.rows.map(r => `<tr><td>${esc(r.cause)}</td><td>${fmt(r.truth_kwh / 1000, 1)}</td><td>${fmt(r.recovered_kwh / 1000, 1)}</td><td>${fmt(r.error_kwh / 1000, 1)}</td><td>${r.error_pct == null ? "–" : fmt(r.error_pct, 0) + "%"}</td><td>${fmt(r.lower_kwh / 1000, 0)} to ${fmt(r.upper_kwh / 1000, 0)} ${r.within_band ? "✓" : "✗"}</td><td class="${!r.material ? "na" : r.recovered ? "pass" : "fail"}">${!r.material ? "immaterial" : r.recovered ? "recovered" : "off"}</td></tr>`).join("")}
  <tr style="background:#fffbeb"><td><b>HIDDEN (unlogged) → should land in Unexplained</b></td><td>${fmt(h.truth_kwh / 1000, 1)}</td><td>${fmt(h.unexplained_kwh / 1000, 1)}</td><td>${fmt(h.error_kwh / 1000, 1)}</td><td>${h.error_pct == null ? "–" : fmt(h.error_pct, 0) + "%"}</td><td>floor ${fmt(h.detection_floor_kwh / 1000, 0)} MWh</td><td class="${h.landed_in_unexplained ? "pass" : "fail"}">${h.landed_in_unexplained ? "refused to invent a cause ✓" : h.below_detection_floor ? "too small to detect" : "missed"}</td></tr></table>
  <p class="hl">Honest reading: irradiance and forecast-model bias are the hardest to separate, because a constant irradiance-sensor bias is absorbed into the calibrated model derate. The 90% bands say so. ${esc(v.limitation)}</p></div>`;
}

// ---------------------------------------------------------------- report
function rReport() {
  const a = S.a, u = a.unexplained, v = S.v, w = a.weather;
  $("#view-report").innerHTML = `<div class="noprint" style="text-align:right;margin-bottom:10px"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>
  <div class="report"><h1>Investor variance report</h1><div class="note">${esc(a.plant_name)} · ${esc(a.period_label)} · model ${esc(a.model_version)} · <b>SYNTHETIC DATA</b></div>
  <h2>Summary</h2><p>${esc(a.narrative.text)}</p><div class="note">Every number in this paragraph is machine-checked against engine output: ${a.narrative.numbers_checked ? "passed ✓" : "FAILED"}.</div>
  <h2>Waterfall</h2>${waterfall(a)}
  <h2>Causes</h2><table><tr><th>Cause</th><th>Class</th><th>MWh</th><th>₹ lakh</th><th>90% band (MWh)</th><th>Confidence</th></tr>
  ${a.components.filter(c => c.present).map(c => `<tr><td>${esc(c.cause)}${c.claimable ? " (potentially claimable)" : ""}</td><td>${esc(c.class_label)}</td><td>${fmt(c.kwh / 1000, 1)}</td><td>${fmt(c.inr / 1e5, 1)}</td><td>${fmt(c.lower_kwh / 1000, 0)} to ${fmt(c.upper_kwh / 1000, 0)}</td><td>${c.confidence}</td></tr>`).join("")}
  <tr><td>Interaction (non-additive diagnostic)</td><td>–</td><td>${fmt(a.interaction.kwh / 1000, 1)}</td><td>${fmt(a.interaction.inr / 1e5, 1)}</td><td>–</td><td>–</td></tr>
  <tr style="background:#fffbeb"><td><b>Unexplained</b></td><td>–</td><td><b>${fmt(u.kwh / 1000, 1)}</b></td><td>${fmt(u.inr / 1e5, 1)}</td><td>${fmt(u.lower_kwh / 1000, 0)} to ${fmt(u.upper_kwh / 1000, 0)}</td><td>${u.confidence}</td></tr>
  <tr><td><b>Total gap</b></td><td></td><td><b>${fmt(a.gap_kwh / 1000, 1)}</b></td><td>${fmt(a.gap_inr / 1e5, 1)}</td><td></td><td></td></tr></table>
  <div class="note">${esc(a.interaction.note)}</div>
  <h2>Unexplained</h2><p>${esc(u.message)}</p>${u.pct_of_gap == null ? "" : `<p>It is ${fmt(u.pct_of_gap, 1)}% of the total gap.</p>`}<p class="note">Data that would reduce it: ${u.data_that_would_reduce_it.map(esc).join("; ")}.</p>
  <h2>Weather</h2><p>Irradiance percentile <b>${fmt(w.percentile, 0)}</b> of ${w.history_years} synthetic years (stand-in for a reanalysis record such as ERA5; licence and real data pending): ${esc(w.statement)}. Typical year ${fmt(w.typical_year_kwh_m2, 0)} kWh/m² (${fmt(w.delta_pct, 1)}%). Mean temperature ${fmt(w.temperature_c, 1)} °C (percentile ${fmt(w.temperature_percentile, 0)}).</p>
  <h2>Evidence</h2>${a.evidence.map(e => `<p class="note"><b>${esc(e.title)}</b> — ${esc(e.window)} · ${esc(e.signal)}${e.kwh != null ? " · " + sg(e.kwh, 1) : ""}<br>${esc(e.detail)}</p>`).join("")}
  <h2>Validation</h2><p class="note">Injected truth vs recovered (${esc(v.scenario_name)}): ${v.summary.named_recovered}/${v.summary.named_causes_material} named causes recovered (${esc(v.tolerance)}). Hidden cause: ${v.hidden.landed_in_unexplained ? "found in Unexplained ✓" : v.hidden.below_detection_floor ? "below detection floor" : "missed"}. Reconciliation ${v.summary.reconciliation_closes ? "closes exactly ✓" : "FAILS"}. ${esc(v.limitation)}</p>
  <h2>Method and caveats</h2><p class="note">Order-independent (Shapley) attribution over a 7-switch plant simulator; unexplained = metered − simulated; 90% bands from ${a.monte_carlo.samples} Monte Carlo runs. Forecast-model derate calibrated on ${a.calibration.hours_used} hours (${esc(a.calibration.window)}). ${a.data_quality_flags.map(esc).join(" ")} Curtailment flags are not legal conclusions.</p></div>`;
}
init();
