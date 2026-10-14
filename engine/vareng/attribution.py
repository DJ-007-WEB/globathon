"""Order-independent attribution of (actual - forecast) to named causes.

Method (see docs/METHOD.md):
  * 7 switches, each flips one cause from its forecast-time state to its observed state.
  * All 2^7 = 128 coalitions are simulated; each cause gets its Shapley value (average marginal
    contribution over all orderings). No double counting, no order dependence.
  * Unexplained U = measured actual - simulated actual (all switches on). It is never hidden or
    spread across causes. Sum(causes) + U = gap EXACTLY (integer milli-kWh arithmetic).
  * 'Isolated effect' + 'interaction' view is returned too, for people who want to see the
    non-additive part explicitly.
  * Monte Carlo over sensor/meter/calibration uncertainty gives a 90% band on every number.
"""
from __future__ import annotations
import numpy as np, pandas as pd
from . import physics as ph
from .physics import CAUSES, Plant
from .synth import World, BIG, TARIFF_INR_PER_KWH, MONTHS, month_idx
from . import MODEL_VERSION

N_MC = 80
CAL_HOURS = 21*24                    # calibration window: first 21 days of the record
P_LO, P_HI = 5, 95

CAUSE_META = {
 "irradiance":  {"label": "Irradiance vs typical year", "class": "luck",
                 "signals": ["Plane-of-array irradiance (pyranometer GHI -> POA)"],
                 "formula": "Phi_irr = Shapley contribution of replacing forecast-year POA irradiance with measured POA, all else mixed over orderings"},
 "temperature": {"label": "Ambient temperature", "class": "luck",
                 "signals": ["Ambient temperature sensor", "Faiman cell-temperature model"],
                 "formula": "Phi_temp = Shapley contribution of replacing typical ambient temperature with measured; acts via cell temperature and gamma = -0.35%/degC"},
 "downtime":    {"label": "Equipment downtime", "class": "controllable",
                 "signals": ["Inverter status log (n inverters online per hour)"],
                 "formula": "Phi_down = Shapley contribution of replacing assumed availability (99.5%) with logged availability"},
 "curtailment": {"label": "Grid curtailment", "class": "external",
                 "signals": ["Export setpoint / curtailment flags from grid operator or PPC"],
                 "formula": "Phi_curt = Shapley contribution of applying the logged export setpoint (forecast assumes none)"},
 "soiling":     {"label": "Soiling above assumption", "class": "controllable",
                 "signals": ["Soiling station ratio (daily)", "Cleaning log"],
                 "formula": "Phi_soil = Shapley contribution of replacing assumed 2.0% soiling with the soiling-station series"},
 "degradation": {"label": "Degradation vs assumption", "class": "predictable",
                 "signals": ["Periodic flash test / IV-curve degradation estimate"],
                 "formula": "Phi_deg = Shapley contribution of replacing assumed 0.5%/yr x age with measured degradation"},
 "model":       {"label": "Forecast model bias", "class": "predictable",
                 "signals": ["Calibration on clean, unconstrained, high-irradiance hours in the first 21 days"],
                 "formula": "Phi_model = Shapley contribution of replacing the financing-model derate (mismatch, wiring, LID, shading bundle) with the derate calibrated from measured data"},
}
DIRECTLY_MEASURED = {"downtime", "curtailment"}
CLASS_TEXT = {"predictable": "Predictable", "controllable": "Controllable", "luck": "Luck",
              "external": "Outside operator control"}

# ------------------------------------------------------------------ helpers
def _p_slice(world: World, period: str) -> slice:
    if period == "FY":
        return slice(0, len(world.index))
    m = month_idx(world.index); k = MONTHS.index(period)
    idx = np.where(m == k)[0]
    return slice(int(idx[0]), int(idx[-1]) + 1)

def period_label(period: str) -> str:
    if period == "FY": return "FY 2025-26 (Apr 2025 - Mar 2026)"
    return pd.Timestamp(period + "-01").strftime("%B %Y")

