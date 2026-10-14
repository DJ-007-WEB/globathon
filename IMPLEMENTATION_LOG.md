# IMPLEMENTATION_LOG.md

Per `README_IMPLEMENTATION_INDEX.md` execution rules: record phase, date/time,
files changed, commands run, tests/results, assumptions/deviations, known issues
and next action after each phase.

---

## Phase 14 — Proper landing + in-demo differentiation (user request)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `frontend/index.html` — landing rebuilt (hero with what-we-do, 3 feature
    cards, 4-step how-it-works, scenario launch cards); `body.pre-demo` hides
    nav tabs + app chrome until demo start; new `Why different` tab + view.
  - `frontend/app.js` — `enterApp`/`goLanding` toggle the pre-demo state;
    new `rWhy()` explainer (differentiation table + measured optimization table
    from the live analysis object); curly quotes removed (Windows-1252-safe reads).
  - `frontend/style.css` — new landing selectors only, 4-color soothing palette
    from existing tokens (paper `#f6f4ef`, ink, teal `--gain`, amber `--med`);
    print CSS also hides landing.
  - `engine/tests/test_api.py` — why-tab/landing markers; UTF-8 file read.
- Palette: paper background, deep-ink text, deep teal primary/actions, amber
  reserved for warnings/synthetic flags. No other hues introduced.

### Commands run + results
- `python tests/run_tests.py` → **42/42 PASS**.

---

## Phase 13 — Landing → demo flow + API repeat-cache (user request)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `frontend/index.html` — new `#landing` section (hero + 3 steps + scenario
    launch cards, all existing classes) + Overview nav button; existing app
    wrapped in `#app.hide` untouched otherwise.
  - `frontend/app.js` — `enterApp(scen)` / `goLanding()`; init builds landing
    cards and defers data load until entering the demo (faster first paint, no
    wasted compute); tab switches re-render without refetch.
  - `frontend/style.css` — 3 new selectors only (`#landing`, `.hero`,
    `#landscen`); zero existing rules touched.
  - `engine/api.py` — `_post_analysis_cached` (lru_cache/32) for repeat POSTs;
    validation `seed` now passed through (default 123 reproduces GET exactly).
  - `engine/tests/test_api.py` — landing markers, cache-equality, seed tests.
- Measured perf (TestClient, this machine): static FY JSON 0.18 s / 27 KB;
  POST FY n_mc=2/10/80 → 1.1/2.1/11.8 s (MC scales linearly: 80 runs × 128
  coalitions × 8760 h); repeat POST (cached) 3.11 s → 0.005 s, byte-equal.

### Commands run + results
- `python tests/run_tests.py` → **42/42 PASS** (one self-caught test bug fixed:
  JS function names asserted against `/app.js`, not the HTML).

---

## Phase 12 — 12_DEMO_RUNBOOK_AND_CUT_LINES.md (rehearsal + final checklist)

- Date/time (UTC): 2026-10-14
- Files changed: `12_DEMO_RUNBOOK_AND_CUT_LINES.md` tracked. No code changes —
  rehearsal only. Presenter mapping: runbook `curtailment_heavy` = `s2`
  ("Curtailment Summer"); `baseline` = `s0`; operational = `s1`.

### Live-API rehearsal (TestClient, all 3-minute beats PASS)
- 0:00 scenarios selectable incl. s2; disclosure `data_disclosure="Synthetic demo data"`.
- 0:20 s2 FY gap −2424.5 MWh (−4.731%, −65.5 lakh INR @ ₹2.7).
- 0:45 curtailment −1431 MWh dominant, claimable + contract-review wording;
  interaction explicit, both views reconcile exactly.
- 1:25 s3 unexplained −759.7 MWh beyond 90% band (−736.6 to −724.4) with ≥3
  missing-data items; nothing forced into named causes.
- 1:55 hidden outcomes: s1/s3 in-unexplained ✓, s0/s2 honestly below floor;
  reconciliation closes on all four.
- 2:30 server report 200, HTML, >3 KB; print-tab + print CSS present.
- Hard questions answerable from product: Shapley (sequential-swing demo),
  no-causality-proof (limitation text), synthetic rationale, claimable-only-a-flag,
  limitations disclosed. (One rehearsal-check typo on my side — `shares` vs
  `share` — re-verified True; product was correct.)

### Final pre-demo checklist (§5 — all checked)
- [x] Frontend visually unchanged (proof: `style.css` untouched since 4a13e5c;
  `index.html` +1 div; `app.js` behavior-only; no CSS/layout/nav changes).
- [x] Health check passes. [x] 4 scenarios selectable (superset of 3, no cut needed).
- [x] All cause areas in every response. [x] Order-independent (tested).
- [x] Interaction explicit, never double-counted (both `closes` flags tested).
- [x] Unexplained prominent + band/status (tested, incl. zero-gap branch).
- [x] Hidden never falsely named (tested all scenarios).
- [x] Exact serialized reconciliation (tested over all 52 analysis JSONs + live POST).
- [x] Evidence resolves per cause (tested). [x] Claimability = contract review (tested).
- [x] Report/print works (endpoint + tab tested; needs a real browser for the
  visual print pass — no browser tooling in sandbox, recorded).
