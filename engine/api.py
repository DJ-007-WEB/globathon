"""Starlette API + static frontend.  Run:  uvicorn api:app --port 8000   (from the engine/ folder)
FastAPI is a thin layer over Starlette; swapping is a 10-line change if you prefer auto-docs.
Existing GET routes return their historical shapes (the frontend maps them directly).
"""
import html
import logging
import os
import time
import uuid
import functools
from pydantic import BaseModel, field_validator
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from vareng.synth import build_world, SCENARIOS, MONTHS, TARIFF_INR_PER_KWH
from vareng.attribution import analyze
from vareng.validation import validate
from vareng.contract import Analysis

log = logging.getLogger("variance-engine")

def _env_config():
    """Validate startup config with clear messages (11 §2); never log secrets."""
    try:
        max_mc = int(os.environ.get("MAX_MONTE_CARLO_SAMPLES", "200"))
    except ValueError:
        raise RuntimeError("Invalid MAX_MONTE_CARLO_SAMPLES: must be an integer >= 1.")
    if max_mc < 1:
        raise RuntimeError("Invalid MAX_MONTE_CARLO_SAMPLES: must be >= 1.")
    try:
        tariff = float(os.environ.get("DEFAULT_TARIFF_INR_PER_KWH", str(TARIFF_INR_PER_KWH)))
    except ValueError:
        raise RuntimeError("Invalid DEFAULT_TARIFF_INR_PER_KWH: must be a number in [0, 100].")
    if not (tariff == tariff and 0 <= tariff <= 100):
        raise RuntimeError("Invalid DEFAULT_TARIFF_INR_PER_KWH: must be finite and in [0, 100].")
    origins = [o.strip() for o in os.environ.get("FRONTEND_ORIGINS", "*").split(",") if o.strip()]
    if not origins:
        raise RuntimeError("Invalid FRONTEND_ORIGINS: provide at least one origin or '*'.")
    return max_mc, tariff, origins


MAX_MC, DEFAULT_TARIFF, ORIGINS = _env_config()

SERVICE = "variance-engine"


def _rid() -> str:
    return uuid.uuid4().hex[:8]


def _err(request_id: str, code: str, message: str, details=None, status: int = 400):
    body = {"success": False, "error": {"code": code, "message": message,
                                        "details": details or [], "request_id": request_id}}
    return JSONResponse(body, status_code=status, headers={"X-Request-ID": request_id})


@functools.lru_cache(maxsize=8)
def world(key): return build_world(key)
@functools.lru_cache(maxsize=64)
def analysis(key, period): return analyze(world(key), period)


# ---------------------------------------------------------------- request models
class AnalysisRequest(BaseModel):
    scenario_id: str
    period: str = "FY"
    tariff_inr_per_kwh: float = DEFAULT_TARIFF
    seed: int = 123
    n_mc_samples: int = 80

    @field_validator("scenario_id")
    @classmethod
    def _known_scenario(cls, v):
        if v not in SCENARIOS:
            raise ValueError(f"unknown scenario_id: {v}")
        return v

    @field_validator("period")
    @classmethod
    def _known_period(cls, v):
        if v != "FY" and v not in MONTHS:
            raise ValueError(f"unknown period: {v}")
        return v

    @field_validator("tariff_inr_per_kwh")
    @classmethod
    def _tariff_range(cls, v):
        if not (v == v and v not in (float("inf"), float("-inf")) and 0 <= v <= 100):
            raise ValueError("tariff_inr_per_kwh must be finite and in [0, 100]")
        return v

    @field_validator("seed")
    @classmethod
    def _seed_range(cls, v):
        if isinstance(v, bool) or not -2**31 <= v <= 2**31 - 1:
            raise ValueError("seed must be an integer in int32 range")
        return v

    @field_validator("n_mc_samples")
    @classmethod
    def _mc_range(cls, v):
        if isinstance(v, bool) or not 1 <= v <= MAX_MC:
            raise ValueError(f"n_mc_samples must be an integer in [1, {MAX_MC}]")
        return v


class ValidationRequest(BaseModel):
    scenario_id: str
    seed: int = 123

    @field_validator("scenario_id")
    @classmethod
    def _known_scenario(cls, v):
        if v not in SCENARIOS:
            raise ValueError(f"unknown scenario_id: {v}")
        return v

    @field_validator("seed")
    @classmethod
    def _seed_range(cls, v):
        if isinstance(v, bool) or not -2**31 <= v <= 2**31 - 1:
            raise ValueError("seed must be an integer in int32 range")
        return v