def _actual_state(world: World, pert: dict | None = None):
    """Engine-visible actual state (full year arrays) with optional perturbation; derate calibrated."""
    me = world.meas
    p = pert or {}
    act = {
      "irradiance": me["irradiance"]*(1 + p.get("poa_bias", 0.0)),
      "temperature": me["temperature"] + p.get("t_off", 0.0),
      "downtime": me["downtime"], "curtailment": me["curtailment"],
      "soiling": np.clip(me["soiling"] + p.get("soil_off", 0.0), 0, 0.5),
      "degradation": me["degradation"] + p.get("deg_off", 0.0),
    }
    a_meas = world.a_meas*(1 + p.get("meter", 0.0))
    d_cal, n_used = calibrate_derate(world, act, a_meas)
    act["model"] = np.full(len(world.index), d_cal)
    return act, a_meas, d_cal, n_used

def calibrate_derate(world: World, act: dict, a_meas: np.ndarray):
    s = slice(0, CAL_HOURS); pl = world.plant
    sim = ph.simulate(pl, act["irradiance"][s], act["temperature"][s], act["downtime"][s], act["curtailment"][s],
                      act["soiling"][s], act["degradation"][s], pl.fc_derate)
    ok = (act["downtime"][s] == 1) & (act["curtailment"][s] >= BIG/2) & (act["irradiance"][s] > 600) & (sim < 0.92*pl.ac_cap_kw) & (sim > 0)
    ratio = a_meas[s][ok]/sim[ok]
    return float(pl.fc_derate*np.median(ratio)), int(ok.sum())

def _coalitions(world: World, act: dict, sl: slice):
    fc = {c: world.fc[c][sl] for c in CAUSES}
    ac = {c: act[c][sl] for c in CAUSES}
    names, kwh = ph.run_coalitions(world.plant, fc, ac, CAUSES)
    return kwh                              # (128, n)

def _core(world, act, a_meas, sl):
    kwh = _coalitions(world, act, sl)
    f = kwh.sum(axis=1)                     # (128,)
    phi = ph.shapley_from_values(f, len(CAUSES))
    main = np.array([f[1 << c] - f[0] for c in range(len(CAUSES))])
    F = f[0]; A = float(a_meas[sl].sum()); sim_all = f[-1]
    return {"F": F, "A": A, "phi": phi, "main": main, "sim_all": sim_all, "f": f, "kwh": kwh}

def _pct_rank(hist, x):
    return 100.0*(np.sum(hist < x) + 0.5*np.sum(hist == x))/len(hist)

