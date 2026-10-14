"""Self-contained PV physics (numpy only).

Kept behind this single module so pvlib can replace it later:
  solar_position -> pvlib.solarposition.get_solarposition
  clearsky_ghi   -> pvlib.clearsky.ineichen / haurwitz
  erbs           -> pvlib.irradiance.erbs
  poa_isotropic  -> pvlib.irradiance.get_total_irradiance(model='isotropic')
  cell_temp      -> pvlib.temperature.faiman
tests/test_physics.py cross-checks against pvlib when it is installed.
"""
from __future__ import annotations
import numpy as np
from dataclasses import dataclass

@dataclass(frozen=True)
class Plant:
    plant_id: str = "RJ-30"
    name: str = "Synthetic 30 MWp plant, Jodhpur region, Rajasthan"
    lat: float = 26.30
    lon: float = 73.02
    tz_hours: float = 5.5
    tilt_deg: float = 24.0
    azimuth_deg: float = 180.0
    albedo: float = 0.20
    pdc0_kw: float = 30_000.0          # DC nameplate
    n_inverters: int = 10
    ac_cap_kw: float = 23_000.0        # DC/AC ~1.30
    inverter_eff: float = 0.985
    gamma: float = -0.0035             # power temp coeff per degC
    faiman_u0: float = 25.0
    faiman_u1: float = 6.84
    wind_ms: float = 2.0
    # Forecast (financing model) assumptions
    fc_availability: float = 0.995
    fc_soiling: float = 0.020
    fc_degradation_per_year: float = 0.005
    fc_derate: float = 0.970           # mismatch, wiring, LID, shading bundle
    age_years: float = 2.0

def solar_position(doy, hour_local_mid, lat, lon, tz):
    """NOAA low-precision solar position. hour_local_mid = local clock hour at interval midpoint."""
    g = 2 * np.pi / 365.0 * (doy - 1 + (hour_local_mid - 12) / 24.0)
    eqt = 229.18 * (0.000075 + 0.001868*np.cos(g) - 0.032077*np.sin(g)
                    - 0.014615*np.cos(2*g) - 0.040849*np.sin(2*g))
    decl = (0.006918 - 0.399912*np.cos(g) + 0.070257*np.sin(g) - 0.006758*np.cos(2*g)
            + 0.000907*np.sin(2*g) - 0.002697*np.cos(3*g) + 0.00148*np.sin(3*g))
    tst = hour_local_mid*60 + eqt + 4*lon - 60*tz
    ha = np.deg2rad(tst/4 - 180)
    la = np.deg2rad(lat)
    cosz = np.sin(la)*np.sin(decl) + np.cos(la)*np.cos(decl)*np.cos(ha)
    cosz = np.clip(cosz, -1, 1)
    zen = np.arccos(cosz)
    # azimuth from north, clockwise
    sinz = np.sin(zen)
    with np.errstate(invalid="ignore", divide="ignore"):
        cosaz = (np.sin(decl) - np.sin(la)*cosz) / (np.cos(la)*np.where(sinz == 0, 1e-9, sinz))
    az = np.arccos(np.clip(cosaz, -1, 1))
    az = np.where(ha > 0, 2*np.pi - az, az)
    return zen, az

def extraterrestrial(doy):
    return 1361.0 * (1 + 0.033*np.cos(2*np.pi*doy/365.0))

def clearsky_ghi(cosz):
    c = np.clip(cosz, 0.0, 1.0)
    out = 1098.0 * c * np.exp(-0.057 / np.maximum(c, 1e-3))
    return np.where(c > 0.01, 0.96*out, 0.0)   # 0.96: dry-air Rajasthan calibration of Haurwitz

def erbs(ghi, cosz, doy):
    i0 = extraterrestrial(doy)
    et = i0*np.maximum(cosz, 0.0)
    kt = np.where(et > 1, np.clip(ghi/np.maximum(et, 1), 0, 1.2), 0.0)
    df = np.where(kt <= 0.22, 1 - 0.09*kt,
         np.where(kt <= 0.80, 0.9511 - 0.1604*kt + 4.388*kt**2 - 16.638*kt**3 + 12.336*kt**4, 0.165))
    dhi = df*ghi
    dni = np.where(cosz > 0.087, (ghi - dhi)/np.maximum(cosz, 0.087), 0.0)
    return np.clip(dni, 0, 1100), dhi

