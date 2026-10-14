"""Physics sanity + pvlib cross-check (04 §6).

The engine ships a self-contained numpy model (`vareng/physics.py`) because the
build sandbox could not install pvlib. If pvlib IS installed, the clear-sky
comparison below runs; otherwise it is skipped and the self-contained sanity
checks still run. Run:  python tests/run_tests.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import numpy as np
from vareng import physics as ph
from vareng.physics import Plant

def test_clearsky_sane_without_pvlib():
    # Haurwitz dry-air calibration: overhead sun ~1000 W/m2, night zero
    assert 900 < ph.clearsky_ghi(np.array([1.0]))[0] < 1200
    assert ph.clearsky_ghi(np.array([-0.2]))[0] == 0.0
    # ERBS split conserves GHI; POA non-negative and bounded
    dni, dhi = ph.erbs(np.array([800.0]), np.array([0.8]), np.array([100]))
    assert abs(dni[0]*0.8 + dhi[0] - 800.0) < 1.0
    p = Plant()
    assert 0 < p.ac_cap_kw < p.pdc0_kw  # DC/AC oversizing, no phantom clipping

def test_simulate_monotonicity_and_caps():
    # More sun never yields less energy; AC cap and setpoint cap hold
    p = Plant()
    poa = np.array([200.0, 800.0, 1200.0]); t = np.full(3, 25.0)
    avail = np.ones(3); sp = np.full(3, 1e9)
    e = ph.simulate(p, poa, t, avail, sp, np.zeros(3), np.zeros(3), p.fc_derate)
    assert e[0] < e[1] <= e[2] and e.max() <= p.ac_cap_kw + 1e-9
    e2 = ph.simulate(p, poa, t, avail, np.full(3, 1000.0), np.zeros(3), np.zeros(3), p.fc_derate)
    assert (e2 <= 1000.0 + 1e-9).all()

def test_pvlib_crosscheck_if_available():
    try:
        import pvlib
    except ImportError:
        return  # skipped: pvlib not installed (documented deviation)
    # Compare our Haurwitz clear-sky against pvlib haurwitz at solar noon, equinox
    loc = pvlib.location.Location(26.30, 73.02, tz="Asia/Kolkata")
    import pandas as pd
    times = pd.date_range("2025-03-21 12:00", periods=1, freq="h", tz="Asia/Kolkata")
    spa = pvlib.solarposition.get_solarposition(times, 26.30, 73.02)
    zen = np.deg2rad(spa["zenith"].values)
    ours = ph.clearsky_ghi(np.cos(zen))
    theirs = pvlib.clearsky.haurwitz(spa["zenith"].values).values
    assert abs(ours[0] - theirs[0]) / max(theirs[0], 1) < 0.10