# ------------------------------------------------------------------ main entry
def analyze(world: World, period: str = "FY", n_mc: int = N_MC, seed: int = 123) -> dict:
    sl = _p_slice(world, period); pl = world.plant
    act, a_meas, d_cal, n_cal = _actual_state(world)
    core = _core(world, act, a_meas, sl)
    F, A, phi, main = core["F"], core["A"], core["phi"], core["main"]
    gap = A - F
    U = A - core["sim_all"]
    assert abs(phi.sum() - (core["sim_all"] - F)) < 1e-6*max(1, abs(F))   # Shapley efficiency

    # ---- Monte Carlo over input uncertainty (sensor bias, temp offset, soiling offset, flash-test error, meter)
    rng = np.random.default_rng(seed + (0 if period == "FY" else 1 + MONTHS.index(period)))
    mc_phi = np.zeros((n_mc, len(CAUSES))); mc_U = np.zeros(n_mc); mc_gap = np.zeros(n_mc)
    for i in range(n_mc):
        pert = {"poa_bias": rng.normal(0, 0.010), "t_off": rng.normal(0, 0.8), "soil_off": rng.normal(0, 0.004),
                "deg_off": rng.normal(0, 0.001), "meter": rng.normal(0, 0.003)}
        act_i, a_i, _, _ = _actual_state(world, pert)
        c_i = _core(world, act_i, a_i, sl)
        mc_phi[i] = c_i["phi"]; mc_U[i] = c_i["A"] - c_i["sim_all"]; mc_gap[i] = c_i["A"] - c_i["F"]
    lo_phi, hi_phi = np.percentile(mc_phi, [P_LO, P_HI], axis=0)
    lo_U, hi_U = np.percentile(mc_U, [P_LO, P_HI])

    # ---- integer milli-kWh reconciliation
    to_m = lambda x: int(round(float(x)*1000))
    gap_m = to_m(gap); phi_m = [to_m(v) for v in phi]; main_m = [to_m(v) for v in main]
    U_m = gap_m - sum(phi_m)
    inter_m = sum(phi_m) - sum(main_m)
    tar = TARIFF_INR_PER_KWH
    inr = lambda kwh: round(kwh*tar, 2)

    # ---- weather percentile vs 30-year synthetic record
    ks = sorted({int(m) for m in month_idx(world.index[sl])})
    h_ghi = world.hist["ghi_kwh_m2"][:, ks].sum(axis=1)
    x_ghi = float(world.ghi_meas[sl].sum()/1000.0)
    fc_ghi = float(world.ghi_fc[sl].sum()/1000.0)
    pct = _pct_rank(h_ghi, x_ghi)
    h_t = world.hist["t_mean"][:, ks].mean(axis=1)
    x_t = float(np.mean([world.meas["temperature"][sl][month_idx(world.index[sl]) == k].mean() for k in ks]))
    pct_t = _pct_rank(h_t, x_t)
    extreme = pct <= 10 or pct >= 90
    n_hist = len(h_ghi)
    weather = {"irradiance_kwh_m2": round(x_ghi, 1), "typical_year_kwh_m2": round(fc_ghi, 1),
               "delta_pct": round(100*(x_ghi/fc_ghi - 1), 2), "percentile": round(pct, 1),
               "temperature_c": round(x_t, 2), "temperature_percentile": round(pct_t, 1),
               "history_years": n_hist, "history_sorted": [round(float(v), 1) for v in np.sort(h_ghi)],
               "extreme": bool(extreme),
               "statement": _weather_statement(pct, n_hist, extreme, x_ghi < fc_ghi)}

    ev = _evidence(world, act, a_meas, sl, core, d_cal, n_cal, weather, ks)

    comps = []
    for j, c in enumerate(CAUSES):
        meta = CAUSE_META[c]
        val = phi_m[j]/1000.0
        width = float(hi_phi[j] - lo_phi[j]); rw = width/max(abs(val), 1e-3*F)
        present = abs(val) >= 1e-4*F or abs(main_m[j]/1000.0) >= 1e-4*F
        conf = _confidence(c, rw, present)
        cls = meta["class"]; detail = ""
        if c == "irradiance":
            detail = "Extreme weather event: " + weather["statement"] if extreme else "Normal variability: " + weather["statement"]
        if c == "temperature":
            detail = f"Mean ambient {x_t:.1f} degC, percentile {pct_t:.0f} of {n_hist} synthetic years"
        claimable = bool(c == "curtailment" and val < -5e-4*F)
        comps.append({
          "id": c, "cause": meta["label"], "class": cls, "class_label": CLASS_TEXT[cls], "class_detail": detail,
          "kwh": val, "inr": inr(val), "main_effect_kwh": main_m[j]/1000.0,
          "lower_kwh": round(float(lo_phi[j]), 3), "upper_kwh": round(float(hi_phi[j]), 3),
          "confidence": conf, "present": bool(present), "claimable": claimable,
          "claim_note": "Potentially claimable - needs contract / PPA review. No legal conclusion is made." if claimable else "",
          "signals": meta["signals"], "formula": meta["formula"], "model_version": MODEL_VERSION,
          "evidence_ids": [e["id"] for e in ev if e["cause"] == c],
        })
    interaction = {"kwh": inter_m/1000.0, "inr": inr(inter_m/1000.0),
                   "note": "Non-additive part: the sum of Shapley values minus the sum of isolated effects. In the Shapley view it is already shared fairly between causes; shown here for transparency."}
    U_kwh = U_m/1000.0
    unexpl = _unexplained(U_kwh, gap_m/1000.0, lo_U, hi_U, F, tar)

    daily = _daily(world, sl, a_meas)
    out = {
      "schema_version": "1.0",
      "data_disclosure": "Synthetic demo data",
      "engine_version": MODEL_VERSION, "reproducibility_seed": seed,
      "plant_id": pl.plant_id, "plant_name": pl.name, "scenario": world.scenario.key, "scenario_name": world.scenario.name,
      "period": period, "period_label": period_label(period),
      "period_start": str(world.index[sl][0]), "period_end": str(world.index[sl][-1]),
      "forecast_kwh": round(F, 3), "actual_kwh": round(A, 3), "gap_kwh": gap_m/1000.0,
      "gap_pct": round(100*gap/F, 3), "tariff_inr_per_kwh": tar, "gap_inr": inr(gap_m/1000.0),
      "components": comps, "interaction": interaction, "unexplained": unexpl,
      "weather_percentile": weather["percentile"], "weather": weather,
      "data_quality_flags": world.flags,
      "reconciliation": {"sum_components_kwh": sum(phi_m)/1000.0, "unexplained_kwh": U_kwh, "gap_kwh": gap_m/1000.0,
                         "closes": (sum(phi_m) + U_m == gap_m), "residual_milli_kwh": gap_m - sum(phi_m) - U_m,
                         "isolated_view_closes": (sum(main_m) + inter_m + U_m == gap_m)},
      "calibration": {"derate_forecast": pl.fc_derate, "derate_calibrated": round(d_cal, 5),
                      "hours_used": n_cal, "window": f"{world.index[0].date()} to {world.index[CAL_HOURS-1].date()}"},
      "sequential_demo": _sequential(core["f"], core["phi"]),
      "evidence": ev, "daily": daily, "monte_carlo": {"samples": n_mc, "band": f"{P_LO}-{P_HI}%",
          "perturbed": "irradiance sensor bias (sd 1.0%), ambient temp offset (sd 0.8 degC), soiling-station offset (sd 0.4 pts), flash-test error (sd 0.1 pts), meter (sd 0.3%); derate recalibrated each sample"},
      "model_version": MODEL_VERSION,
    }
    from .narrative import build_narrative
    out["narrative"] = build_narrative(out)
    return out

