"""Starlette API + static frontend.  Run:  uvicorn api:app --port 8000   (from the engine/ folder)
FastAPI is a thin layer over Starlette; swapping is a 10-line change if you prefer auto-docs."""
import os, functools
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from vareng.synth import build_world, SCENARIOS, MONTHS
from vareng.attribution import analyze
from vareng.validation import validate
from vareng.contract import Analysis

@functools.lru_cache(maxsize=8)
def world(key): return build_world(key)
@functools.lru_cache(maxsize=64)
def analysis(key, period): return analyze(world(key), period)

async def health(request): return JSONResponse({"ok": True})
async def scenarios(request):
    return JSONResponse({"scenarios": [{"key": k, "name": s.name, "blurb": s.blurb} for k, s in SCENARIOS.items()], "months": MONTHS})
async def analysis_ep(request):
    key = request.query_params.get("scenario", "s1"); period = request.query_params.get("period", "FY")
    if key not in SCENARIOS or (period != "FY" and period not in MONTHS):
        return JSONResponse({"error": "unknown scenario or period"}, status_code=400)
    return JSONResponse(Analysis(**analysis(key, period)).model_dump() | {k: v for k, v in analysis(key, period).items() if k not in Analysis.model_fields})
async def validation_ep(request):
    key = request.query_params.get("scenario", "s1")
    if key not in SCENARIOS: return JSONResponse({"error": "unknown scenario"}, status_code=400)
    return JSONResponse(validate(world(key), analysis(key, "FY")))

FRONT = os.path.join(os.path.dirname(__file__), "..", "frontend")
app = Starlette(routes=[Route("/api/health", health), Route("/api/scenarios", scenarios),
                        Route("/api/analysis", analysis_ep), Route("/api/validation", validation_ep),
                        Mount("/", StaticFiles(directory=FRONT, html=True))])
