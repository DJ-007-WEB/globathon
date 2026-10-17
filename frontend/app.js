// Variance Explainer – vanilla JS, hand-drawn SVG (no external dependencies).
const $ = (s, r = document) => r.querySelector(s);
const S = { scen: "s1", period: "FY", tab: "overview", method: "shapley", sel: null, meta: null, a: null, v: null, useApi: false, authMode: "signin", uploaded: null };
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
const loadA = () => getJSON(apiUrl(`/api/analysis?scenario=${S.scen}&period=${S.period}`), `data/${S.scen}_${S.period}.json`);
const loadV = () => getJSON(apiUrl(`/api/validation?scenario=${S.scen}`), `data/${S.scen}_validation.json`);
// Same-origin by default (single-host deploy needs no config). For split hosting,
// pass ?api=https://your-api once — it is remembered in localStorage. data/*.json
// always stays same-origin: snapshots ship with the frontend.
const API_BASE = (() => {
  try {
    const q = new URLSearchParams(location.search).get("api");
    if (q) localStorage.setItem("ve_api_base", q);
    return (q || localStorage.getItem("ve_api_base") || "").replace(/\/$/, "");
  } catch (e) { return ""; }
})();
const apiUrl = p => API_BASE ? API_BASE + p : p.replace(/^\//, "");

async function init() {
  try { S.useApi = (await fetchT(apiUrl("/api/health"), 5000)).ok; } catch (e) { S.useApi = false; }
  try { S.meta = await (await fetchT("data/scenarios.json")).json(); }
  catch (e) { S.meta = {scenarios:[]}; }
  const cards = S.meta.scenarios.map((s,i) => `<button class="sc" data-k="${s.key}"><span class="scenario-index">SCENARIO 0${i+1}</span><b>${esc(s.name)}</b><span>${esc(s.blurb)}</span><span class="scenario-open">Explore scenario <span aria-hidden="true">↗</span></span></button>`).join("");
  $("#landscen").innerHTML = cards || '<div class="card">Demo scenarios could not be loaded. Please refresh the page.</div>';
  $("#landscen").onclick = e => { const b = e.target.closest(".sc"); if (b) { S.scen = b.dataset.k; requestAccess(); } };
  $("#startdemo").onclick = () => requestAccess();
  $("#tabs").onclick = e => { const b = e.target.closest("button"); if (!b) return; S.tab = b.dataset.tab; render(); };
  $("#scenarioSelect").onchange = e => { if (e.target.value !== S.scen) { S.scen = e.target.value; S.period = "FY"; S.uploaded = null; refresh(); } };
  $("#themeToggle").onclick = toggleTheme;
  initAuthUi();
  $("#brandHome").onclick = e => { e.preventDefault(); if (isAuthed()) { S.tab = "overview"; enterApp(); } else { goLanding(); } };
  $("#authClose").onclick = () => $("#authModal").classList.add("hide");
  $("#authModal").onclick = e => { if (e.target.id === "authModal") $("#authModal").classList.add("hide"); };
  document.querySelectorAll("[data-authmode]").forEach(b => b.onclick = () => setAuthMode(b.dataset.authmode));
  $("#authForm").onsubmit = submitAuth;
  initChat(); initUploadControls(); initTheme();
  if (isAuthed()) { syncUser(); enterApp(); } else syncUser();
}
function isAuthed() { return !!Auth.current(); }
function requestAccess() { if (isAuthed()) { enterApp(); return; } openAuth("signin"); }
function openAuth(mode) { setAuthMode(mode || "signin"); showAuthError(""); $("#authModal").classList.remove("hide"); $("#authEmail").focus(); }
function showAuthError(msg, field) { const e = $("#authError"); e.textContent = msg; e.classList.toggle("hide", !msg); document.querySelectorAll("#authForm input").forEach(i => i.classList.remove("invalid")); const m = { name: "authName", email: "authEmail", password: "authPassword", confirm: "authConfirm" }[field]; if (msg && m) { $("#" + m).classList.add("invalid"); $("#" + m).focus(); } }
function setAuthMode(mode) { S.authMode = mode; const su = mode === "signup"; document.querySelectorAll("[data-authmode]").forEach(b => b.classList.toggle("on", b.dataset.authmode === mode)); ["nameLabel", "authName", "confirmLabel", "authConfirm"].forEach(id => $("#" + id).classList.toggle("hide", !su)); $("#demoCred").classList.toggle("hide", su); $("#authPassword").autocomplete = su ? "new-password" : "current-password"; $("#authPassword").placeholder = su ? "8+ characters, a letter and a number" : "Enter your password"; $("#authTitle").textContent = su ? "Create your demo account." : "Your solar intelligence workspace."; $("#authForm button[type=submit]").innerHTML = su ? "Create account <span>→</span>" : "Sign in <span>→</span>"; showAuthError(""); }
async function submitAuth(e) {
  e.preventDefault(); const em = $("#authEmail").value, pw = $("#authPassword").value, su = S.authMode === "signup";
  const r = su ? await Auth.signup($("#authName").value, em, pw, $("#authConfirm").value) : await Auth.login(em, pw);
  if (!r.ok) { showAuthError(r.error, r.field); return; }
  $("#authModal").classList.add("hide"); $("#authForm").reset(); syncUser(); S.tab = "overview"; enterApp(); showToast(su ? "Account created. Welcome, " + r.user.name.split(" ")[0] + "." : "Signed in as " + r.user.name + ".");
}
function syncUser() {
  const u = Auth.current(); $("#signinButton").classList.toggle("hide", !!u); $("#accountButton").classList.toggle("hide", !u);
  if (u) { $("#accountButton").textContent = u.name.charAt(0).toUpperCase(); $("#umName").textContent = u.name; $("#umEmail").textContent = u.email; $("#sbName").textContent = u.name; $("#sbEmail").textContent = u.email; }
  else { $("#sbName").textContent = "SolarSleuth Demo"; $("#sbEmail").textContent = "Local synthetic workspace"; $("#userMenu").classList.add("hide"); }
}
function initAuthUi() {
  $("#signinButton").onclick = () => openAuth("signin");
  $("#accountButton").onclick = ev => { ev.stopPropagation(); $("#userMenu").classList.toggle("hide"); };
  document.addEventListener("click", ev => { if (!ev.target.closest(".avatar-wrap")) $("#userMenu").classList.add("hide"); });
  $("#umData").onclick = () => { $("#userMenu").classList.add("hide"); S.tab = "data"; render(); };
  $("#umOut").onclick = () => { Auth.logout(); syncUser(); goLanding(); showToast("Signed out."); };
  $("#useDemo").onclick = () => { $("#authEmail").value = Auth.DEMO.email; $("#authPassword").value = Auth.DEMO.password; showAuthError(""); };
  $("#pwToggle").onclick = () => { const p = $("#authPassword"), show = p.type === "password"; p.type = show ? "text" : "password"; $("#pwToggle").textContent = show ? "Hide" : "Show"; };
}
function initTheme() { let theme = "light"; try { theme = localStorage.getItem("solarsleuth_theme") || "light"; } catch(e) {} document.documentElement.dataset.theme = theme; updateThemeButton(); }
function toggleTheme() { const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; try { localStorage.setItem("solarsleuth_theme", next); } catch(e) {} updateThemeButton(); }
function updateThemeButton() { const dark = document.documentElement.dataset.theme === "dark"; $(".theme-symbol").textContent = dark ? "☾" : "☼"; $("#themeToggle").title = dark ? "Switch to light mode" : "Switch to dark mode"; }
function showToast(message) { const t = $("#toast"); t.textContent = message; t.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => t.classList.remove("show"), 2600); }
function enterApp(scen) {
  if (scen) { S.scen = scen; S.period = "FY"; }
  document.body.classList.remove("pre-demo"); $("#landing").classList.add("hide"); $("#app").classList.remove("hide");
  S.tab = S.tab || "overview"; refresh();
}
function goLanding() { document.body.classList.add("pre-demo"); $("#app").classList.add("hide"); $("#landing").classList.remove("hide"); }
async function refresh() {
  $("#loading").style.display = "block";
  try {
    const [a, v] = await Promise.all([loadA(), loadV()]);
    if (!a || !Array.isArray(a.components) || !a.unexplained || !v || !Array.isArray(v.rows)) throw new Error("Unexpected response shape");
    S.a = a; S.v = v;
  } catch (err) {
    $("#loading").style.display = "none"; document.querySelectorAll(".view").forEach(x => x.classList.add("hide"));
    const vw = $("#view-" + S.tab); vw.classList.remove("hide"); vw.innerHTML = `<div class="card"><h3>Could not load data</h3><div class="note">${esc(err && err.message || err)}. The API may be down and no static snapshot was found.</div><div style="margin-top:8px"><button class="btn btn-primary" id="retry">Retry</button></div></div>`; $("#retry").onclick = refresh; return;
  }
  S.sel = null; $("#loading").style.display = "none"; render();
}
function controls() {
  $("#scenarioSelect").innerHTML = S.meta.scenarios.map(s => `<option value="${s.key}" ${s.key === S.scen ? "selected" : ""}>${esc(s.name)}</option>`).join("");
  const sc = S.meta.scenarios.find(m => m.key === S.scen), mx = Math.max(...sc.monthly.map(m => Math.abs(m.gap_pct)), 1);
  $("#periods").innerHTML = `<button class="pc ${S.period === "FY" ? "on" : ""}" data-p="FY">Full year<i style="width:100%"></i></button>` + sc.monthly.map(m => `<button class="pc ${S.period === m.period ? "on" : ""}" data-p="${m.period}" title="${m.gap_pct}% vs forecast">${per(m.period).split(" ")[0]}<i style="width:${Math.max(8, Math.abs(m.gap_pct) / mx * 100)}%;background:${m.gap_pct < 0 ? "var(--red)" : "var(--green)"}"></i></button>`).join("");
  $("#periods").onclick = e => { const b = e.target.closest(".pc"); if (b && b.dataset.p !== S.period) { S.period = b.dataset.p; S.uploaded = null; refresh(); } };
}
function render() {
  if (!S.a || !S.v) return; controls();
  $("#apinote").innerHTML = `<span class="status-dot"></span>${S.useApi ? "Live analysis API connected" : "Offline demo · precomputed engine snapshots"}`;
  const names = {overview:"Overview",data:"Data upload",analysis:"Variance analysis",class:"Cause classification",valid:"Validation lab",report:"Investor report",why:"Methodology"};
  $("#pageCrumb").textContent = names[S.tab] || "Overview"; $("#pageTitle").textContent = S.tab === "overview" ? "Plant overview" : names[S.tab];
  $("#pageSubtitle").textContent = ({data:"Bring your own monthly data: validated in the browser, reconciled with a visible unexplained remainder.",overview:"A portfolio-level view of plant performance and unexplained variance.",analysis:"Trace every material contributor to the production gap.",class:"Understand whether each cause was predictable, controllable or external.",valid:"Test recovered attribution against known synthetic ground truth.",report:"A reproducible, investor-friendly account of the selected period.",why:"Methods, assumptions and product differentiation."})[S.tab] || "";
  document.querySelector(".controls-panel").classList.toggle("hide", S.tab === "data"); document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === S.tab)); document.querySelectorAll(".view").forEach(v => v.classList.add("hide")); $("#view-" + S.tab).classList.remove("hide");
  ({overview:rOverview,data:rData,analysis:rAnalysis,class:rClass,valid:rValid,report:rReport,why:rWhy})[S.tab]();
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