def _confidence(c, rw, present):
    if not present: return "high"
    if rw <= 0.15 or (c in DIRECTLY_MEASURED and rw <= 0.30): return "high"
    if rw <= 0.60: return "medium"
    return "low"

def _weather_statement(pct, n, extreme, low):
    if pct <= 100/(2*n)*1.01:
        return f"lowest in the {n}-year synthetic record" if low else f"lowest in the {n}-year synthetic record"
    if pct >= 100 - 100/(2*n)*1.01:
        return f"highest in the {n}-year synthetic record"
    if pct < 50: return f"lower than {100-pct:.0f}% of the {n} synthetic years (percentile {pct:.0f})"
    return f"higher than {pct:.0f}% of the {n} synthetic years (percentile {pct:.0f})"

def _unexplained(U, gap, lo, hi, F, tar):
    excl = (lo > 0) or (hi < 0)
    pct_gap = (U/gap*100) if abs(gap) > 1e-3*F else None
    material = abs(U) > 5e-4*F
    if excl and material:
        sev = "UNEXPLAINED"
        msg = (f"{abs(U):,.0f} kWh of the gap is NOT explained by the data we hold. "
               f"It is larger than input uncertainty alone can produce (90% band {lo:,.0f} to {hi:,.0f} kWh).")
        need = ["String-level current logs / combiner-box data (finds partial-string failures)",
                "Thermal imaging or an IV-curve scan of suspect arrays",
                "A shading survey of new structures or vegetation near the site",
                "Inverter derating and MPPT-fault event codes not currently in the status log"] if U < 0 else \
               ["Pyranometer calibration certificate and cleaning record",
                "Meter calibration / reconciliation against the settlement meter",
                "Bifacial or albedo gain if the plant has bifacial modules"]
    else:
        sev = "WITHIN_UNCERTAINTY"
        msg = (f"The residual ({U:+,.0f} kWh) sits inside input uncertainty (90% band {lo:,.0f} to {hi:,.0f} kWh). "
               "No cause beyond the named ones is indicated by the data.")
        need = ["Nothing required. A tighter band needs a calibrated on-site pyranometer and a soiling station calibration record."]
    return {"kwh": U, "inr": round(U*tar, 2), "pct_of_gap": None if pct_gap is None else round(pct_gap, 1),
            "lower_kwh": round(float(lo), 3), "upper_kwh": round(float(hi), 3),
            "exceeds_band": bool(excl and material), "status": sev, "message": msg, "data_that_would_reduce_it": need,
            "confidence": "low" if (excl and material) else "medium",
            "formula": "U = measured actual - simulated actual (all causes on). Reconciliation: sum(causes) + U = gap."}