- [x] No secrets in Git (scanned 11; rehearse-confirmed clean).
- [x] All tests run + recorded: **41/41 PASS** final.
- [x] Every demo value synthetic-labelled (badge/footer/flags/report/contract field).

### Cut lines (as-shipped status)
1. PDF → print-friendly page: CUT (recorded; samples in `sample_reports/`).
2. MC 80 (not hundreds): KEPT-AS-DOCUMENTED (runtime-measured, bands honest).
3. Claimable flag: KEPT (responsibly worded, curtailment-only).
4. Scenarios: NO CUT NEEDED (4 shipped: s0 baseline added in Phase 1).
- Never-cut items all hold: reconciliation, unexplained, validation, disclosure,
  frontend preservation.

### Sequence complete
- All 12 files processed in order (01→12), each implemented, tested, logged, and
  pushed. Suite grew 8 → 41 tests with zero regressions at any step.

---

## Phase 11 — 11_ENVIRONMENT_DEPLOYMENT_AND_SECURITY.md (config + safety audit)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `.env.example` — NEW: exactly the 3 vars `api.py` reads (origins, MC cap,
    default tariff), placeholders only, no secrets.
  - `engine/api.py` — `_env_config()` validates ranges at startup with clear
    `RuntimeError` messages (no full-env logging anywhere).
  - `engine/tests/test_api.py` — invalid-env subprocess test (4 bad configs fail
    with the documented message).
  - `README.md` — short Configuration section (11 §4 exact-commands note).
  - `11_ENVIRONMENT_DEPLOYMENT_AND_SECURITY.md` — tracked.

### Safety audit (verified, not assumed)
- Secrets: `.env` gitignored (`!.env.example` kept); repo-wide scan for
  api_key/secret/passwd/private-key hits prose-only in spec/log docs — zero
  credentials in code, frontend, logs, or reports. No credentials requested.
- Inputs: Pydantic bounds on scenario/period/tariff/seed/n_mc + 404/422 TESTED;
  period enum bounds analysis length; no file paths/uploads accepted; static
  mount serves only `frontend/`; report values escaped both sides; CORS from env
  TESTED; error envelope never carries stack traces TESTED.
- Local/dev/deploy: README commands match repo layout (`engine/` uvicorn, static
  frontend, `build_static.py`, `run_tests.py`); no DB/queue added; health check
  present; deterministic scenarios; Docker deliberately skipped (no existing setup
  to preserve, local+static demo suffices — recorded cut).

### Commands run + results
- `python tests/run_tests.py` → **41/41 PASS**.

### Known issues / next action
- Next (last): `12_DEMO_RUNBOOK_AND_CUT_LINES.md` — full demo rehearsal + checklist.

---

## Phase 10 — 10_REPORTING_AND_NARRATIVE.md (12-item report audit)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `frontend/app.js` (`rReport`) — added interaction row + convention note,
    unexplained %-of-gap sentence, Weather section, Evidence section, Validation
    summary (from `S.v`). All strings escaped, all numbers engine-sourced.
  - `engine/api.py` (`_report_html`) — same additions server-side (interaction,
    weather, evidence, %-of-gap) + None-safe rendering.
  - `engine/tests/test_api.py` — report 12-item marker audit (server HTML) +
    frontend template marker test; None-leak guard.
  - `10_REPORTING_AND_NARRATIVE.md` — tracked.

### 12-item audit outcome (both reports now carry all 12)
- Title/period, plant metadata (30 MWp in plant name), SYNTHETIC DATA disclosure,
  headline numbers, cause table (class/confidence/claimable), interaction +
  convention, unexplained (+band, %-of-gap, missing data), weather percentile +
  reference, evidence + signals, method + engine version, validation summary,
  limitations + non-legal disclaimer: DONE (interaction/weather/evidence/
  validation-summary/pct were gaps — fixed this phase).
- Single calculation path: both render the same analysis object (server recomputes
  from a validated request, never trusts client figures); inputs validated;
  escaping on both sides (server `html.escape`, client `esc()`).
- PDF = deliberate cut line per 10 §2 (print stylesheet + print-ready server page;
  sample PDFs in `sample_reports/`); no second math path introduced.
- Narrative (§3/§4): template fallback only (no LLM wired — README-recorded);
  number-checker enforced + tested; sign/units/uncertainty preserved; claimable
  wording without entitlement claims.

### Commands run + results
- `python tests/run_tests.py` → **40/40 PASS** (one self-caught marker bug in the
  new test fixed: template uses destructured `v`, asserted via section headers).

### Known issues / next action
- Next: `11_ENVIRONMENT_DEPLOYMENT_AND_SECURITY.md` (.env.example, secret/input audit).

---

