"""Contract tests (02 Phase 1): shared Pydantic schema conformance.

Loads the static fixture JSONs (the same engine-built payloads the API serves
and the frontend consumes) and asserts required fields, enums, numeric signs
and exact serialized reconciliation. Run:  python tests/run_tests.py
"""
import sys, os, json, glob
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from vareng.contract import Analysis

DATA = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "data")
CLASSES = {"luck", "controllable", "predictable", "external"}
CONFIDENCES = {"high", "medium", "low"}

def _fy_keys():
    return sorted(glob.glob(os.path.join(DATA, "s*_FY.json")))

def test_fixtures_validate_against_schema():
    assert _fy_keys(), "no FY fixtures found"
    for p in _fy_keys():
        with open(p) as f:
            Analysis(**json.load(f))  # raises on missing/invalid fields

def test_required_fields_enums_and_signs():
    for p in _fy_keys():
        with open(p) as f:
            a = json.load(f)
        for k in ("plant_id", "plant_name", "period", "forecast_kwh", "actual_kwh",
                  "gap_kwh", "tariff_inr_per_kwh", "components", "interaction",
                  "unexplained", "weather_percentile", "data_quality_flags",
                  "schema_version", "data_disclosure", "engine_version",
                  "reproducibility_seed"):
            assert k in a, (p, k)
        assert a["schema_version"] == "1.0" and a["data_disclosure"] == "Synthetic demo data"
        assert a["tariff_inr_per_kwh"] >= 0
        assert len(a["components"]) == 7
        for c in a["components"]:
            assert c["class"] in CLASSES, (p, c["id"], c["class"])
            assert c["confidence"] in CONFIDENCES, (p, c["id"])
            assert isinstance(c["claimable"], bool)
            # money preserves sign: tariff > 0 so inr matches kwh sign
            assert (c["inr"] <= 0) == (c["kwh"] <= 0) or (c["kwh"] == 0 and c["inr"] == 0), (p, c["id"])
            for k in ("evidence_ids",):
                assert isinstance(c[k], list) and all(isinstance(e, str) for e in c[k]), (p, c["id"])
        # only curtailment may be claimable (06)
        assert all((not c["claimable"]) or c["id"] == "curtailment" for c in a["components"]), p

def test_serialized_reconciliation_exact():
    for p in _fy_keys() + sorted(glob.glob(os.path.join(DATA, "s*_202*.json"))):
        with open(p) as f:
            a = json.load(f)
        tot = sum(round(c["kwh"]*1000) for c in a["components"]) + round(a["unexplained"]["kwh"]*1000)
        assert tot == round(a["gap_kwh"]*1000), p
        assert abs(a["gap_kwh"] - (a["actual_kwh"] - a["forecast_kwh"])) < 0.01, p

def test_unexplained_always_present():
    for p in _fy_keys() + sorted(glob.glob(os.path.join(DATA, "s*_202*.json"))):
        with open(p) as f:
            a = json.load(f)
        u = a["unexplained"]
        for k in ("kwh", "inr", "lower_kwh", "upper_kwh", "exceeds_band"):
            assert k in u, (p, k)