def poa_isotropic(ghi, dni, dhi, zen, az, plant: Plant):
    b = np.deg2rad(plant.tilt_deg); ap = np.deg2rad(plant.azimuth_deg)
    cos_aoi = np.cos(zen)*np.cos(b) + np.sin(zen)*np.sin(b)*np.cos(az - ap)
    beam = dni*np.maximum(cos_aoi, 0.0)
    sky = dhi*(1 + np.cos(b))/2
    gnd = ghi*plant.albedo*(1 - np.cos(b))/2
    return np.maximum(beam + sky + gnd, 0.0)

def ghi_to_poa(ghi, geom, plant: Plant):
    dni, dhi = erbs(ghi, geom["cosz"], geom["doy"])
    return poa_isotropic(ghi, dni, dhi, geom["zen"], geom["az"], plant)

def cell_temp(t_amb, poa, plant: Plant):
    return t_amb + poa / (plant.faiman_u0 + plant.faiman_u1*plant.wind_ms)

def geometry(index, plant: Plant):
    """index: pandas DatetimeIndex (naive local clock time, hourly, interval start)."""
    doy = np.asarray(index.dayofyear, dtype=float)
    hour_mid = np.asarray(index.hour, dtype=float) + 0.5
    zen, az = solar_position(doy, hour_mid, plant.lat, plant.lon, plant.tz_hours)
    return {"doy": doy, "hour": np.asarray(index.hour), "zen": zen, "az": az, "cosz": np.cos(zen)}

# ---------------------------------------------------------------- simulator
CAUSES = ["irradiance", "temperature", "downtime", "curtailment", "soiling", "degradation", "model"]

def simulate(plant: Plant, poa, t_amb, avail, setpoint_kw, soiling, degradation, derate, hidden=None):
    """Vectorised AC export energy (kWh per hour). All inputs broadcast to (..., N)."""
    tc = cell_temp(t_amb, poa, plant)
    temp_factor = 1.0 + plant.gamma*(tc - 25.0)
    pdc = plant.pdc0_kw * (poa/1000.0) * temp_factor * (1 - soiling) * (1 - degradation) * derate
    if hidden is not None:
        pdc = pdc * hidden
    pac = np.minimum(pdc*avail*plant.inverter_eff, plant.ac_cap_kw*avail)
    return np.minimum(pac, setpoint_kw)

def coalition_matrix(n):
    k = np.arange(2**n)
    return ((k[:, None] >> np.arange(n)[None, :]) & 1).astype(bool)   # (2^n, n)

def shapley_from_values(f, n):
    """f: array (2^n, ...) of coalition values indexed by bitmask. Returns (n, ...) Shapley values."""
    from math import factorial
    masks = np.arange(2**n)
    pc = np.array([bin(m).count("1") for m in masks])
    w = np.array([factorial(s)*factorial(n-s-1)/factorial(n) for s in range(n)])
    out = []
    for c in range(n):
        without = masks[(masks >> c) & 1 == 0]
        out.append(np.tensordot(w[pc[without]], f[without | (1 << c)] - f[without], axes=(0, 0)))
    return np.array(out)

def run_coalitions(plant, fc: dict, act: dict, causes, hidden_pair=None):
    """Evaluate every on/off coalition. fc/act: dict cause -> array (N,) (forecast / actual state).
    hidden_pair: optional (fc_hidden, act_hidden) appended as an extra switch named 'hidden'."""
    names = list(causes) + (["hidden"] if hidden_pair is not None else [])
    n = len(names)
    M = coalition_matrix(n)
    sel = {}
    for j, c in enumerate(names):
        a = act[c] if c != "hidden" else hidden_pair[1]
        f = fc[c] if c != "hidden" else hidden_pair[0]
        sel[c] = np.where(M[:, j, None], np.asarray(a)[None, :], np.asarray(f)[None, :])
    kwh = simulate(plant, sel["irradiance"], sel["temperature"], sel["downtime"], sel["curtailment"],
                   sel["soiling"], sel["degradation"], sel["model"], sel.get("hidden"))
    return names, kwh                       # (2^n, N) kWh