def _sequential(f, phi=None):
    """Show that a plain sequential waterfall depends on the order causes are listed in."""
    n = len(CAUSES)
    def run(order):
        S = 0; out = {}
        for c in order:
            out[CAUSES[c]] = float(f[S | (1 << c)] - f[S]); S |= (1 << c)
        return out
    fwd = run(list(range(n))); rev = run(list(range(n))[::-1])
    if phi is None:
        phi = ph.shapley_from_values(f, n)
    # Canonical precision (03/05): round informational floats so static builds are
    # byte-stable across processes (BLAS reduction order varies at ~1e-10).
    r3 = lambda x: round(float(x), 3)
    rows = [{"id": c, "label": CAUSE_META[c]["label"], "listed_first": r3(fwd[c]), "listed_last": r3(rev[c]), "shapley": r3(phi[j]),
             "order_swing_kwh": r3(abs(fwd[c] - rev[c]))} for j, c in enumerate(CAUSES)]
    return {"rows": rows, "max_order_swing_kwh": r3(max(r["order_swing_kwh"] for r in rows)),
            "total_same": bool(abs(sum(fwd.values()) - sum(rev.values())) < 1e-6)}

def _daily(world, sl, a_meas):
    pl = world.plant
    fc = ph.simulate(pl, world.fc["irradiance"][sl], world.fc["temperature"][sl], world.fc["downtime"][sl],
                     world.fc["curtailment"][sl], world.fc["soiling"][sl], world.fc["degradation"][sl], world.fc["model"][sl])
    idx = world.index[sl]
    df = pd.DataFrame({"f": fc, "a": a_meas[sl]}, index=idx).resample("D").sum()
    return {"dates": [str(d.date()) for d in df.index], "forecast_kwh": [round(v, 1) for v in df.f],
            "actual_kwh": [round(v, 1) for v in df.a]}