## Phase 9 — 09_VALIDATION_TESTING_AND_ACCEPTANCE.md (gates A–E + tests)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `engine/vareng/validation.py` — `model_version` + determinism note in output
    (timestamp deliberately omitted: fixtures stay byte-stable; seed lives in the
    analysis object as `reproducibility_seed`).
  - `engine/tests/test_engine.py` — no-leakage (truth corruption changes nothing),
    each-switch-moves-output (128 masks), zero-gap branch, band ordering.
  - `engine/tests/test_contract.py` — percentile bounds + classification pins
    (s2 downtime high; s3 unexplained beyond band).
  - `frontend/data/*_validation.json` — rebuilt (additive keys only).
  - `09_VALIDATION_TESTING_AND_ACCEPTANCE.md` — tracked.

### Acceptance gates audit
- Gate A (engine): deterministic ✓ / 7 switches covering 6 areas ✓ / 128 cached
  coalitions ✓ / efficiency+order tests ✓ / explicit residual ✓ / finite-only ✓.
- Gate B (API): documented routes work ✓ / stable Pydantic schema ✓ / 404+422
  validation tested ✓ / health envelope ✓.
- Gate C (validation): truth-vs-recovered per cause ✓ / hidden never named (TESTED:
  lands in unexplained s1/s3, below floor s0/s2 honestly reported) / residual ✓ /
  reconciliation ✓.
- Gate D (frontend): design preserved ✓ / API-first with labelled static fallback ✓
  / evidence+classification ✓ / validation visible ✓ / outage retry ✓.
- Gate E (demo): 4 scenarios ✓ / print flow ✓ / disclosure ✓ / 3-min runbook → 12.

### Layer coverage notes
- Unit: simulator/seed/ranges ✓, switch independence ADDED, 128-mask shape ADDED,
  Shapley toy+efficiency ✓, order ✓, interaction ✓, residual+zero-gap ADDED,
  quantiles ADDED, percentile bounds ADDED, classification pins ADDED, evidence ✓.
- Integration: all routes/schema/errors/CORS/client-mapping ✓ (test_api).
- Manual/E2E: scenario trio + report + outage card + visual sameness → rehearsal 12.
- Test commands per repo convention: `python tests/run_tests.py` (no pytest installed);
  backend `python -m uvicorn api:app` from `engine/`; frontend has no package
  scripts (vanilla, recorded — nothing invented).

### Commands run + results
- `python build_static.py` → only 4 validation JSONs changed (additive).
- `python tests/run_tests.py` → **39/39 PASS** (20 engine + 6 contract + 3 physics + 10 api).

### Known issues / next action
- Next: `10_REPORTING_AND_NARRATIVE.md` (report-content audit).

---

## Phase 8 — 08_FRONTEND_INTEGRATION_NO_REDESIGN.md (minimal additive UX)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `frontend/index.html` — ONE empty `<div id="apinote">` under controls.
  - `frontend/app.js` — behavior-only: 30 s fetch timeout (`fetchT`, also on the
    health probe); `refresh()` validates response shape and renders a
    recoverable error card (existing `.card`/`.btn`/`.note` styles) with Retry;
    static-fallback mode shows an explicit "Static snapshot mode" note (08 §6).
    No style/layout/chart/navigation changes; no new dependencies.
  - `engine/tests/test_api.py` — `test_frontend_static_served_and_wired` (index
    tabs, JS wiring without hard-coded hosts, 4-scenario static data).
  - `08_FRONTEND_INTEGRATION_NO_REDESIGN.md` — tracked.

### Mapping audit (verified — no changes)
- Headlines/gap/INR ← `forecast_kwh/actual_kwh/gap_kwh/gap_inr`; waterfall ←
  7 components + interaction (isolated) + unexplained with 90% whiskers; drawer ←
  evidence/formula/confidence/claimable; classes ← `class_label`; percentile ←
  weather; validation ← rows/hidden/summary; report ← same `S.a` object. Tooltips
  render API values; headline reconciliation note asserts `closes`.
- No framework/bundler exists (vanilla) so no `VITE_*` env wiring applies —
  same-origin relative URLs are used instead (strictly better than hard-coded
  localhost; asserted in test). No Shapley math in the browser (pure SVG render).
- Nothing missing: waterfall, drawer, classification, validation, report all
  pre-existed — no new visual design invented.
- Text/table alternatives: validation + report tables; waterfall has
  role/aria-label. Unexplained hatched + own card (never "Other").

### Visual regression
- Before/after: identical shell/nav/tokens/charts. Only additions: error card on
  total failure (previously an infinite spinner — a bug per 08 §6) and one note
  line in static mode. Any broader visual change would be reverted as a bug.

### Commands run + results
- `python tests/run_tests.py` → **34/34 PASS**. JS brace/paren balance + feature
  grep sanity check (no node available for a parse check — recorded).

### Known issues / next action
- No browser tooling in sandbox: error-card/notice rendering verified by code
  inspection + static-serving test only; confirm visually in rehearsal (12).
- Next: `09_VALIDATION_TESTING_AND_ACCEPTANCE.md` (gates A–E audit).

---

