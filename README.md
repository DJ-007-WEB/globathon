# Variance Explainer – Globathon PS 3 prototype

Explains why a solar plant missed its forecast: named causes (kWh and ₹), an explicit **unexplained** bucket with a
90% band, a predictable / controllable / luck / external verdict, and **validation against injected ground truth**.
**All data is synthetic** (30 MWp plant, Rajasthan-like weather, FY 2025-26). Tariff ₹2.70/kWh is an assumption.

## Run (2 minutes)
```bash
pip install -r requirements.txt
cd engine
cd frontend-react && npm install && npm run build   # builds React frontend to frontend-react/dist/
python -m uvicorn api:app --port 8000 # open http://localhost:8000
python tests/run_tests.py             # 8 tests incl. exact reconciliation
```
No server? The built React frontend works from any static host (`frontend-react/dist/`) because results are pre-built in `frontend-react/dist/data/`.
Investor PDF: open the *Investor report* tab → Print / Save as PDF (sample in `sample_reports/`).

## Configuration (optional)

Only three env vars exist (see `.env.example`); all have safe defaults so `uvicorn api:app`
runs with no setup. No secrets or credentials are required — the prototype is fully synthetic.

```bash
FRONTEND_ORIGINS=*             # CORS allow-list for the API (comma-separated)
MAX_MONTE_CARLO_SAMPLES=200    # upper bound for POST /api/analysis n_mc_samples
DEFAULT_TARIFF_INR_PER_KWH=2.7 # assumed tariff (per-request override is validated)
```

## Deployment (single service, nothing local)

`render.yaml` is a Render blueprint: one web service installs `requirements.txt` and runs
`uvicorn api:app --app-dir engine`, serving the API **and** the static frontend on one URL.

1. Push `main` to GitHub (done) → Render dashboard → New → Blueprint → select this repo.
2. Render reads `render.yaml` (build/start/health check `/api/health`/env vars) → Deploy.
3. Open the service URL: landing → Start the demo. Health: `<url>/api/health`.

Notes: free-tier instances sleep when idle (first load wakes ~1 min, then cached);
`engine/tests/run_tests.py` (42 tests) is the pre-deploy gate. Split hosting also works —
frontend is dependency-free static files, and the app accepts `?api=https://your-api`
once (remembered) while `data/*.json` snapshots stay same-origin.

## What is built (vs the plan doc)
| Doc item | Status |
|---|---|
| Plant simulator, switchable causes | Done – 7 switches (soiling and degradation split, because one is controllable and one predictable) |
| Synthetic data, injected + hidden causes | Done – 3 scenarios, truth vs measured (noisy sensors, gap-filled irradiance, soiling station, meter) |
| Shapley attribution, interaction, unexplained | Done – 128 coalitions; Σcauses + unexplained = gap exactly (integer milli-kWh); isolated+interaction view too |
| Monte Carlo bands, confidence rules | Done – 80 runs; derate recalibrated every run; rules written in UI |
| Weather percentile (luck vs extreme) | Done – vs 30 synthetic years (stand-in for ERA5; licence check pending) |
| Evidence drawer, claimable flag | Done |
| Validation page | Done – shows misses honestly |
| Investor report | Done as printable page + number-checked narrative |
| Narrative layer | Template-based with number checker; Claude API rephrasing not wired (needs key) |

## Deviations (be upfront with judges)
* **pvlib / FastAPI not used** – the build sandbox could not install them. Physics is a self-contained numpy module
  (`vareng/physics.py`, one file to swap for pvlib); API is Starlette (FastAPI's base) with a Pydantic contract.
* Shapley allocates all interaction to causes, so the "interaction" line is shown in the *isolated* view only.
* Engine and truth share one physics model: validation tests attribution logic and noise robustness, not physics error.
* A constant irradiance-sensor bias is absorbed into the calibrated model derate, so *irradiance* and *forecast model bias*
  are the weakest-separated causes (bands show it). A hidden loss that is tiny (Scenario 2, ~0.15% of forecast) is below the detection floor.

## Layout
`engine/vareng` physics, synth, attribution, validation, narrative, contract · `engine/api.py` · `engine/build_static.py`
`engine/tests` · `frontend-react/` (React + Vite) · `sample_reports/` · `docs/METHOD.md`

## Frontend demo additions (October 2026)

The frontend now uses the **SolarSleuth** solar-operations visual identity with responsive layouts and a light/dark theme toggle. It includes:

- A polished landing page and a plant overview dashboard using the existing precomputed scenario metadata and engine snapshots.
- A lightweight demo workspace access screen. Any non-empty name/email and password can enter; it stores only a demo label/session marker in browser local storage. **This is not production authentication and must not be used to protect real or sensitive data.**
- A deterministic, rule-based Variance Assistant with prepared answers grounded in the currently selected synthetic analysis. It does not call an external AI API and does not generate free-form model diagnoses.
- CSV import for a small, documented format: `month`, `forecast_kwh`, `actual_kwh`, with optional signed `weather_loss_kwh`, `downtime_loss_kwh`, and `curtailment_loss_kwh` cause contributions. The file is parsed and validated in the browser; summary totals are calculated from the uploaded rows. Missing cause columns remain unexplained. Uploaded CSV data is **not** passed into the scenario engine's hourly Shapley/Monte Carlo pipeline.
- A scenario-matched synthetic CSV download: the monthly forecast/actual values are derived from the currently selected scenario's precomputed monthly gap and percentage, so the imported gap trend corresponds to that scenario. Cause-level evidence is not fabricated.

The original deterministic engine, scenario snapshots, cause evidence, classification, validation, API contracts, and investor report flow are preserved. All built-in records remain synthetic. The backend test suite is run with:

```bash
cd engine
python tests/run_tests.py
```

## Demo walkthrough

1. Open the landing page and choose **Explore the live demo**.
2. Enter any non-empty demo credentials. No real account is created.
3. On Overview, switch between scenarios and periods; inspect the KPI cards and monthly variance signal.
4. Choose **Download template**, then upload that downloaded CSV. The app validates it and shows metrics computed from the imported rows.
5. Open **Variance analysis**, click a waterfall bar, and inspect the evidence drawer.
6. Open **Validation lab** to show the injected-vs-recovered comparison.
7. Open **Investor report** and use Print / Save as PDF.
8. Open **Ask the assistant** and ask a supported question such as “Why did production fall?”
9. Toggle light/dark mode to show both visual themes.

The optional external font stylesheet uses Google Fonts when online; the application itself does not require an AI API or live weather API for its demo flow.

## Demo login and data upload (demo build)
- Demo credentials: `demo@solarsleuth.app` / `Demo@1234`. Sign-up also works; accounts are stored (salted, hashed) in the browser's localStorage only. This is demo-only auth, not production security.
- **Data upload** tab: validates a monthly CSV in the browser (samples in `frontend-react/public/samples/`) and reconciles the gap from the columns provided. Uploaded data is not run through the simulator.
- Script for the video: `docs/DEMO_VIDEO_SCRIPT.md`.