# ------------------------------------------------------------------ evidence
def _evidence(world, act, a_meas, sl, core, d_cal, n_cal, weather, ks):
    pl = world.plant; ev = []
    lo, hi = sl.start, sl.stop
    base = ph.simulate(pl, act["irradiance"], act["temperature"], act["downtime"], act["curtailment"],
                       act["soiling"], act["degradation"], act["model"])
    def window(start, end):
        a = max(world.index.get_loc(pd.Timestamp(start)), lo)
        b = min(world.index.get_loc(pd.Timestamp(end)) + 1, hi)
        return (a, b) if b > a else None
    # downtime
    big, trips = [], []
    for e in world.logs["outages"]:
        w = window(e["start"], e["end"])
        if not w: continue
        av = act["downtime"].copy(); av[w[0]:w[1]] = np.minimum(av[w[0]:w[1]] + e["n_down"]/pl.n_inverters, 1.0)
        # isolated: energy recovered if this event had not happened
        alt = ph.simulate(pl, act["irradiance"][w[0]:w[1]], act["temperature"][w[0]:w[1]], av[w[0]:w[1]],
                          act["curtailment"][w[0]:w[1]], act["soiling"][w[0]:w[1]], act["degradation"][w[0]:w[1]], act["model"][w[0]:w[1]])
        lost = float((alt - base[w[0]:w[1]]).sum())
        item = {"start": e["start"], "end": e["end"], "label": e["label"], "n_inverters": e["n_down"], "kwh": -round(lost, 1)}
        (trips if e["kind"] == "trip" else big).append(item)
    for i, it in enumerate(sorted(big, key=lambda x: x["kwh"])):
        ev.append({"id": f"down-{i+1}", "cause": "downtime", "title": it["label"],
                   "window": f'{it["start"][:16]} to {it["end"][:16]}',
                   "detail": f'{it["n_inverters"]} of 10 inverters offline; isolated energy lost (event alone, not Shapley-shared)',
                   "signal": "Inverter status log", "kwh": it["kwh"]})
    if trips:
        ev.append({"id": "down-trips", "cause": "downtime", "title": f"{len(trips)} short inverter trips",
                   "window": "1-3 hours each", "detail": "Single-inverter trips logged in the period (aggregate)",
                   "signal": "Inverter status log", "kwh": round(sum(t["kwh"] for t in trips), 1)})
    # curtailment
    cur = []
    for w_ in world.logs["curtailment"]:
        w = window(w_["start"], w_["end"])
        if not w: continue
        alt = ph.simulate(pl, act["irradiance"][w[0]:w[1]], act["temperature"][w[0]:w[1]], act["downtime"][w[0]:w[1]],
                          np.full(w[1]-w[0], BIG), act["soiling"][w[0]:w[1]], act["degradation"][w[0]:w[1]], act["model"][w[0]:w[1]])
        cur.append({**w_, "kwh": -round(float((alt - base[w[0]:w[1]]).sum()), 1)})
    cur_sorted = sorted(cur, key=lambda x: x["kwh"])
    for i, it in enumerate(cur_sorted[:8]):
        ev.append({"id": f"curt-{i+1}", "cause": "curtailment", "title": f'Export capped at {int(it["limit_frac"]*100)}% of AC rating',
                   "window": f'{it["start"][:16]} to {it["end"][:16]}', "detail": "Isolated energy not exported during the window",
                   "signal": "Export setpoint flag", "kwh": it["kwh"]})
    if len(cur_sorted) > 8:
        rest = cur_sorted[8:]
        ev.append({"id": "curt-rest", "cause": "curtailment", "title": f"{len(rest)} further curtailment windows",
                   "window": "see setpoint log", "detail": "Aggregate of remaining windows", "signal": "Export setpoint flag",
                   "kwh": round(sum(r["kwh"] for r in rest), 1)})
    # irradiance by month
    for k in ks:
        sel = (month_idx(world.index) == k)
        sel_p = np.zeros(len(world.index), bool); sel_p[sl] = True; sel &= sel_p
        a_ = world.ghi_meas[sel].sum()/1000; f_ = world.ghi_fc[sel].sum()/1000
        h = world.hist["ghi_kwh_m2"][:, k]; pr = _pct_rank(h, a_)
        ev.append({"id": f"irr-{MONTHS[k]}", "cause": "irradiance", "title": f"{pd.Timestamp(MONTHS[k]+'-01').strftime('%b %Y')} irradiance",
                   "window": MONTHS[k], "detail": f"{a_:.0f} kWh/m2 measured vs {f_:.0f} typical ({100*(a_/f_-1):+.1f}%); percentile {pr:.0f} of {len(h)} synthetic years",
                   "signal": "Pyranometer GHI", "kwh": None})
        # temperature (one evidence line for the period)
    ta = float(act["temperature"][sl].mean()); tf = float(world.fc["temperature"][sl].mean())
    ev.append({"id": "temp-1", "cause": "temperature", "title": "Mean ambient temperature", "window": "whole period",
               "detail": f"{ta:.1f} degC measured vs {tf:.1f} degC typical; percentile {weather['temperature_percentile']:.0f}",
               "signal": "Ambient sensor", "kwh": None})
    # soiling
    s_ = act["soiling"][sl]; i_pk = int(np.argmax(s_))
    clean = [d for d in world.logs["cleaning"] if lo <= world.index.get_loc(pd.Timestamp(d)) < hi]
    ev.append({"id": "soil-1", "cause": "soiling", "title": "Soiling station series", "window": "whole period",
               "detail": f"Mean {100*s_.mean():.2f}% vs 2.00% assumed; peak {100*s_.max():.1f}% on {str(world.index[sl][i_pk].date())}; {len(clean)} cleanings logged",
               "signal": "Soiling station, cleaning log", "kwh": None})
    ev.append({"id": "deg-1", "cause": "degradation", "title": "Flash-test degradation estimate", "window": "annual test",
               "detail": f"Measured {100*act['degradation'][0]:.2f}% cumulative vs {100*pl.fc_degradation_per_year*pl.age_years:.2f}% assumed (age {pl.age_years:.0f} y)",
               "signal": "Annual flash test", "kwh": None})
    ev.append({"id": "model-1", "cause": "model", "title": "Model calibration", "window": f"first 21 days ({world.index[0].date()} onward)",
               "detail": f"Derate calibrated to {d_cal:.4f} vs {pl.fc_derate:.3f} in the financing model, using {n_cal} clean, unconstrained, high-irradiance hours. Note: any irradiance-sensor bias is absorbed into this number.",
               "signal": "Measured export vs simulated", "kwh": None})
    return ev