// ---------------------------------------------------------------- why-different
function rWhy() {
  const a = S.a;
  $("#view-why").innerHTML = `
  <div class="card"><h3>How this is different from existing products</h3>
   <div class="sub">Most solar dashboards show a forecast-vs-actual chart and stop. The explaining is left to spreadsheets and arguments. This prototype makes four product bets:</div>
   <table><tr><th>Existing approach</th><th>What we do instead</th><th>Where to see it</th></tr>
   <tr><td>Sequential waterfalls whose bars change with the order causes are listed</td><td><b>Order-independent Shapley attribution</b> — all 128 on/off coalitions simulated, averaged over all 5,040 orderings</td><td>Analysis tab → "Why order-independent?"</td></tr>
   <tr><td>Unknown losses silently smeared across named causes or dumped in "Other"</td><td><b>Explicit unexplained bucket</b> with its own 90% band and a verdict — within noise, or a real signal with missing-data guidance</td><td>Analysis tab → hatched bar + card</td></tr>
   <tr><td>Attribution nobody can check — no ground truth exists</td><td><b>Validation against injected truth</b>, including a deliberately hidden loss the engine must refuse to invent</td><td>Validation tab</td></tr>
   <tr><td>LLM-generated root causes with invented numbers</td><td><b>Numbers only from the deterministic engine</b>; prose is template-rendered and machine-checked number-by-number</td><td>Investor report → "passed ✓"</td></tr></table></div>
  <div class="card"><h3>How we keep results fast and exact</h3>
   <div class="sub">Full-year physics at hourly resolution is expensive — one fresh analysis costs ~12 s at 80 Monte Carlo samples. The demo never pays that on the critical path:</div>
   <table><tr><th>Technique</th><th>Effect (measured)</th></tr>
   <tr><td><b>Prebuilt snapshots</b> — every scenario × period computed once by <span class="mono" style="display:inline">build_static.py</span></td><td>Demo loads a ~27 KB JSON in well under a second; works with no server at all</td></tr>
   <tr><td><b>Repeat-request cache</b> on the API (32 most recent POST analyses)</td><td>Identical re-analysis drops from ~3 s to ~0.005 s with byte-equal output</td></tr>
   <tr><td><b>Adjustable Monte Carlo knob</b> (<span class="mono" style="display:inline">n_mc_samples</span>, capped at 200)</td><td>Interactive exploration at 2–10 samples (~1–2 s); full 80-sample bands for the record</td></tr>
   <tr><td><b>Integer milli-kWh reconciliation</b></td><td>Σ causes + unexplained = gap <b>exactly</b> — no rounding drift between headline, chart and report</td></tr>
   <tr><td><b>Vectorised numpy core</b>, one coalition matrix per analysis, no per-hour Python loops</td><td>128 coalitions × 8,760 hours stay in seconds; FY suite benchmark prints its own timing</td></tr></table>
   <div class="note">Current selection: ${esc(a.scenario_name)} · ${esc(a.period_label)} · gap ${sg(a.gap_kwh, 0)} (${fmt(a.gap_pct, 1)}%). All figures on this page come from the same analysis object as the charts.</div></div>`;
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

// ---------------------------------------------------------------- overview dashboard
function rOverview() {
  const a=S.a, meta=S.meta.scenarios.find(x=>x.key===S.scen), months=meta.monthly||[], forecast=a.forecast_kwh, actual=a.actual_kwh, gap=a.gap_kwh;
  const causes=a.components.filter(c=>c.present && c.kwh<0).sort((x,y)=>x.kwh-y.kwh).slice(0,5), maxCause=Math.max(1,...causes.map(c=>Math.abs(c.kwh)));
  const maxMonth=Math.max(1,...months.map(m=>Math.abs(m.gap_pct)));
  const bars=months.map(m=>{const h=Math.max(4,Math.min(100,Math.abs(m.gap_pct)/maxMonth*100));return `<div class="chart-bar-group"><div class="chart-bar-pair"><div class="chart-bar ${m.gap_pct<0?'negative':'positive'}" style="height:${h}%" title="${fmt(m.gap_pct,1)}% vs forecast"></div></div><span class="chart-bar-label">${per(m.period).split(" ")[0]}</span></div>`;}).join("");
  $("#view-overview").innerHTML=`<div class="overview-welcome"><div><h2>Good to see you${Auth.current()?", "+esc(Auth.current().name.split(" ")[0]):""}.</h2><p>Here is the performance story for ${esc(a.plant_name)} · ${esc(a.period_label)}.</p></div><span class="overview-badge">● SYNTHETIC DEMO DATA</span></div>
  <div class="kpis"><div class="kpi"><small>Forecast energy</small><b>${mwh(forecast,0)}</b><em>Expected generation · ${esc(a.period_label)}</em></div><div class="kpi"><small>Actual energy</small><b>${mwh(actual,0)}</b><em>Metered / simulated production</em></div><div class="kpi"><small>Production variance</small><b class="${gap<0?'neg':'pos'}">${sg(gap,0)}</b><em>${fmt(a.gap_pct,1)}% vs forecast · ${lakh(a.gap_inr)} illustrative impact</em></div><div class="kpi"><small>Unexplained remainder</small><b style="color:var(--amber)">${sg(a.unexplained.kwh,0)}</b><em>${a.unexplained.exceeds_band?'Beyond uncertainty band':'Within uncertainty band'} · ${fmt(a.unexplained.pct_of_gap||0,1)}% of gap</em></div></div>
  <div class="overview-grid"><div><div class="card"><div class="section-heading" style="margin-bottom:10px;align-items:center"><div><h3>Monthly performance signal</h3><div class="sub">Relative gap magnitude across the selected scenario. Use Variance Analysis for the detailed daily curves.</div></div><div class="chart-legend"><span><i class="negative-key"></i>Shortfall</span><span><i class="actual-key"></i>At / above forecast</span></div></div><div class="chart-bars">${bars}</div><div class="note" style="margin-top:10px">Bar height shows the magnitude of monthly variance; color distinguishes underperformance from months at or above forecast. Detailed forecast and actual series are available in Variance Analysis.</div></div>
  <div class="card"><h3>Largest negative contributors</h3><div class="sub">Ranked by estimated contribution to underperformance.</div>${causes.map(c=>`<div class="cause-row"><span class="cause-name">${esc(c.cause)}</span><div class="cause-track"><div class="cause-fill negative" style="width:${Math.abs(c.kwh)/maxCause*100}%"></div></div><b class="cause-value neg">${mwh(c.kwh,0)}</b></div>`).join('')||'<p class="note">No material negative contributors in this period.</p>'}<div class="overview-actions" style="margin-top:15px"><button class="btn btn-primary" data-goto="analysis">Explain this variance <span>→</span></button><button class="small-action" data-goto="valid">Open validation lab</button></div></div></div>
  <div><div class="card"><h3>Recommended next step</h3><div class="sub">Evidence-led, not a black-box diagnosis.</div><div class="feature-icon icon-unknown" style="margin:15px 0">⌕</div><b style="font-size:12px">${a.unexplained.exceeds_band?'Investigate the unexplained signal':'Review the largest supported cause'}</b><p class="note" style="margin:8px 0 14px">${esc(a.unexplained.message)}</p><button class="small-action" data-goto="analysis">Inspect evidence →</button></div>
  <div class="card data-cta"><h3>Bring your own data</h3><div class="sub">Import a monthly CSV and reconcile its gap, with validation and a visible unexplained remainder.</div><button class="btn btn-primary" data-goto="data">Open data upload <span>→</span></button></div>
  <div class="card"><h3>Engine status</h3><div class="item"><span>Analysis engine</span><b class="${S.useApi?'pos':'na'}">${S.useApi?'Connected':'Snapshot mode'}</b></div><div class="item"><span>Attribution</span><b>Deterministic</b></div><div class="item"><span>Uncertainty</span><b>90% bands</b></div><div class="item"><span>Reconciliation</span><b class="${a.reconciliation.closes?'pos':'neg'}">${a.reconciliation.closes?'Passed':'Review'}</b></div></div></div></div>`;
  $("#view-overview").querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.goto;render();});
}