## Phase 7 — 07_FASTAPI_BACKEND.md (routes, validation, errors, CORS, tests)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `engine/vareng/attribution.py` — `analyze(..., tariff=2.70)` parameter; every
    INR figure flows from it (defaults reproduce existing numbers exactly).
  - `engine/vareng/contract.py` — unit descriptions on all numeric fields
    (kWh, INR, INR/kWh, percentile).
  - `engine/api.py` — 07 implementation on the existing Starlette convention:
    `GET /api/scenarios/{id}` (metadata + quality flags, no paths); `POST
    /api/analysis` (scenario/period/tariff/seed/n_mc, all bounded per 03/07);
    `POST /api/validation/run`; `POST /api/reports/variance` (print-ready HTML
    recomputed from a validated request — the 10 §2 PDF stays a cut line);
    spec error envelope `{success:false,error:{code,message,details,request_id}}`
    with 404 UNKNOWN_SCENARIO / 422 *_INVALID_* / 500 without stack traces;
    `X-Request-ID` header; server-side runtime logging without secrets; CORS from
    `FRONTEND_ORIGINS` env; historical GET shapes byte-compatible (frontend maps
    them; health body now the 07 envelope — frontend only checks HTTP status).
  - `engine/tests/test_api.py` — NEW (9 tests: all 07 §6 expectations).
  - `engine/tests/run_tests.py` — discovers `test_api`.
  - `07_FASTAPI_BACKEND.md` — tracked.

### Preserved deviations (index rule)
- Starlette kept (no FastAPI swap → no auto OpenAPI docs; route docstrings added).
  POST added alongside GET (not replacing) so the existing UI keeps working.
- Data endpoints stay unenveloped (frontend consumes bare contract); envelope
  applies to health + errors only.
- Timestamps stay consistent naive-local strings (plant is IST-based synthetic);
  no TZ-format churn in displayed evidence windows.
- Sync compute, no queue (07 allows); MC capped at `MAX_MONTE_CARLO_SAMPLES`=200.

### Commands run + results
- Live TestClient smoke: health/scenarios/detail/404/GET-POST analysis/invalid
  inputs/validation-run/report — all as expected (incl. tariff=3.0 flowing to INR).
- `python tests/run_tests.py` → **33/33 PASS** (16 engine + 5 contract + 3 physics
  + 9 api). Default-tariff outputs unchanged (no `frontend/data` drift).

### Known issues / next action
- Next: `08_FRONTEND_INTEGRATION_NO_REDESIGN.md` (mapping audit; outage/fallback UX).

---

## Phase 6 — 06_UNCERTAINTY_CLASSIFICATION_AND_EVIDENCE.md (conformance + test)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `engine/tests/test_contract.py` — `test_evidence_ids_resolve` over all 54
    fixtures (every component evidence_id resolves to a same-cause record).
  - `06_UNCERTAINTY_CLASSIFICATION_AND_EVIDENCE.md` — tracked. No engine changes.

### Conformance verification (read from code/UI, then tested)
- MC bands: 5 perturbations incl. per-sample derate recalibration; 5–95% quantiles;
  seeded (`seed` + period offset); sample count configurable per call (80 default,
  documented runtime trade-off in build timings); band meaning written in UI
  ("model/input uncertainty band"). Availability/curtailment not perturbed (directly
  logged → covered by the directly-measured confidence rule instead). No fabricated
  precision: bands displayed, weak separations admitted (s1/s2 irradiance±model).
- Confidence: explicit `_confidence` rules (≤15% band, or ≤30% if directly measured
  → high; ≤60% → medium; else low; immaterial → high) + written in UI; magnitude-
  independent by construction (relative width). Spec's prose criteria approximated
  by measured-vs-inferred distinction — documented.
- Classification: model→predictable; degradation→predictable; **soiling→
  controllable** (documented split: cleaning cadence is operator-actionable;
  README deviations); downtime→controllable; curtailment→external + claimable flag;
  irradiance/temperature→luck with p10–p90 extreme flag on irradiance + percentile
  detail on temperature. Primary class + rationale shown (per-cause detail where it
  varies, group rationale in classification tab).
- Weather percentile: same-calendar-month(s) across 30 synthetic years, empirical
  rank with tie-half convention, counts as stated (no "20 Julys" invention),
  attached to irradiance, synthetic stand-in labelled.
- Evidence: ids resolve (TESTED); windows/signals/formula/confidence/disclosure
  present; per-cause narrowing guidance lives on the unexplained record +
  evidence signals (adapted convention, documented).
- Claimability: curtailment-only (TESTED), "Potentially claimable" + contract-
  review subtext, no entitlement/legal advice/PS2 logic anywhere.

### Commands run + results
- `python tests/run_tests.py` → **24/24 PASS**.

### Known issues / next action
- Next: `07_FASTAPI_BACKEND.md` (routes/CORS/errors + endpoint tests).

---

## Phase 5 — 05_ENGINE_AND_ATTRIBUTION.md (engine conformance + tests)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `engine/tests/test_engine.py` — 6 new tests covering 05 §8: coalition
    endpoints, stable cause order, interaction-diagnostic definition, injected-
    direction spot checks (real FY values: s2 curtailment −1431 MWh dominant,
    s1 soiling/model negative, s3 unexplained −760 MWh beyond band),
    response finiteness, runtime benchmark cap.
  - `05_ENGINE_AND_ATTRIBUTION.md` — tracked. No engine code changes needed.

