# IMPLEMENTATION_LOG.md

Per `README_IMPLEMENTATION_INDEX.md` execution rules: record phase, date/time,
files changed, commands run, tests/results, assumptions/deviations, known issues
and next action after each phase.

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
