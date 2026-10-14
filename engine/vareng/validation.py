"""Validation against injected ground truth.
Truth world: true input states (no sensor noise) + the hidden cause as an 8th Shapley switch.
Engine world: noisy measured inputs only. We compare per-cause attribution and check the hidden
cause lands in 'unexplained'. Limitation (stated in UI): the engine and truth share the same physics
model, so this tests attribution logic and robustness to input noise, not physics-model error."""
from __future__ import annotations
import numpy as np
from . import physics as ph
from .physics import CAUSES
from .attribution import analyze, CAUSE_META

TOL_REL, TOL_ABS_FRAC = 0.20, 0.001      # recovered if within 20% of truth or 0.1% of forecast

def truth_attribution(world):
    fc = {c: world.fc[c] for c in CAUSES}; ac = {c: world.truth[c] for c in CAUSES}
    names, kwh = ph.run_coalitions(world.plant, fc, ac, CAUSES, hidden_pair=(np.ones(len(world.index)), world.truth_hidden))
    f = kwh.sum(axis=1); phi = ph.shapley_from_values(f, len(names))
    assert abs(f[-1] - world.a_true.sum()) < 1e-3
    return dict(zip(names, map(float, phi))), float(f[0]), float(f[-1])

def validate(world, analysis=None) -> dict:
    a = analysis or analyze(world, "FY")
    truth, F, A_true = truth_attribution(world)
    rows = []
    for c in a["components"]:
        t = truth[c["id"]]; r = c["kwh"]; err = r - t
        tol = max(TOL_REL*abs(t), TOL_ABS_FRAC*F)
        rows.append({"id": c["id"], "cause": c["cause"], "truth_kwh": round(t, 1), "recovered_kwh": round(r, 1),
                     "error_kwh": round(err, 1), "error_pct": None if abs(t) < 1e-6 else round(100*err/abs(t), 1),
                     "lower_kwh": c["lower_kwh"], "upper_kwh": c["upper_kwh"],
                     "within_band": bool(c["lower_kwh"] <= t <= c["upper_kwh"]),
                     "recovered": bool(abs(err) <= tol), "material": bool(abs(t) >= TOL_ABS_FRAC*F), "confidence": c["confidence"]})
    th = truth["hidden"]; u = a["unexplained"]
    hid = {"truth_kwh": round(th, 1), "unexplained_kwh": round(u["kwh"], 1), "error_kwh": round(u["kwh"] - th, 1),
           "error_pct": None if abs(th) < 1e-6 else round(100*(u["kwh"] - th)/abs(th), 1),
           "same_sign": bool(np.sign(th) == np.sign(u["kwh"])),
           "flagged_unexplained": bool(u["exceeds_band"]),
           "landed_in_unexplained": bool(abs(u["kwh"] - th) <= max(0.35*abs(th), TOL_ABS_FRAC*F) and u["exceeds_band"]),
           "detection_floor_kwh": round(u["upper_kwh"] - u["lower_kwh"], 1),
           "below_detection_floor": bool(abs(th) < max(2*(u["upper_kwh"] - u["lower_kwh"]), 0.001*F)),
           "scenario_hidden": f"{world.scenario.hidden_loss*100:.1f}% DC loss on 13:00-16:59 from {world.scenario.hidden_start}, not in any log"}
    mat = [r for r in rows if r["material"]]
    summary = {"named_causes_material": len(mat), "named_recovered": sum(r["recovered"] for r in mat),
               "named_within_band": sum(r["within_band"] for r in mat),
               "hidden_landed_in_unexplained": hid["landed_in_unexplained"],
               "reconciliation_closes": a["reconciliation"]["closes"],
               "mean_abs_error_pct_material": round(float(np.mean([abs(r["error_pct"]) for r in mat if r["error_pct"] is not None])), 1) if mat else None}
    return {"scenario": world.scenario.key, "scenario_name": world.scenario.name, "forecast_kwh": round(F, 1),
            "true_actual_kwh": round(A_true, 1), "measured_actual_kwh": round(a["actual_kwh"], 1),
            "rows": rows, "hidden": hid, "summary": summary, "tolerance": f"recovered = within {int(TOL_REL*100)}% of truth or {TOL_ABS_FRAC*100:.1f}% of forecast",
            "limitation": "Engine and truth share one physics model, so this tests attribution logic and robustness to sensor/meter/soiling noise, not physics-model error. Real-plant validation needs real SCADA data."}