### Conformance verification (read from code, then tested)
- Module purity: `vareng/` imports numpy/pandas only — no API/frontend/LLM/report
  imports (only "Claude" mention is a docstring noting the optional 10-style
  rephrase layer, not wired). Adapted boundary (`attribution.py` holds
  attribution+uncertainty+classification+orchestration; `narrative.py` separate)
  preserved per index rule instead of a file split with no behavior gain.
- Counterfactual: `v(empty)=F`, `v(all)=modelled actual pre-hidden`, one switch per
  cause, no double-applied loss, hidden reduces metered actual outside coalitions:
  verified + TESTED.
- Shapley: exact factorial weights over all 128 cached coalitions; stable CAUSES
  order; order-independence demonstrated via sequential swing (max swing >1 MWh
  while totals identical): TESTED.
- Interaction: diagnostic `ΣShapley − Σisolated`, both views reconcile exactly,
  never decorative: TESTED (definition equality to 1e-9 + both `closes` flags).
- Unexplained: residual with kWh/INR/%-of-gap/band/status/missing-data; never
  relabelled "other"; large residuals reported (s3): DONE.
- Numerics: finite-only (TESTED), full internal precision, milli-kWh canonical,
  U from serialized values, money from canonical kWh, signs preserved, positive
  contributions allowed (s0 irradiance +542 MWh FY), hourly floats unrounded: DONE.
- Performance: 128 coalition evals cached per analysis; benchmark test added
  (FY n_mc=2 runs in seconds on this machine vs 300 s cap).

### Commands run + results
- `python tests/run_tests.py` → **23/23 PASS** (16 engine + 4 contract + 3 physics).

### Known issues / next action
- Next: `06_UNCERTAINTY_CLASSIFICATION_AND_EVIDENCE.md`.

---

## Phase 4 — 04_DATA_AND_SYNTHETIC_SCENARIOS.md (data-layer conformance)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `engine/vareng/synth.py` — deterministic event IDs on all log events
    (`outage-NNN`, `trip-NNN`, `curtail-NNN`, §7) + `_check_schema()` range/unit/
    order asserts in `build_world` (§5: availability∈[0,1], soiling∈[0,0.5),
    degradation∈[0,1), positive setpoint, finite non-negative series, 8760 hourly
    monotonic steps).
  - `engine/tests/test_physics.py` — NEW: clear-sky/ERBS/cap sanity (always runs)
    + pvlib Haurwitz cross-check within 10% when pvlib installed, skipped otherwise
    (makes the `physics.py` "tests/test_physics.py cross-checks" docstring true).
  - `engine/tests/run_tests.py` — discovers `test_physics`.
  - `04_DATA_AND_SYNTHETIC_SCENARIOS.md` — tracked.

### Conformance verification
- Hourly 8760 (§2 preferred) with monthly aggregation after modelling: DONE.
- Schema fields: curtailment as export-cap kW (equivalent mechanism to a fraction —
  documented); wind fixed 2.0 m/s in Faiman model (optional field, documented);
  all other §2 fields present incl. flags + event logs.
- Plant story (30 MWp, Jodhpur-region-shaped, never claimed measured), 10-inverter
  deterministic logs, ₹2.70 assumption: DONE.
- Scenario trio + hidden cause: DONE (s0 baseline / s1 operational / s2 curtailment-
  heavy / s3 silent-loss; hidden loss in every scenario incl. s0=0 control).
- Seeded generation, no import-time randomness, separated weather/events/simulate:
  DONE. Schema checks: ADDED this phase. No large data files committed beyond the
  small static JSON snapshots.
- pvlib policy (§6): simplified model clearly named + limitations documented
  (README + physics docstring + validation limitation); cross-check test ADDED.
  Pipeline steps + no double-application of losses: verified in `simulate()`.
- Evidence from logs via counterfactuals (never copied truth): DONE; hidden cause
  has no log/event/evidence entry by construction.
- External data: none used/needed; 30 synthetic years labelled as ERA5 stand-in
  with licence check pending (UI + flags).

### Commands run + results
- `python tests/run_tests.py` → **17/17 PASS** (10 engine + 4 contract + 3 physics).
- No static rebuild: log/schema changes do not enter analysis output (verified —
  `git status` shows no `frontend/data` drift).

### Known issues / next action
- Next: `05_ENGINE_AND_ATTRIBUTION.md` (counterfactual/Shapley/interaction tests).

---

## Phase 3 — 03_ARCHITECTURE_AND_DATA_CONTRACT.md (contract conformance)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `engine/vareng/attribution.py` — every analysis response now carries 03 §2
    envelope: `schema_version:"1.0"`, `data_disclosure:"Synthetic demo data"`,
    `engine_version`, `reproducibility_seed`. Purely additive (frontend/Pydantic
    ignore extras; `Analysis(**…)` in `api.py` unaffected).
  - `engine/tests/test_contract.py` — asserts the envelope on all FY fixtures.
  - `frontend/data/` — rebuilt (additive keys only; deep-walked s1_FY old-vs-new:
    4 keys added, 0 removed, 0 values changed).
  - `03_ARCHITECTURE_AND_DATA_CONTRACT.md` — tracked.

