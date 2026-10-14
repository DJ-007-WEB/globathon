"""Synthetic plant world with known, injected causes and one hidden cause.

Two parallel realities are produced:
  * TRUTH     - the true state of every cause (never shown to the attribution engine)
  * MEASURED  - what an owner would actually see: noisy sensors, logs, a meter
The attribution engine only gets MEASURED + FORECAST. Validation compares its output with TRUTH.
"""
from __future__ import annotations
import numpy as np, pandas as pd
from dataclasses import dataclass, field
from . import physics as ph
from .physics import Plant

FY_START = "2025-04-01"
N_HOURS = 8760
BIG = 1e9
MONTHS = ["2025-04","2025-05","2025-06","2025-07","2025-08","2025-09",
          "2025-10","2025-11","2025-12","2026-01","2026-02","2026-03"]
# climatological clearness (GHI / clear-sky GHI) and temperature, Apr..Mar, Rajasthan-like (illustrative)
KCS = np.array([0.90,0.88,0.80,0.62,0.60,0.74,0.90,0.93,0.92,0.91,0.91,0.91])
KCS_SD = np.array([0.08,0.09,0.14,0.20,0.20,0.15,0.07,0.05,0.06,0.07,0.08,0.08])
KCS_MONTH_SD = np.array([0.020,0.025,0.040,0.060,0.060,0.045,0.020,0.015,0.020,0.020,0.020,0.020])
TMEAN = np.array([33.0,35.0,34.0,30.0,28.5,29.0,27.5,22.0,17.0,15.5,19.0,25.0])
TAMP = np.array([8.5,8.5,7.0,4.5,4.0,6.0,8.0,8.5,8.5,8.5,8.5,8.5])
TARIFF_INR_PER_KWH = 2.70   # ASSUMPTION - doc section 9.3

def month_idx(index):
    return np.asarray((index.month - 4) % 12)

def _ar_daily(rng, n_days, sd, phi=0.55):
    e = rng.normal(0, 1, n_days); x = np.zeros(n_days)
    for i in range(n_days):
        x[i] = (phi*x[i-1] if i else 0) + np.sqrt(1-phi**2)*e[i]
    return x*sd

def gen_weather(index, geom, rng, month_scale=True, kcs_scale=None, temp_shift=None):
    """Returns (ghi, t_amb) hourly arrays. month_scale draws a year-specific monthly anomaly."""
    m = month_idx(index); n = len(index)
    n_days = n // 24
    day_m = m[::24]
    sd = KCS_SD[day_m]
    daily = KCS[day_m] + _ar_daily(rng, n_days, 1.0)*sd
    if month_scale:
        mm = 1 + rng.normal(0, 1, 12)*KCS_MONTH_SD
        daily = daily*mm[day_m]
    if kcs_scale is not None:
        daily = daily*kcs_scale[day_m]
    daily = np.clip(daily, 0.08, 1.0)
    d_h = np.repeat(daily, 24)
    k = np.clip(d_h + rng.normal(0, 1, n)*0.14*(1-d_h), 0.03, 1.0)
    ghi = ph.clearsky_ghi(geom["cosz"])*k
    # temperature
    anom = rng.normal(0, 0.8, 12) if month_scale else np.zeros(12)
    dayanom = np.repeat(_ar_daily(rng, n_days, 1.6), 24)
    h = geom["hour"]
    t = TMEAN[m] + anom[m] + TAMP[m]*np.sin(2*np.pi*(h-9)/24.0) + dayanom
    if temp_shift is not None:
        t = t + temp_shift[m]
    return ghi, t