// ---------------------------------------------------------------- deterministic assistant
function initChat(){ $('#chatLauncher').onclick=()=>$('#chatPanel').classList.toggle('hide'); $('#chatClose').onclick=()=>$('#chatPanel').classList.add('hide'); $('#chatForm').onsubmit=e=>{e.preventDefault();const q=$('#chatInput').value.trim();if(!q)return;addChatMessage(q,'user');$('#chatInput').value='';setTimeout(()=>addChatMessage(chatAnswer(q),'assistant'),100);};$('.suggested-questions').onclick=e=>{const b=e.target.closest('button');if(!b)return;addChatMessage(b.textContent,'user');setTimeout(()=>addChatMessage(chatAnswer(b.textContent),'assistant'),100);};}
function addChatMessage(text,who){const d=document.createElement('div');d.className='chat-message '+who;d.textContent=text;$('#chatMessages').appendChild(d);$('#chatMessages').scrollTop=$('#chatMessages').scrollHeight;}
function chatAnswer(q){const t=q.toLowerCase(),a=S.a;if(!a)return 'Open the demo workspace first so I can explain the selected plant analysis.';const causes=a.components.filter(c=>c.present).sort((x,y)=>Math.abs(y.kwh)-Math.abs(x.kwh));const largest=causes[0];if(/hello|hi\b|hey/.test(t))return 'Hello! I can explain the selected scenario using the analysis already loaded in SolarSleuth. Ask about the production gap, causes, unexplained loss or confidence.';if(/unexplained|unknown|residual/.test(t))return `Unexplained is the part of the measured gap that the currently supported causes do not account for. Here it is ${sg(a.unexplained.kwh,1)} (${fmt(a.unexplained.pct_of_gap||0,1)}% of the gap), with a 90% band from ${sg(a.unexplained.lower_kwh,1)} to ${sg(a.unexplained.upper_kwh,1)}. ${a.unexplained.message} The engine keeps this visible rather than inventing a cause.`;if(/largest|biggest|top cause|main cause/.test(t))return `By absolute attributed contribution in the current ${a.period_label} view, the largest component is ${largest?largest.cause:'not available'} at ${largest?sg(largest.kwh,1):'—'}. This is an estimate from the deterministic synthetic engine, not a verified diagnosis at a real plant.`;if(/reliable|confidence|accurate|trust|uncertaint/.test(t))return `The engine reports 90% uncertainty bands based on ${a.monte_carlo.samples} Monte Carlo runs that perturb ${a.monte_carlo.perturbed}. Validation compares recovered contributions with injected truth in synthetic scenarios. This tests the attribution method under the simulator's assumptions; it does not establish real-world accuracy for a live plant.`;if(/curtail|grid/.test(t)){const c=causes.find(x=>/curtail/i.test(x.cause));return `Curtailment represents output lost when the grid or external dispatch conditions restrict generation. In this selected period the attributed contribution is ${c?sg(c.kwh,1):'not material or not present'}. Any potentially claimable flag is only an evidence prompt; it is not a legal conclusion.`;}if(/weather|irradiance|temperature|rain|monsoon/.test(t)){const c=causes.filter(x=>/irradiance|temperature|weather/i.test(x.cause)).sort((x,y)=>Math.abs(y.kwh)-Math.abs(x.kwh))[0];return `Weather effects are estimated from the synthetic plant's irradiance and temperature signals, compared with its model baseline. ${c?`${c.cause} contributes ${sg(c.kwh,1)} in this period. `:''}The selected scenario uses synthetic weather, not a live weather feed.`;}if(/why|fall|miss|shortfall|production|gap|forecast/.test(t))return `For ${a.plant_name} in ${a.period_label}, expected generation was ${mwh(a.forecast_kwh,0)} and actual generation was ${mwh(a.actual_kwh,0)}, a gap of ${sg(a.gap_kwh,0)} (${fmt(a.gap_pct,1)}%). The leading attributed component by magnitude is ${largest?largest.cause:'not available'} (${largest?sg(largest.kwh,1):'—'}). Open Variance Analysis to inspect the waterfall and supporting evidence.`;if(/next|investigat|action|should we/.test(t))return `Start with the largest supported cause and open its evidence drawer. If the unexplained remainder exceeds its uncertainty band, inspect the missing-data guidance for string-level logs, inverter telemetry, meter checks or dispatch records. Do not treat a hypothesis as confirmed without operational evidence.`;if(/shapley|method|order|coalition/.test(t))return 'The engine uses order-independent Shapley-style attribution: it evaluates cause combinations rather than assigning losses based on a single arbitrary order. The unexplained remainder is retained explicitly, and the validation page compares recovered causes with the synthetic causes injected into the scenario.';if(/data|synthetic|real/.test(t))return 'All built-in plant, weather, outage and curtailment records are synthetic demo data. You can upload the provided CSV template to calculate summary metrics from those uploaded rows; uploaded files are not passed through the scenario engine attribution model.';return 'I can answer questions about the production gap, unexplained loss, leading cause, curtailment, confidence, Shapley attribution and demo data. Try one of the suggested questions below.';}

init();