### Conformance verification (all read from code)
- Modular monolith, no DB, JSON fixtures, small interface (`build_world`/
  `analyze`): DONE, no change.
- Engine sole numerical truth (frontend/report/narrative never recalculate): DONE —
  `app.js` renders API values; narrative only formats engine numbers (checker-tested).
- Canonical equation: Shapley view `gap = Σcomponents + unexplained` exact on
  milli-kWh ints (`U_m = gap_m − Σphi_m`, money = canonical kWh × tariff at report
  boundary); isolated view `Σmain + interaction + U = gap` exact. Both asserted.
  Canonical precision = milli-kWh (3 decimals) instead of spec's 6 — documented,
  behavior identical. Interaction convention (Shapley allocates it; isolated view
  shows diagnostic) preserved per index rule — zeroing it would break the isolated
  waterfall the UI already renders.
- Preserved deviations (index rule — documented, not rewritten): flat response shape
  (no nested plant/period objects — frontend maps flat keys); short cause IDs
  (frontend drawer/evidence/classification match on them; display labels unchanged);
  `external` code value (UI shows "Outside operator control" via CLASS_TEXT);
  GET query-param analysis/validation routes (frontend `getJSON` calls them).
- Request validation: scenario/period rejected 400; tariff/seed fixed server-side
  (not user-settable) so NaN/Inf/path rules are N/A by construction.

### Commands run + results
- `python tests/run_tests.py` → **14/14 PASS**.

### Known issues / next action
- Next: `04_DATA_AND_SYNTHETIC_SCENARIOS.md` (schema/seeds/physics-policy check).

---

## Phase 2 — 02_REPOSITORY_AUDIT_AND_EXECUTION.md (audit output + contract/fixture tests)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `engine/tests/test_contract.py` — NEW: Phase-1 contract tests (schema, enums,
    signs, serialized reconciliation over all 54 static JSONs, unexplained always
    present).
  - `engine/tests/run_tests.py` — discovers `test_engine` + `test_contract`.
  - `02_REPOSITORY_AUDIT_AND_EXECUTION.md` — tracked (was untracked).

### Required audit output (02 Phase 0 — actual, not assumed)
- Current architecture: modular monolith. `engine/vareng/` (physics, synth,
  attribution, validation, narrative, contract) + `engine/api.py` (Starlette,
  4 GET routes, static mount) + `frontend/` (vanilla JS/CSS/SVG, prebuilt JSONs).
  No DB; scenario config + time series generated deterministically on demand and
  snapshotted to `frontend/data/*.json`. Backend suggested layout in 02 adapted to
  existing `engine/` convention (no second app structure created).
- Frontend entry/components: single page, 4 tabs; `#scen` scenario buttons,
  `#periods` FY+12 month buttons; KPI cards; SVG waterfall w/ 90% whiskers;
  evidence drawer; classification columns; validation table; printable report.
- Backend entry/endpoints: `engine/api.py:app`; `GET /api/health|/scenarios|/analysis
  |/validation` (+ `/` static). Cached `build_world`/`analyze` (lru_cache).
- Chart library/design system: none installed — hand-drawn SVG; tokens in
  `frontend/style.css :root`. Nothing to preserve-or-replace beyond leaving it alone.
- Files proposed to add/change (rest of sequence): additive API fields/routes (03/07),
  API tests (09), `.env.example` (11) — all without touching UI design.
- Files explicitly protected from redesign: `frontend/index.html`, `frontend/app.js`,
  `frontend/style.css` (visual diff = bug unless additive functional affordance).
- Dependency gaps + rationale: FastAPI/pvlib absent (sandbox could not install;
  Starlette+numpy used, single swappable physics module, documented in README).
  No pytest (stdlib runner `run_tests.py` kept); no new libraries added this phase.
- Risks/questions: (1) engine+truth share one physics model — validation proves
  attribution/noise robustness, not physics error (disclosed in UI); (2) irradiance
  vs model-bias weakest separation (bands show it); (3) no frontend test harness
  (vanilla, no package.json) — E2E stays manual via runbook (12).

### Phase 1–8 conformance (verified, not assumed)
- Pydantic schemas + reconciled fixtures + contract tests: DONE this phase
  (`contract.py` + 54 static JSONs as fixtures + 4 new contract tests).
- Deterministic seeded series, pure `simulate()`, physics separate from API: DONE.
- 128 coalitions cached per analysis; interaction convention documented (Shapley
  allocates interaction; isolated+interaction view separate); residual documented;
  order-independence + exact-reconciliation tests: DONE.
- Seeded MC intervals, weather percentile vs 30 synthetic years, classification/
  evidence rules, zero LLM numerics: DONE (see 05/06 for detail).
