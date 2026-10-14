"""Plain-language narrative generated ONLY from engine numbers, then number-checked.
(The Claude API can rephrase this later; the checker below must pass on any rephrasing.)"""
import re

def _fmt(x, d=0): return f"{x:,.{d}f}"

def build_narrative(a: dict) -> dict:
    allowed = set()
    def n(x, d=0, sign=False):
        s = f"{x:,.{d}f}" if sign else f"{abs(x):,.{d}f}"
        allowed.add(s.lstrip("-")); allowed.add(s); return s
    gap = a["gap_kwh"]; F = a["forecast_kwh"]
    direction = "below" if gap < 0 else "above"
    sents = [f"In {a['period_label']}, the synthetic plant delivered {n(a['actual_kwh']/1000)} MWh against a forecast of {n(F/1000)} MWh: "
             f"{n(abs(gap)/1000)} MWh ({n(abs(a['gap_pct']), 1)}%) {direction} forecast, worth about INR {n(abs(a['gap_inr'])/1e5, 1)} lakh at the assumed tariff."]
    comps = [c for c in a["components"] if c["present"]]
    comps.sort(key=lambda c: -abs(c["kwh"]))
    for c in comps[:4]:
        if abs(c["kwh"]) < 5e-4*F: continue
        verb = "cost" if c["kwh"] < 0 else "added"
        extra = ""
        if c["id"] == "irradiance":
            extra = f" ({a['weather']['statement']})"
        if c["id"] == "curtailment" and c["claimable"]:
            extra = " Potentially claimable; needs contract review."
        sents.append(f"{c['cause']} {verb} {n(abs(c['kwh'])/1000, 1)} MWh [{c['class_label'].lower()}, {c['confidence']} confidence]{extra}")
    u = a["unexplained"]
    if u["exceeds_band"]:
        sents.append(f"{n(abs(u['kwh'])/1000, 1)} MWh remains unexplained and is larger than measurement uncertainty can account for (90% band {n(u['lower_kwh']/1000, 1, True)} to {n(u['upper_kwh']/1000, 1, True)} MWh).")
    else:
        sents.append(f"The remaining {n(abs(u['kwh'])/1000, 1)} MWh is within measurement uncertainty.")
    allowed |= set(_NUM.findall(a['weather']['statement']))
    text = " ".join(s if s.endswith(".") or s.endswith(")") else s + "." for s in sents)
    ok, bad = check_numbers(text, allowed)
    return {"text": text, "numbers_checked": ok, "unmatched_numbers": bad, "allowed_numbers": sorted(allowed)}

_NUM = re.compile(r"\d[\d,]*\.?\d*")

def check_numbers(text: str, allowed) -> tuple[bool, list]:
    """Every number in the text must be one the engine produced. Ignores years/dates and '90%' band label."""
    bad = []
    for m in _NUM.findall(text):
        m = m.rstrip(".,")
        if m in allowed or m in {"90", "2025", "26", "2026", "2025-26"}: continue
        bad.append(m)
    return (len(bad) == 0, bad)
