"""Typed response contract (Pydantic). Invariant enforced in tests: sum(component kWh) + unexplained = gap, exactly."""
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List

class Component(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(description="Stable cause identifier")
    cause: str = Field(description="Human-readable cause name")
    kwh: float = Field(description="Signed contribution to the gap, kWh")
    inr: float = Field(description="Signed monetary impact, INR (kWh x tariff)")
    lower_kwh: float = Field(description="Lower uncertainty bound, kWh")
    upper_kwh: float = Field(description="Upper uncertainty bound, kWh")
    confidence: str = Field(description="high | medium | low")
    claimable: bool = Field(description="Potentially claimable flag (contract review required)")
    evidence_ids: List[str] = Field(description="Resolvable evidence record IDs")
    class_: Optional[str] = None

class Unexplained(BaseModel):
    model_config = ConfigDict(extra="allow")
    kwh: float = Field(description="Residual gap, kWh")
    inr: float = Field(description="Residual monetary impact, INR")
    lower_kwh: float = Field(description="Lower uncertainty bound, kWh")
    upper_kwh: float = Field(description="Upper uncertainty bound, kWh")
    exceeds_band: bool = Field(description="True when the residual exceeds its uncertainty band")

class Analysis(BaseModel):
    model_config = ConfigDict(extra="allow")
    plant_id: str; plant_name: str; period: str; period_start: str; period_end: str
    forecast_kwh: float = Field(description="Forecast energy, kWh")
    actual_kwh: float = Field(description="Metered actual energy, kWh")
    gap_kwh: float = Field(description="actual_kwh - forecast_kwh, kWh")
    tariff_inr_per_kwh: float = Field(description="Assumed tariff, INR/kWh")
    components: List[Component]; interaction: dict; unexplained: Unexplained
    weather_percentile: float = Field(description="Irradiance percentile vs reference years")
    data_quality_flags: List[str]