- API validation/errors/CORS + endpoint tests: PARTIAL — 400 on bad input exists,
  CORS/env-config + route tests deferred to 07/09/11 and recorded there.
- Frontend: API client in existing convention + same-object report: DONE; explicit
  fixture-fallback label + API-outage retry UI: deferred to 08.
- Validation metrics machine-readable; report from same analysis object: DONE.

### Commands run + results
- `python tests/run_tests.py` → **14/14 PASS** (10 engine + 4 contract, the latter
  covering all 54 `frontend/data/*.json` fixtures).

### Git hygiene
- Direct on `main` (repo has no feature-branch workflow; single-demo repo).
- No user data deleted; no new dependencies; every changed file recorded here.

### Known issues / next action
- Next: `03_ARCHITECTURE_AND_DATA_CONTRACT.md` (canonical equation, enums, evidence
  contract conformance).

---

## Phase 1 — 01_SCOPE_AND_AGENT_RULES.md (scope conformance)

- Date/time (UTC): 2026-10-14
- Files changed:
  - `engine/vareng/synth.py` — added `s0` Baseline scenario (the required
    baseline/operational/curtailment trio was missing its near-closed baseline).
  - `engine/vareng/attribution.py` — `_sequential` reuses `_core` phi (no double
    Shapley compute) and rounds informational demo floats to canonical 3-decimal
    precision per 03 §4 (byte-stable static builds).
  - `engine/tests/test_engine.py` — added `test_same_seed_deterministic` (01 DoD)
    and `test_baseline_near_closed`.
  - `frontend/data/` — 14 new `s0_*` JSONs + regenerated `scenarios.json`;
    recommitted s1–s3 JSONs (only change: `sequential_demo` rounding; all canonical
    numbers bit-identical, UI displays at 0.1 MWh so no visible change).
  - `01_SCOPE_AND_AGENT_RULES.md` — tracked (was untracked).

### Must-implement verification (all checked against code, none assumed)
- [x] 30 MWp synthetic plant (`Plant.pdc0_kw=30_000`, dataclass-configurable).
- [x] 12-month FY + scenarios: **added s0 Baseline** (gap +0.17% FY, unexplained
  −2.5 MWh within band, hidden truth 0, `below_detection_floor=true`); s1 =
  operational underperformance; s2 = curtailment-heavy; s3 = hidden-cause demo.
- [x] Forecast/actual/gap/tariff ₹2.70/INR impact in every analysis object.
- [x] Six cause areas covered (7 switches: soiling/degradation split with documented
  controllable-vs-predictable rationale; deviation preserved per index rule).
- [x] Shapley attribution (2^7=128 coalitions), interaction line, explicit unexplained.
- [x] Monte Carlo bands (80 runs, documented perturbations).
- [x] Classification/evidence/confidence/weather percentile; Pydantic contract
  (Starlette, not FastAPI — preserved convention, documented).
- [x] Validation endpoint+page; printable investor report; 8→10 tests.
- [x] Out-of-scope absent: grepped engine+frontend for auth/chatbot/login/settlement-
  engine/role-views/mobile/ML/SCADA-integration — only legitimate user-facing words
  ("settlement meter", "real SCADA data") found, no such features.
- [x] Demo disclosure: SYNTHETIC DATA badge/footer/flags/report; curtailment wording
  "Potentially claimable — contract review required", never a legal conclusion.

### Frontend baseline capture (§4, before any edits — none made to UI)
- Routes: single `frontend/index.html`, 4 tabs (Analysis/Classification/Validation/
  Investor report), no router. No `package.json`/bundler (vanilla JS+CSS, no
  dependencies to churn). Tokens: `frontend/style.css` `:root` vars (no global change).
  Charts: hand-drawn SVG in `app.js` (no chart library to replace). No screenshots
  (no browser tooling in sandbox); textual baseline above serves as record.

### Commands run + results
- `python tests/run_tests.py` → **10/10 PASS** (8 existing + determinism + baseline).
- `python build_static.py` → s0 20.8s, s1 20.0s, s2 26.3s, s3 21.1s; s1–s3 canonical
  numbers verified bit-identical to committed files (deep JSON walk: only intended
  `sequential_demo` rounding differs).
- Determinism proof: two `analyze(w,'FY',n_mc=4)` runs equal on gap/components/
  unexplained/narrative; rebuilds byte-stable.

### Assumptions / deviations (preserved per index rule, not rewritten)
- 7 switches vs six (split documented in README); Starlette vs FastAPI; numpy physics
  vs pvlib (single swappable module); interaction shown in isolated view only.
- Baseline monthly gaps swing with weather (e.g. Aug +20% on seed-44 monsoon draw);
  the "near-closed" claim is FY-level (+0.17%), which is what the scenario is for.

### Known issues / next action
- None blocking. Next: `02_REPOSITORY_AUDIT_AND_EXECUTION.md` (Phase 1 contract/
  fixture requirements vs existing `contract.py` + static JSONs).

---

## Phase 0 — README_IMPLEMENTATION_INDEX.md (master plan intake + repo audit)