class ReportRequest(BaseModel):
    scenario_id: str
    period: str = "FY"

    @field_validator("scenario_id")
    @classmethod
    def _known_scenario(cls, v):
        if v not in SCENARIOS:
            raise ValueError(f"unknown scenario_id: {v}")
        return v

    @field_validator("period")
    @classmethod
    def _known_period(cls, v):
        if v != "FY" and v not in MONTHS:
            raise ValueError(f"unknown period: {v}")
        return v


# ---------------------------------------------------------------- handlers
async def health(request):
    """GET /api/health — liveness probe (07 success envelope)."""
    return JSONResponse({"success": True, "data": {"status": "ok", "service": SERVICE}})


async def scenarios(request):
    """GET /api/scenarios — scenario registry (historical shape: frontend-mapped)."""
    return JSONResponse({"scenarios": [{"key": k, "name": s.name, "blurb": s.blurb} for k, s in SCENARIOS.items()], "months": MONTHS})


async def scenario_detail(request):
    """GET /api/scenarios/{scenario_id} — metadata + data-quality assumptions."""
    key = request.path_params["scenario_id"]
    if key not in SCENARIOS:
        return _err(_rid(), "UNKNOWN_SCENARIO", f"Unknown scenario: {key}.",
                    [{"field": "scenario_id", "reason": "must exist in the scenario registry"}], 404)
    w = world(key)
    s = SCENARIOS[key]
    return JSONResponse({"key": key, "name": s.name, "blurb": s.blurb, "months": MONTHS,
                         "data_disclosure": "Synthetic demo data",
                         "data_quality_flags": w.flags,
                         "hidden_cause_note": "A hidden unlogged loss may be present; see validation."})


async def analysis_ep(request):
    """GET /api/analysis — historical shape (frontend-mapped)."""
    key = request.query_params.get("scenario", "s1"); period = request.query_params.get("period", "FY")
    if key not in SCENARIOS or (period != "FY" and period not in MONTHS):
        return JSONResponse({"error": "unknown scenario or period"}, status_code=400)
    return JSONResponse(Analysis(**analysis(key, period)).model_dump() | {k: v for k, v in analysis(key, period).items() if k not in Analysis.model_fields})


async def validation_ep(request):
    """GET /api/validation — historical shape (frontend-mapped)."""
    key = request.query_params.get("scenario", "s1")
    if key not in SCENARIOS: return JSONResponse({"error": "unknown scenario"}, status_code=400)
    return JSONResponse(validate(world(key), analysis(key, "FY")))


def _analysis_from_model(m: AnalysisRequest) -> dict:
    return _post_analysis_cached(m.scenario_id, m.period, m.tariff_inr_per_kwh, m.seed, m.n_mc_samples)


@functools.lru_cache(maxsize=32)
def _post_analysis_cached(scenario_id: str, period: str, tariff: float, seed: int, n_mc: int) -> dict:
    """Bounded cache for repeat POST analyses (JSON-serialised on send, never mutated)."""
    return analyze(world(scenario_id), period, n_mc=n_mc, seed=seed, tariff=tariff)


async def post_analysis(request: Request):
    """POST /api/analysis — validated analysis run (same contract object as GET)."""
    rid = _rid(); t = time.time()
    body = await request.json()
    if isinstance(body, dict) and "scenario_id" in body and body["scenario_id"] not in SCENARIOS:
        return _err(rid, "UNKNOWN_SCENARIO", f"Unknown scenario: {body.get('scenario_id')}.",
                    [{"field": "scenario_id", "reason": "must exist in the scenario registry"}], 404)
    try:
        m = AnalysisRequest(**body)
    except Exception as e:
        return _err(rid, "INVALID_ANALYSIS_REQUEST", "The analysis request is invalid.",
                    [{"field": ".", "reason": str(e).splitlines()[0][:200]}], 422)
    try:
        out = _analysis_from_model(m)
    except Exception:
        log.exception("analysis failed rid=%s scenario=%s period=%s", rid, m.scenario_id, m.period)
        return _err(rid, "ANALYSIS_FAILED", "Analysis failed for the validated request.", [], 500)
    log.info("rid=%s POST /api/analysis scenario=%s period=%s seed=%s n_mc=%s %.1fs",
             rid, m.scenario_id, m.period, m.seed, m.n_mc_samples, time.time() - t)
    return JSONResponse(out, headers={"X-Request-ID": rid})


