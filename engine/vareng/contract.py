"""Typed response contract (Pydantic). Invariant enforced in tests: sum(component kWh) + unexplained = gap, exactly."""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class Component(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str; cause: str; kwh: float; inr: float; lower_kwh: float; upper_kwh: float
    confidence: str; claimable: bool; evidence_ids: List[str]
    class_: Optional[str] = None

class Unexplained(BaseModel):
    model_config = ConfigDict(extra="allow")
    kwh: float; inr: float; lower_kwh: float; upper_kwh: float; exceeds_band: bool

class Analysis(BaseModel):
    model_config = ConfigDict(extra="allow")
    plant_id: str; plant_name: str; period: str; period_start: str; period_end: str
    forecast_kwh: float; actual_kwh: float; gap_kwh: float; tariff_inr_per_kwh: float
    components: List[Component]; interaction: dict; unexplained: Unexplained
    weather_percentile: float; data_quality_flags: List[str]
