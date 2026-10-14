"""Runs tests without pytest:  python tests/run_tests.py"""
import sys, os, traceback
sys.path.insert(0, os.path.dirname(__file__))
import test_engine, test_contract, test_physics
fails = 0
for t in (test_engine, test_contract, test_physics):
    for n in sorted(x for x in dir(t) if x.startswith("test_")):
        try: getattr(t, n)(); print("PASS", t.__name__ + "." + n)
        except Exception: fails += 1; print("FAIL", t.__name__ + "." + n); traceback.print_exc()
sys.exit(1 if fails else 0)
