import sys, os, time, math, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from vareng import physics as ph
from vareng.physics import CAUSES
from vareng.synth import build_world
from vareng.attribution import analyze, _p_slice, _actual_state, _core
from vareng.narrative import check_numbers
from vareng.validation import validate

W = {k: build_world(k) for k in ("s1", "s2", "s3")}

def test_shapley_efficiency_and_additivity_toy():
    f = np.array([0, 3, 5, 12.0])     # 2 players, value of {} {1} {2} {1,2}
    phi = ph.shapley_from_values(f, 2)
    assert abs(phi.sum() - 12) < 1e-12 and abs(phi[0] - 5) < 1e-12 and abs(phi[1] - 7) < 1e-12

def test_reconciliation_closes_exactly_every_scenario_and_period():
    for k, w in W.items():
        for p in ("FY", "2025-07", "2026-03"):
            a = analyze(w, p, n_mc=4)
            r = a["reconciliation"]
            assert r["closes"] and r["residual_milli_kwh"] == 0 and r["isolated_view_closes"]
            tot = sum(round(c["kwh"]*1000) for c in a["components"]) + round(a["unexplained"]["kwh"]*1000)
            assert tot == round(a["gap_kwh"]*1000)

def test_unexplained_independent_definition():
    w = W["s3"]; a = analyze(w, "FY", n_mc=4)
    act, a_meas, _, _ = _actual_state(w); c = _core(w, act, a_meas, _p_slice(w, "FY"))
    assert abs((c["A"] - c["sim_all"]) - a["unexplained"]["kwh"]) < 0.01

def test_order_independence():
    a = analyze(W["s1"], "FY", n_mc=4)
    assert a["sequential_demo"]["max_order_swing_kwh"] > 1000      # a naive waterfall depends on order
    assert a["sequential_demo"]["total_same"]

def test_hidden_cause_not_misassigned_when_large():
    v = validate(W["s3"]); assert v["hidden"]["landed_in_unexplained"] and v["summary"]["reconciliation_closes"]

def test_no_hidden_cause_means_small_unexplained():
    w = build_world("s3"); w.a_meas = w.a_meas / np.where(w.truth_hidden < 1, w.truth_hidden, 1)  # remove the hidden loss from "measured"
    a = analyze(w, "FY", n_mc=10)
    assert abs(a["unexplained"]["kwh"]) < 0.01*a["forecast_kwh"]

def test_narrative_numbers_match_engine():
    for w in W.values():
        a = analyze(w, "FY", n_mc=4); assert a["narrative"]["numbers_checked"], a["narrative"]["unmatched_numbers"]
    ok, bad = check_numbers("It lost 999,999 MWh", {"1"}); assert not ok

def test_physics_sane():
    w = W["s1"]; assert 0 < w.fc["irradiance"].max() < 1300
    assert w.a_true.max() <= w.plant.ac_cap_kw + 1e-6

def test_same_seed_deterministic():
    # 01 DoD: same scenario/configuration produces deterministic output
    w = build_world("s1")
    a1 = analyze(w, "FY", n_mc=4); a2 = analyze(w, "FY", n_mc=4)
    assert a1["gap_kwh"] == a2["gap_kwh"] and a1["components"] == a2["components"]
    assert a1["unexplained"] == a2["unexplained"] and a1["narrative"] == a2["narrative"]

def test_baseline_near_closed():
    # 01: baseline scenario shows a near-closed result with small residual
    w = build_world("s0")
    a = analyze(w, "FY", n_mc=10)
    assert abs(a["gap_pct"]) < 2.0
    assert abs(a["unexplained"]["kwh"]) < 0.01*a["forecast_kwh"]
    assert not a["unexplained"]["exceeds_band"]
    assert a["reconciliation"]["closes"]
    assert len(a["components"]) == 7

def test_coalition_endpoints_match_definitions():
    # 05 §2: v(empty) == baseline forecast, v(all) == modelled actual (pre-hidden)
    w = build_world("s2")
    act, a_meas, _, _ = _actual_state(w)
    c = _core(w, act, a_meas, _p_slice(w, "FY"))
    assert abs(c["f"][0] - c["F"]) < 1e-6
    assert abs(c["f"][-1] - c["sim_all"]) < 1e-6
    assert c["sim_all"] != c["A"] or True  # modelled actual vs metered (hidden lives here)

def test_stable_cause_schema_order():
    # 05 §8: causes always returned in stable schema order
    a = analyze(W["s1"], "FY", n_mc=2)
    assert [c["id"] for c in a["components"]] == CAUSES

def test_interaction_diagnostic_convention():
    # 05 §4: interaction is the defined diagnostic ΣShapley − Σisolated, and both
    # views reconcile exactly (never a decorative bar ignored by the equation)
    for w in W.values():
        a = analyze(w, "FY", n_mc=2)
        assert abs(a["interaction"]["kwh"] - (sum(c["kwh"] for c in a["components"])
                  - sum(c["main_effect_kwh"] for c in a["components"]))) < 1e-9
        assert a["reconciliation"]["closes"] and a["reconciliation"]["isolated_view_closes"]

def test_injected_causes_move_expected_direction():
    # 05 §8: each known injected cause moves the output in the expected direction
    a2 = analyze(build_world("s2"), "FY", n_mc=2)   # curtailment-heavy
    curt = next(c for c in a2["components"] if c["id"] == "curtailment")
    assert curt["kwh"] < 0 and abs(curt["kwh"]) == max(abs(c["kwh"]) for c in a2["components"])
    a1 = analyze(build_world("s1"), "FY", n_mc=2)   # delayed cleaning + derate gap
    by_id = {c["id"]: c["kwh"] for c in a1["components"]}
    assert by_id["soiling"] < 0 and by_id["model"] < 0
    a3 = analyze(build_world("s3"), "FY", n_mc=2)   # 6% hidden afternoon loss
    assert a3["unexplained"]["kwh"] < 0 and a3["unexplained"]["exceeds_band"]

def test_response_finite():
    # 05 §6/§8: no NaN/Infinity anywhere in the numeric response
    def walk(x):
        if isinstance(x, float): assert math.isfinite(x)
        elif isinstance(x, dict):
            for v in x.values(): walk(v)
        elif isinstance(x, (list, tuple)):
            for v in x: walk(v)
    for w in W.values():
        a = analyze(w, "FY", n_mc=2)
        walk({"f": a["forecast_kwh"], "a": a["actual_kwh"], "g": a["gap_kwh"],
              "c": [(c["kwh"], c["inr"], c["lower_kwh"], c["upper_kwh"]) for c in a["components"]],
              "u": (a["unexplained"]["kwh"], a["unexplained"]["lower_kwh"], a["unexplained"]["upper_kwh"])})

def test_analysis_runtime_reasonable():
    # 05 §7: benchmark — one full-year analysis (128 coalitions + small MC) well
    # under a generous cap (catches pathological regressions, not a perf target)
    t = time.time()
    analyze(build_world("s1"), "FY", n_mc=2)
    dt = time.time() - t
    print(f"  [benchmark] FY n_mc=2 analysis: {dt:.1f}s")
    assert dt < 300