async def post_validation_run(request: Request):
    """POST /api/validation/run — injected truth vs recovered attribution."""
    rid = _rid(); t = time.time()
    body = await request.json()
    if isinstance(body, dict) and "scenario_id" in body and body["scenario_id"] not in SCENARIOS:
        return _err(rid, "UNKNOWN_SCENARIO", f"Unknown scenario: {body.get('scenario_id')}.",
                    [{"field": "scenario_id", "reason": "must exist in the scenario registry"}], 404)
    try:
        m = ValidationRequest(**body)
    except Exception as e:
        return _err(rid, "INVALID_VALIDATION_REQUEST", "The validation request is invalid.",
                    [{"field": ".", "reason": str(e).splitlines()[0][:200]}], 422)
    try:
        a = analyze(world(m.scenario_id), "FY", seed=m.seed)
        out = validate(world(m.scenario_id), a)
    except Exception:
        log.exception("validation failed rid=%s scenario=%s", rid, m.scenario_id)
        return _err(rid, "VALIDATION_FAILED", "Validation failed for the validated request.", [], 500)
    log.info("rid=%s POST /api/validation/run scenario=%s %.1fs", rid, m.scenario_id, time.time() - t)
    return JSONResponse(out, headers={"X-Request-ID": rid})


def _report_html(a: dict, v: dict) -> str:
    e = html.escape
    rows = "".join(
        f"<tr><td>{e(c['cause'])}{' (potentially claimable)' if c['claimable'] else ''}</td>"
        f"<td>{e(c['class_label'])}</td><td>{c['kwh']/1000:,.1f}</td><td>{c['inr']/1e5:,.1f}</td>"
        f"<td>{c['lower_kwh']/1000:,.0f} to {c['upper_kwh']/1000:,.0f}</td><td>{e(c['confidence'])}</td></tr>"
        for c in a["components"] if c["present"])
    u = a["unexplained"]
    w = a["weather"]
    ev = "".join(
        f"<p class=\"note\"><b>{e(x['title'])}</b> — {e(x['window'])} · {e(x['signal'])}"
        f"{(' · %+.1f MWh' % (x['kwh']/1000)) if x['kwh'] is not None else ''}<br>{e(x['detail'])}</p>"
        for x in a["evidence"])
    pct = "" if u["pct_of_gap"] is None else f" It is {u['pct_of_gap']:.1f}% of the total gap."
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>Investor variance report — {e(a['period_label'])}</title>
<style>body{{font:14px/1.5 system-ui,sans-serif;max-width:900px;margin:32px auto;padding:0 16px}}table{{border-collapse:collapse;width:100%}}th,td{{border-bottom:1px solid #ddd;padding:6px 8px;text-align:right}}th:first-child,td:first-child{{text-align:left}}.note{{color:#555;font-size:12.5px}}@media print{{.noprint{{display:none}}}}</style>
</head><body><div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
<h1>Investor variance report</h1>
<p class="note">{e(a['plant_name'])} · {e(a['period_label'])} · model {e(a['model_version'])} · <b>SYNTHETIC DATA</b></p>
<h2>Summary</h2><p>{e(a['narrative']['text'])}</p>
<h2>Headline</h2><p>Forecast {a['forecast_kwh']/1000:,.0f} MWh · Actual {a['actual_kwh']/1000:,.0f} MWh · Gap {a['gap_kwh']/1000:,.1f} MWh ({a['gap_pct']:.1f}%) · {a['gap_inr']/1e5:,.1f} lakh INR at ₹{a['tariff_inr_per_kwh']}/kWh (assumed tariff).</p>
<h2>Causes</h2><table><tr><th>Cause</th><th>Class</th><th>MWh</th><th>₹ lakh</th><th>90% band (MWh)</th><th>Confidence</th></tr>{rows}
<tr><td>Interaction (non-additive diagnostic)</td><td>–</td><td>{a['interaction']['kwh']/1000:,.1f}</td><td>{a['interaction']['inr']/1e5:,.1f}</td><td>–</td><td>–</td></tr>
<tr><td><b>Unexplained</b></td><td>–</td><td><b>{u['kwh']/1000:,.1f}</b></td><td>{u['inr']/1e5:,.1f}</td><td>{u['lower_kwh']/1000:,.0f} to {u['upper_kwh']/1000:,.0f}</td><td>{e(u['confidence'])}</td></tr>
<tr><td><b>Total gap</b></td><td></td><td><b>{a['gap_kwh']/1000:,.1f}</b></td><td>{a['gap_inr']/1e5:,.1f}</td><td></td><td></td></tr></table>
<p class="note">{e(a['interaction']['note'])}</p>
<h2>Unexplained</h2><p>{e(u['message'])}{e(pct)}</p><p class="note">Data that would reduce it: {e('; '.join(u['data_that_would_reduce_it']))}.</p>
<h2>Weather</h2><p>Irradiance percentile <b>{w['percentile']:.0f}</b> of {w['history_years']} synthetic years (reanalysis stand-in; licence pending): {e(w['statement'])}. Typical year {w['typical_year_kwh_m2']:,.0f} kWh/m² ({w['delta_pct']:.1f}%). Mean temperature {w['temperature_c']:.1f} °C (percentile {w['temperature_percentile']:.0f}).</p>
<h2>Evidence</h2>{ev}
<h2>Method and caveats</h2><p class="note">Order-independent (Shapley) attribution over a 7-switch plant simulator; unexplained = metered − simulated; 90% bands from {a['monte_carlo']['samples']} Monte Carlo runs. {' '.join(e(f) for f in a['data_quality_flags'])} Curtailment flags are not legal conclusions. Validation: {v['summary']['named_recovered']}/{v['summary']['named_causes_material']} named causes recovered; hidden cause {'in unexplained ✓' if v['hidden']['landed_in_unexplained'] else 'below detection floor' if v['hidden']['below_detection_floor'] else 'missed'}; reconciliation {'closes ✓' if v['summary']['reconciliation_closes'] else 'FAILS'}.</p>
</body></html>"""


async def post_report(request: Request):
    """POST /api/reports/variance — print-ready HTML rebuilt from a validated request
    (never trusts client-submitted figures; the 10 §2 PDF is a deliberate cut line)."""
    rid = _rid(); t = time.time()
    body = await request.json()
    if isinstance(body, dict) and "scenario_id" in body and body["scenario_id"] not in SCENARIOS:
        return _err(rid, "UNKNOWN_SCENARIO", f"Unknown scenario: {body.get('scenario_id')}.",
                    [{"field": "scenario_id", "reason": "must exist in the scenario registry"}], 404)
    try:
        m = ReportRequest(**body)
    except Exception as e:
        return _err(rid, "INVALID_REPORT_REQUEST", "The report request is invalid.",
                    [{"field": ".", "reason": str(e).splitlines()[0][:200]}], 422)
    try:
        a = analyze(world(m.scenario_id), m.period)
        page = _report_html(a, validate(world(m.scenario_id), a if m.period == "FY" else analyze(world(m.scenario_id), "FY")))
    except Exception:
        log.exception("report failed rid=%s scenario=%s period=%s", rid, m.scenario_id, m.period)
        return _err(rid, "REPORT_FAILED", "Report generation failed.", [], 500)
    log.info("rid=%s POST /api/reports/variance scenario=%s period=%s %.1fs",
             rid, m.scenario_id, m.period, time.time() - t)
    return Response(page, media_type="text/html; charset=utf-8", headers={"X-Request-ID": rid})


async def _not_found(request, exc):
    return _err(_rid(), "NOT_FOUND", "No such route.", [{"field": "path", "reason": request.url.path}], 404)


async def _server_error(request, exc):
    log.exception("unhandled error %s", request.url.path)
    return _err(_rid(), "INTERNAL_ERROR", "An unexpected error occurred.", [], 500)


FRONT = os.path.join(os.path.dirname(__file__), "..", "frontend")
middleware = [Middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET", "POST", "OPTIONS"],
                        allow_headers=["*"])]
app = Starlette(middleware=middleware,
                exception_handlers={404: _not_found, 500: _server_error},
                routes=[Route("/api/health", health), Route("/api/scenarios", scenarios),
                        Route("/api/scenarios/{scenario_id}", scenario_detail),
                        Route("/api/analysis", analysis_ep, methods=["GET"]),
                        Route("/api/analysis", post_analysis, methods=["POST"]),
                        Route("/api/validation", validation_ep, methods=["GET"]),
                        Route("/api/validation/run", post_validation_run, methods=["POST"]),
                        Route("/api/reports/variance", post_report, methods=["POST"]),
                        Mount("/", StaticFiles(directory=FRONT, html=True))])