def build_soiling(index, cleaning_dates, rate_by_month, rain_rinse_months=(3, 4), seed=0):
    """Daily soiling loss fraction; resets on cleaning dates; monsoon rain rinses every ~10 days."""
    rng = np.random.default_rng(seed)
    days = pd.date_range(index[0].normalize(), periods=len(index)//24, freq="D")
    clean = set(pd.to_datetime(cleaning_dates))
    s = np.zeros(len(days)); cur = 0.012
    for i, d in enumerate(days):
        mi = (d.month - 4) % 12
        if d in clean: cur = 0.003
        elif mi in rain_rinse_months and rng.random() < 0.10: cur = 0.004
        else: cur = min(cur + rate_by_month[mi], 0.12)
        s[i] = cur
    return np.repeat(s, 24)

def build_availability(index, events, rng):
    """events: list of dict(start,end,n_down,label). Plus logged micro-trips. Returns availability, event list."""
    n = len(index); down = np.zeros(n)
    ev_out = []
    pos = pd.Series(np.arange(n), index=index)
    for e in events:
        sl = pos[e["start"]:e["end"]].values
        down[sl] += e["n_down"]
        ev_out.append({**e, "kind": "outage", "logged": True})
    # micro-trips: ~3/month, 1 inverter, 1-3 h
    for mth in range(12):
        lo = mth*730; hi = min(lo+730, n)
        for _ in range(rng.integers(2, 5)):
            st = int(rng.integers(lo+7, hi-4)); du = int(rng.integers(1, 4))
            down[st:st+du] += 1
            ev_out.append({"start": str(index[st]), "end": str(index[min(st+du-1, n-1)]),
                           "n_down": 1, "label": "Inverter trip", "kind": "trip", "logged": True})
    avail = np.clip(1 - down/Plant().n_inverters, 0, 1)
    return avail, ev_out

def build_setpoint(index, windows):
    sp = np.full(len(index), BIG); pos = pd.Series(np.arange(len(index)), index=index)
    for w in windows:
        sl = pos[w["start"]:w["end"]].values
        sp[sl] = np.minimum(sp[sl], w["limit_frac"]*Plant().ac_cap_kw)
    return sp

def build_hidden(index, geom, start, loss):
    h = np.ones(len(index))
    if loss <= 0: return h
    on = (index >= pd.Timestamp(start)) & (geom["hour"] >= 13) & (geom["hour"] <= 16)
    h[on] = 1 - loss
    return h

def curtail_windows_summer(rng, index):
    """Illustrative curtailment shaped like the reported pattern: heavier in solar hours, spring/summer."""
    W = []
    days = pd.date_range(index[0].normalize(), periods=len(index)//24, freq="D")
    for d in days:
        mi = (d.month - 4) % 12
        p = {0:0.45,1:0.50,2:0.40,3:0.05,4:0.03,5:0.05,6:0.05,7:0.0,8:0.0,9:0.0,10:0.10,11:0.25}[mi]
        if rng.random() < p:
            sh = int(rng.integers(9, 12)); eh = int(rng.integers(14, 17))
            W.append({"start": str(d + pd.Timedelta(hours=sh)), "end": str(d + pd.Timedelta(hours=eh)),
                      "limit_frac": float(rng.choice([0.50, 0.60, 0.70])),
                      "label": "Grid curtailment (setpoint)"})
    return W

@dataclass
class Scenario:
    key: str; name: str; blurb: str; seed: int
    weather_scale: dict = field(default_factory=dict)       # month label -> kcs multiplier
    outages: list = field(default_factory=list)
    curtail: str = "light"                                  # light | heavy
    cleaning: list = field(default_factory=list)
    soil_rate_mult: float = 1.0
    hidden_start: str = "2025-10-01"; hidden_loss: float = 0.02
    derate_true: float = 0.955; deg_true_per_year: float = 0.008
    ghi_bias: float = 0.005; temp_bias: float = 0.2

def _clean_every(days, start="2025-04-10", end="2026-03-31", skip=()):
    return [str(d.date()) for d in pd.date_range(start, end, freq=f"{days}D") if str(d.date()) not in skip]

SCENARIOS = {
 "s0": Scenario("s0", "Baseline",
    "Near-normal weather, high availability, negligible curtailment - near-closed result.",
    seed=44,
    outages=[],
    curtail="light", cleaning=_clean_every(24, "2025-04-08", "2026-03-31"),
    hidden_start="2026-01-01", hidden_loss=0.0, derate_true=0.968, deg_true_per_year=0.005,
    ghi_bias=0.002, temp_bias=0.1),
  "s1": Scenario("s1", "Monsoon Miss",
    "Very weak monsoon irradiance, a delayed pre-monsoon cleaning, a 9-day two-inverter outage.",
    seed=11, weather_scale={"2025-07": 0.80, "2025-08": 0.78},
    outages=[{"start": "2025-08-12 06:00", "end": "2025-08-20 18:00", "n_down": 2, "label": "Inverter bank 3-4 transformer fault"}],
    curtail="light", cleaning=_clean_every(28, "2025-04-10", "2025-04-12") + ["2025-05-30"] + _clean_every(28, "2025-09-15", "2026-03-31"),
    soil_rate_mult=1.1, hidden_start="2025-10-01", hidden_loss=0.025, derate_true=0.955, deg_true_per_year=0.008, ghi_bias=0.005),
 "s2": Scenario("s2", "Curtailment Summer",
    "Normal weather but heavy grid curtailment in spring and early summer, one short outage.",
    seed=22, outages=[{"start": "2025-06-04 08:00", "end": "2025-06-08 17:00", "n_down": 1, "label": "Inverter 7 IGBT failure"}],
    curtail="heavy", cleaning=_clean_every(24, "2025-04-08", "2026-03-31"),
    hidden_start="2026-01-01", hidden_loss=0.015, derate_true=0.958, deg_true_per_year=0.007, ghi_bias=-0.004),
 "s3": Scenario("s3", "Silent Loss",
    "Weather, outages and curtailment look ordinary - but string failures nobody logged eat 6% of afternoon DC output.",
    seed=33, weather_scale={"2025-09": 0.93},
    outages=[{"start": "2025-11-03 09:00", "end": "2025-11-05 15:00", "n_down": 1, "label": "Inverter 2 fan fault"}],
    curtail="light", cleaning=_clean_every(30, "2025-04-12", "2026-03-31"),
    hidden_start="2025-09-01", hidden_loss=0.06, derate_true=0.952, deg_true_per_year=0.0095, ghi_bias=0.006),
}

@dataclass
class World:
    scenario: Scenario
    plant: Plant
    index: pd.DatetimeIndex
    geom: dict
    fc: dict            # forecast state per cause
    truth: dict         # true actual state per cause
    truth_hidden: np.ndarray
    meas: dict          # engine-visible actual state (derate filled in by calibration)
    a_meas: np.ndarray  # measured kWh per hour
    a_true: np.ndarray
    ghi_meas: np.ndarray; ghi_fc: np.ndarray; ghi_true: np.ndarray
    logs: dict
    flags: list
    hist: dict          # synthetic multi-year record for percentiles

N_HIST = 30

def _history(index, geom, plant, seed):
    """Synthetic stand-in for a multi-year reanalysis record (ERA5/NASA POWER pending licence check)."""
    ghi_sum = np.zeros((N_HIST, 12)); t_mean = np.zeros((N_HIST, 12))
    m = month_idx(index)
    for y in range(N_HIST):
        rng = np.random.default_rng(seed*1000 + y)
        g, t = gen_weather(index, geom, rng)
        for k in range(12):
            ghi_sum[y, k] = g[m == k].sum()/1000.0       # kWh/m2
            t_mean[y, k] = t[m == k].mean()
    return {"ghi_kwh_m2": ghi_sum, "t_mean": t_mean}

def build_world(key: str) -> World:
    sc = SCENARIOS[key]; plant = Plant()
    index = pd.date_range(FY_START, periods=N_HOURS, freq="h")
    geom = ph.geometry(index, plant)
    rng = np.random.default_rng(sc.seed)
    m = month_idx(index); n = len(index)

    # ---- forecast (financing P50): a representative stochastic year with climatological monthly means
    hist = _history(index, geom, plant, sc.seed + 9000)
    ghi_fc, t_fc = gen_weather(index, geom, np.random.default_rng(7), month_scale=False)
    # rescale the representative year so every month equals the multi-year mean (a P50 / typical year)
    for k in range(12):
        sel = m == k
        ghi_fc[sel] *= hist["ghi_kwh_m2"][:, k].mean() / (ghi_fc[sel].sum()/1000.0)
        t_fc[sel] += hist["t_mean"][:, k].mean() - t_fc[sel].mean()
    poa_fc = ph.ghi_to_poa(ghi_fc, geom, plant)
    fc = {"irradiance": poa_fc, "temperature": t_fc,
          "downtime": np.full(n, plant.fc_availability), "curtailment": np.full(n, BIG),
          "soiling": np.full(n, plant.fc_soiling),
          "degradation": np.full(n, plant.fc_degradation_per_year*plant.age_years),
          "model": np.full(n, plant.fc_derate)}

    # ---- truth weather (year-specific) with scenario anomaly
    kscale = np.ones(12)
    for lab, f in sc.weather_scale.items():
        kscale[MONTHS.index(lab)] = f
    ghi_true, t_true = gen_weather(index, geom, rng, month_scale=True, kcs_scale=kscale)
    poa_true = ph.ghi_to_poa(ghi_true, geom, plant)
    # ---- truth other states
    avail_true, ev = build_availability(index, sc.outages, rng)
    cw = curtail_windows_summer(rng, index) if sc.curtail == "heavy" else \
         [w for w in curtail_windows_summer(rng, index) if rng.random() < 0.25][:14]
    sp_true = build_setpoint(index, cw)
    base_rate = np.array([0.0025,0.0028,0.0022,0,0,0.0010,0.0014,0.0016,0.0016,0.0016,0.0018,0.0020])*sc.soil_rate_mult
    soil_true = build_soiling(index, sc.cleaning, base_rate, seed=sc.seed)
    deg_true = np.full(n, sc.deg_true_per_year*plant.age_years)
    derate_true = np.full(n, sc.derate_true)
    hidden = build_hidden(index, geom, sc.hidden_start, sc.hidden_loss)
    truth = {"irradiance": poa_true, "temperature": t_true, "downtime": avail_true, "curtailment": sp_true,
             "soiling": soil_true, "degradation": deg_true, "model": derate_true}
    a_true = ph.simulate(plant, poa_true, t_true, avail_true, sp_true, soil_true, deg_true, derate_true, hidden)

    # ---- what an owner actually observes
    rng2 = np.random.default_rng(sc.seed + 500)
    ghi_meas = ghi_true*(1 + sc.ghi_bias) * (1 + rng2.normal(0, 0.010, n))
    ghi_meas = np.where(ghi_true > 0, ghi_meas, 0.0)
    gaps = rng2.choice(np.where(geom["cosz"] > 0.2)[0], 40, replace=False)
    miss = np.zeros(n, bool); miss[gaps] = True
    # gap-fill with forecast-year irradiance at that hour (what a naive pipeline does)
    ghi_meas = np.where(miss, ghi_fc, ghi_meas)
    poa_meas = ph.ghi_to_poa(ghi_meas, geom, plant)
    t_meas = t_true + sc.temp_bias + rng2.normal(0, 0.3, n)
    soil_station = np.repeat(np.clip(soil_true[::24] + rng2.normal(0, 0.003, n//24), 0, None), 24)
    deg_meas = np.full(n, deg_true[0] + rng2.normal(0, 0.001))
    a_meas = a_true * (1 + rng2.normal(0, 0.002, n))
    meas = {"irradiance": poa_meas, "temperature": t_meas, "downtime": avail_true.copy(),
            "curtailment": sp_true.copy(), "soiling": soil_station, "degradation": deg_meas,
            "model": None}   # filled by calibration

    flags = [
        "SYNTHETIC DATA: plant, outages, curtailment and weather are simulated (weather shaped like Rajasthan, not measured).",
        f"Irradiance sensor: {int(miss.sum())} hours missing and gap-filled with forecast-year values.",
        "Soiling comes from a soiling station with unknown calibration bias.",
        "Tariff INR 2.70/kWh is an assumption, not a PPA figure.",
        "Curtailment profile is illustrative, shaped like reported 2026 patterns.",
    ]
    logs = {"outages": ev, "curtailment": cw, "cleaning": sc.cleaning, "missing_irradiance_hours": int(miss.sum())}
    return World(sc, plant, index, geom, fc, truth, hidden, meas, a_meas, a_true,
                 ghi_meas, ghi_fc, ghi_true, logs, flags, hist)