- Date/time (UTC): 2026-10-14
- Files changed: NONE (audit-only phase; zero code changes — frontend preserved exactly).
  Tracked in git this phase: `README_IMPLEMENTATION_INDEX.md` (was untracked) + this log.

### MD files inspected (root)
1. `README_IMPLEMENTATION_INDEX.md` (91 lines, untracked until this phase) — master
   execution contract. Non-negotiable constraint: preserve frontend exactly; build
   backend/engine and connect with smallest integration changes. References docs
   `01_SCOPE_AND_AGENT_RULES.md` … `12_DEMO_RUNBOOK_AND_CUT_LINES.md`.
2. `README.md` (41 lines) — claims engine/frontend/tests already built; lists status
   vs plan doc + upfront deviations (Starlette-not-FastAPI, numpy-not-pvlib, 7 switches).
3. `docs/METHOD.md` (8 lines) — 7-step method: forecast sim, measured-state calibration,
   2^7 Shapley, U = metered − simulated, 80-run MC band, luck/controllable/predictable/
   external classes, 8-switch truth validation.

### Gap: referenced 01–12 docs do NOT exist in repo
- Searched `**/*.md` — only the 3 files above found. The 12 numbered files listed under
  "Read these files in order" are missing. Proceeding per index-file rule: "If the repo
  conflicts with a recommendation in these docs, preserve existing working conventions
  and document the deviation." Existing `README.md` + `docs/METHOD.md` + code are the
  working convention; no broad rewrite undertaken.

### Repository audit (no assumptions — inspected before editing)
- Frontend entry points (UNCHANGED, intact):
  - `frontend/index.html` — 4 tabs (Analysis/Classification/Validation/Investor report),
    `#scen`, `#periods`, SYNTHETIC DATA badge, footer tariff/legal disclaimer.
  - `frontend/app.js` (vanilla JS, no deps) — probes `api/health`, falls back to static
    `data/<scenario>_<period>.json` + `<scenario>_validation.json`; renders waterfall
    (Shapley/isolated toggle), evidence drawer, classification, validation, printable report.
  - `frontend/style.css` — design system (no global CSS change made).
  - `frontend/data/` — 40 pre-built JSONs (3 scenarios × FY+12 months + 3 validation +
    scenarios.json); static-host compatible.
- API assumptions (verified in `engine/api.py`, Starlette):
  - `GET /api/health`, `/api/scenarios`, `/api/analysis?scenario=&period=`,
    `/api/validation?scenario=`; `/` mounts static frontend. Pydantic `Analysis` contract
    in `engine/vareng/contract.py`.
- Engine (verified, built before UI wiring per plan):
  - `vareng/physics.py` (self-contained numpy PV model, pvlib swap notes),
    `synth.py` (3 scenarios, truth vs measured, 30-yr synthetic history),
    `attribution.py` (128 coalitions, Shapley, integer milli-kWh close, 80-run MC),
    `validation.py` (8-switch truth, hidden→unexplained), `narrative.py` (number-checked
    template), `contract.py`. Version `vareng-0.1.0`.
  - `engine/build_static.py` regenerates `frontend/data/*.json`; `engine/tests/`
    (`run_tests.py` + `test_engine.py`, 8 tests).

### Guardrails verification (read from code, not assumed)
- [x] Frontend untouched this phase (`git status` clean except the 2 log/plan files).
- [x] Every displayed number from deterministic engine/API or labelled illustrative —
      narrative passes `check_numbers` (test covers it).
- [x] "Synthetic demo data" labelling: header badge, footer, `data_quality_flags`, report.
- [x] No legal claim: "Potentially claimable — contract review required" in code + footer.
- [x] Unexplained is explicit residual (`U = measured − simulated`, milli-kWh `closes:true`);
      never spread across causes (test asserts exact close every scenario/period).

### Commands run + results
- `python tests/run_tests.py` (from `engine/`) → 8/8 PASS:
  `test_hidden_cause_not_misassigned_when_large`, `test_narrative_numbers_match_engine`,
  `test_no_hidden_cause_means_small_unexplained`, `test_order_independence`,
  `test_physics_sane`, `test_reconciliation_closes_exactly_every_scenario_and_period`,
  `test_shapley_efficiency_and_additivity_toy`, `test_unexplained_independent_definition`.
- `Get-ChildItem frontend/data` → 40 JSONs present. `pip deps` (numpy/pandas/starlette/
  pydantic/uvicorn) import OK.

### Assumptions / deviations
- Preserve-existing-conventions deviation recorded: FastAPI→Starlette, pvlib→numpy module
  (per `README.md`; sandbox could not install them). Physics isolated to one swappable file.
- 7 switches (soiling/degradation split) vs plan's "six cause switches" — recorded in README.
- Engine and truth share one physics model: validation tests attribution + noise robustness,
  not physics error (stated in UI + validation output).

### Known issues / next action
- 12 numbered plan docs (01–12) absent — if they appear, re-check scope against them.
- Next: pick up next MD file in user's one-at-a-time sequence (`README.md` run/contract
  verification, then `docs/METHOD.md` method-vs-code check) — awaiting user confirm before
  editing anything.
