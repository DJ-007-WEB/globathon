"""Pre-compute every scenario x period and write static JSON for the frontend (works on any static host)."""
import json, os, sys, time
from vareng.synth import build_world, SCENARIOS, MONTHS
from vareng.attribution import analyze
from vareng.validation import validate
OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "data")
os.makedirs(OUT, exist_ok=True)
def dump(name, obj):
    with open(os.path.join(OUT, name), "w") as f: json.dump(obj, f, separators=(",", ":"))
meta = []
for key, sc in SCENARIOS.items():
    t = time.time(); w = build_world(key); monthly = []
    fy = analyze(w, "FY"); dump(f"{key}_FY.json", fy)
    for m in MONTHS:
        a = analyze(w, m); dump(f"{key}_{m}.json", a)
        monthly.append({"period": m, "gap_pct": a["gap_pct"], "gap_kwh": a["gap_kwh"], "unexplained_kwh": a["unexplained"]["kwh"]})
    dump(f"{key}_validation.json", validate(w, fy))
    meta.append({"key": key, "name": sc.name, "blurb": sc.blurb, "monthly": monthly, "fy_gap_pct": fy["gap_pct"]})
    print(key, "done in %.1fs" % (time.time() - t), flush=True)
dump("scenarios.json", {"scenarios": meta, "months": MONTHS})
