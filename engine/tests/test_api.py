"""Backend route tests (07 §6 + 09 integration layer).

Uses Starlette's TestClient (httpx is installed). Live engine runs use small
Monte Carlo counts to keep the suite fast; canonical reconciliation is asserted
on real outputs. Run:  python tests/run_tests.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from starlette.testclient import TestClient
import api
from vareng.contract import Analysis, Component
from vareng.validation import validate

c = TestClient(api.app, raise_server_exceptions=False)

def test_health_envelope():
    r = c.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"success": True, "data": {"status": "ok", "service": "variance-engine"}}

def test_scenarios_and_detail():
    r = c.get("/api/scenarios")
    assert r.status_code == 200
    keys = {s["key"] for s in r.json()["scenarios"]}
    assert {"s0", "s1", "s2", "s3"} <= keys and len(r.json()["months"]) == 12
    r = c.get("/api/scenarios/s2")
    assert r.status_code == 200 and r.json()["key"] == "s2"
    assert "filesystem" not in str(r.json()).lower() and "C:\\" not in str(r.json())
    r = c.get("/api/scenarios/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "UNKNOWN_SCENARIO"
    assert "request_id" in r.json()["error"]

def test_get_analysis_compat_shape():
    r = c.get("/api/analysis", params={"scenario": "s0", "period": "FY"})
    assert r.status_code == 200
    Analysis(**r.json())  # schema-valid
    assert r.json()["reconciliation"]["closes"]
    r = c.get("/api/analysis", params={"scenario": "nope"})
    assert r.status_code == 400

def test_post_analysis_valid_and_reconciles_every_scenario():
    for key in ("s0", "s1", "s2", "s3"):
        r = c.post("/api/analysis", json={"scenario_id": key, "period": "FY", "n_mc_samples": 2})
        assert r.status_code == 200, (key, r.text[:200])
        a = r.json()
        Analysis(**a)
        tot = sum(round(x["kwh"]*1000) for x in a["components"]) + round(a["unexplained"]["kwh"]*1000)
        assert tot == round(a["gap_kwh"]*1000), key
        assert "X-Request-ID" in r.headers

def test_post_analysis_invalid_inputs():
    r = c.post("/api/analysis", json={"scenario_id": "nope", "period": "FY"})
    assert r.status_code == 404 and r.json()["error"]["code"] == "UNKNOWN_SCENARIO"
    for bad in ({"scenario_id": "s0", "tariff_inr_per_kwh": -1},
                {"scenario_id": "s0", "tariff_inr_per_kwh": "x"},
                {"scenario_id": "s0", "seed": 2**40},
                {"scenario_id": "s0", "period": "1999-01"},
                {"scenario_id": "s0", "n_mc_samples": 0},
                {"scenario_id": "s0", "n_mc_samples": 10**9},
                {"period": "FY"}):
        r = c.post("/api/analysis", json=bad)
        assert r.status_code == 422, (bad, r.status_code)
        body = r.json()
        assert body["success"] is False and body["error"]["code"] == "INVALID_ANALYSIS_REQUEST"
        assert "request_id" in body["error"]
        assert "Traceback" not in r.text  # no stack traces to clients

def test_post_analysis_tariff_flows_through():
    r = c.post("/api/analysis", json={"scenario_id": "s0", "period": "FY",
                                      "tariff_inr_per_kwh": 3.0, "n_mc_samples": 2})
    assert r.status_code == 200
    a = r.json()
    assert a["tariff_inr_per_kwh"] == 3.0
    comp = a["components"][0]
    assert abs(comp["inr"] - round(comp["kwh"]*3.0, 2)) < 1e-9

def test_validation_run_and_corruption_detected():
    r = c.post("/api/validation/run", json={"scenario_id": "s3"})
    assert r.status_code == 200
    v = r.json()
    assert v["hidden"]["landed_in_unexplained"] and v["summary"]["reconciliation_closes"]
    r = c.post("/api/validation/run", json={"scenario_id": "nope"})
    assert r.status_code == 404
    # deliberately corrupted recovered values must show up as errors, not success
    w = api.world("s3")
    good = api.analysis("s3", "FY")
    bad = dict(good, components=[dict(x, kwh=0.0) for x in good["components"]])
    vbad = validate(w, bad)
    assert any(abs(x["error_kwh"]) > 1000 for x in vbad["rows"])

def test_report_endpoint():
    r = c.post("/api/reports/variance", json={"scenario_id": "s1", "period": "FY"})
    assert r.status_code == 200 and r.text.strip()
    assert r.headers["content-type"].startswith("text/html")
    # 10 §1 content audit: all 12 items present in the server report
    for marker in ("Investor variance report", "SYNTHETIC DATA", "Forecast", "Actual",
                   "Interaction (non-additive diagnostic)", "Unexplained", "% of the total gap",
                   "Irradiance percentile", "Evidence", "Validation:", "Method and caveats",
                   "not legal conclusions"):
        assert marker in r.text, marker
    assert "nan" not in r.text.lower().replace("financing", "")  # no leaked NaNs
    assert "None" not in r.text  # conditional None-branches (pct, evidence kwh) render cleanly
    r = c.post("/api/reports/variance", json={"scenario_id": "s1", "period": "2025-08"})
    assert r.status_code == 200 and r.text.strip()
    r = c.post("/api/reports/variance", json={"scenario_id": "nope"})
    assert r.status_code == 404 and r.json()["error"]["code"] == "UNKNOWN_SCENARIO"

def test_frontend_report_template_markers():
    # 10 §1: the print-tab template renders the same 12 items from the same object
    src = open(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "app.js")).read()
    for marker in ("Investor variance report", "SYNTHETIC DATA", "a.interaction.note",
                   "pct_of_gap", "a.weather", "a.evidence", "<h2>Validation</h2>",
                   "<h2>Evidence</h2>", "<h2>Weather</h2>", "numbers_checked",
                   "window.print()", "esc("):
        assert marker in src, marker

def test_cors_origins_from_env():
    import importlib
    os.environ["FRONTEND_ORIGINS"] = "https://demo.example,http://localhost:5173"
    try:
        m = importlib.reload(api)
        mw = [x for x in m.app.user_middleware if x.cls.__name__ == "CORSMiddleware"]
        assert mw and mw[0].kwargs["allow_origins"] == ["https://demo.example", "http://localhost:5173"]
    finally:
        del os.environ["FRONTEND_ORIGINS"]
        importlib.reload(api)

def test_frontend_static_served_and_wired():
    # 08: existing UI served intact with API/static wiring the JS expects
    r = c.get("/")
    assert r.status_code == 200 and "Variance Explainer" in r.text
    for tab in ("analysis", "class", "valid", "report"):
        assert f'data-tab="{tab}"' in r.text
    assert 'id="apinote"' in r.text and 'id="retry"' not in r.text  # error UI is JS-rendered only
    r = c.get("/app.js")
    assert r.status_code == 200 and "getJSON" in r.text and "shapley" in r.text.lower()
    assert "localhost" not in r.text  # no hard-coded host: same-origin api/ + data/ URLs
    r = c.get("/data/scenarios.json")
    assert r.status_code == 200 and {s["key"] for s in r.json()["scenarios"]} == {"s0", "s1", "s2", "s3"}
    r = c.get("/data/s0_FY.json")
    assert r.status_code == 200 and r.json()["reconciliation"]["closes"]
