# IMPLEMENTATION_LOG.md

Per `README_IMPLEMENTATION_INDEX.md` execution rules: record phase, date/time,
files changed, commands run, tests/results, assumptions/deviations, known issues
and next action after each phase.

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
