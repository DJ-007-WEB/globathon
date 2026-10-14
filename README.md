# Variance Explainer – Globathon PS 3 prototype

Explains why a solar plant missed its forecast: named causes (kWh and ₹), an explicit **unexplained** bucket with a
90% band, a predictable / controllable / luck / external verdict, and **validation against injected ground truth**.
**All data is synthetic** (30 MWp plant, Rajasthan-like weather, FY 2025-26). Tariff ₹2.70/kWh is an assumption.

## Run (2 minutes)
```bash
pip install -r requirements.txt
cd engine
python build_static.py                 # optional: regenerates frontend/data/*.json (~25 s)
python -m uvicorn api:app --port 8000 # open http://localhost:8000
python tests/run_tests.py             # 8 tests incl. exact reconciliation
```
No server? Frontend works from any static host (`frontend/`, e.g. Vercel) because results are pre-built in `frontend/data/`.
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
`engine/tests` · `frontend/` (no dependencies) · `sample_reports/` · `docs/METHOD.md`
