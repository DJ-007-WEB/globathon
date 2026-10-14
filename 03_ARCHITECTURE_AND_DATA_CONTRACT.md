# 03 --- Architecture and Shared Data Contract

## 1. Logical architecture

``` text
Existing frontend (unchanged design)
    |
    | HTTP JSON
    v
FastAPI routes
    |
    +--> Analysis service
    |       +--> scenario/data loader
    |       +--> PV simulator
    |       +--> Shapley attribution
    |       +--> uncertainty engine
    |       +--> classification/evidence builder
    |
    +--> Validation service
    |       +--> injected ground truth
    |       +--> recovered attribution
    |       +--> error metrics
    |
    +--> Report service
            +--> same canonical analysis result
            +--> PDF or print-friendly output
```

Use a modular monolith for the prototype. Do not create distributed
services or a full database. Store scenario configuration and
time-series fixtures as Parquet/CSV/JSON; DuckDB may be used for
querying if useful. Keep data access behind a small interface so storage
can change later.

## 2. Source of truth

The engine output is the sole source of numerical truth. Frontend
components, report templates and narrative text must not recalculate
attribution independently.

Every analysis response should include: - schema version - scenario
metadata - plant and period - forecast, actual and gap - tariff
assumption - named cause components - interaction - unexplained
remainder and uncertainty - weather percentile - data-quality flags -
model/engine version and reproducibility seed - synthetic-data
disclosure

## 3. API contract

Suggested endpoints: - `GET /api/health` - `GET /api/scenarios` -
`GET /api/scenarios/{scenario_id}` - `POST /api/analysis` -
`GET /api/analysis/{analysis_id}` only if analysis persistence is
actually needed; otherwise avoid storing runs -
`POST /api/validation/run` - `GET /api/validation/{scenario_id}` if
cached deterministic validation is useful - `POST /api/reports/variance`
returning PDF bytes or a print-ready HTML response

Avoid requiring user accounts or a database.

### Analysis request

``` json
{
  "scenario_id": "curtailment_heavy",
  "period_start": "2026-01-01",
  "period_end": "2026-12-31",
  "tariff_inr_per_kwh": 2.7,
  "seed": 42
}
```

Validation: - `scenario_id` must exist in the scenario registry. - start
\<= end and period must overlap available data. - tariff must be finite
and \>= 0. - seed must be an integer in an allowed range. - reject NaN,
infinity, negative plant capacity and invalid switch values. - avoid
arbitrary user-provided file paths.

### Analysis response example

The numbers below are illustrative fixture values only. They must be
internally consistent when implemented.

``` json
{
  "schema_version": "1.0",
  "analysis_id": "demo-curtailment-heavy-2026",
  "data_disclosure": "Synthetic demo data",
  "engine_version": "0.1.0",
  "reproducibility_seed": 42,
  "plant": {
    "plant_id": "demo-solar-01",
    "name": "Demo Solar PV Plant",
    "capacity_mwp": 30.0
  },
  "period": {"start": "2026-01-01", "end": "2026-12-31"},
  "forecast_kwh": 52000000.0,
  "actual_kwh": 47800000.0,
  "gap_kwh": -4200000.0,
  "tariff_inr_per_kwh": 2.7,
  "gap_money_inr": -11340000.0,
  "components": [
    {
      "cause_id": "irradiance_deviation",
      "cause_name": "Irradiance deviation",
      "contribution_kwh": -900000.0,
      "money_inr": -2430000.0,
      "lower_kwh": -1100000.0,
      "upper_kwh": -700000.0,
      "classification": "luck",
      "confidence": "medium",
      "potentially_claimable": false,
      "evidence_ids": ["ev-weather-001"]
    }
  ],
  "interaction": {
    "contribution_kwh": 0.0,
    "money_inr": 0.0,
    "lower_kwh": 0.0,
    "upper_kwh": 0.0,
    "explanation": "Computed interaction under the documented attribution convention."
  },
  "unexplained": {
    "contribution_kwh": -300000.0,
    "money_inr": -810000.0,
    "lower_kwh": -500000.0,
    "upper_kwh": -100000.0,
    "gap_share_pct": 7.142857,
    "status": "material",
    "recommended_data": ["string-level status logs"]
  },
  "weather_percentile": {
    "value": 12.0,
    "reference": "synthetic multi-year site distribution",
    "interpretation": "12th percentile of the reference distribution"
  },
  "data_quality_flags": ["Synthetic plant operations"],
  "evidence": [
    {
      "evidence_id": "ev-weather-001",
      "cause_id": "irradiance_deviation",
      "time_start": "2026-04-10T00:00:00Z",
      "time_end": "2026-04-12T23:59:59Z",
      "signals": ["irradiance_actual", "irradiance_assumed"],
      "formula": "Simulator counterfactual marginal contribution averaged across coalitions",
      "confidence_reason": "Weather input is directly represented in the synthetic series."
    }
  ]
}
```

The sample is illustrative and not mathematically complete across all
six causes. The implementation must compute the final contract
dynamically and enforce reconciliation; do not copy these sample values
as the production fixture without balancing all components.

## 4. Canonical reconciliation convention

The API must define one canonical equation:
`gap_kwh = sum(component.contribution_kwh) + interaction.contribution_kwh + unexplained.contribution_kwh`.

Use decimal-safe serialization or a documented fixed precision.
Internally use float for simulation if appropriate, but convert values
to a canonical precision before building the response. Compute
unexplained from the serialized components and serialized interaction so
the displayed equation closes exactly. Do not alter named contributions
to force closure.

Recommended: retain full precision internally; serialize contribution
values to 6 decimal places; calculate the serialized unexplained
residual from the serialized gap and serialized other components; then
test the exact serialized equation. If money is rounded to two decimals,
calculate it from canonical serialized kWh and tariff, and document
rounding.

## 5. Cause identifiers and enums

Stable cause IDs: - `irradiance_deviation` - `temperature_deviation` -
`equipment_downtime` - `grid_curtailment` - `soiling_degradation` -
`forecast_model_bias`

Classification enum: - `predictable` - `controllable` - `luck` -
`outside_operator_control`

Confidence enum: - `high` - `medium` - `low`

Claimable flag: - boolean `potentially_claimable` - when true,
explanatory text must say contract review is required; it is not a legal
conclusion.

## 6. Evidence contract

Each evidence record should have: - `evidence_id` - `cause_id` -
start/end timestamps or period - source signals / synthetic event ID -
formula or counterfactual method - confidence rationale - data quality
flags - optional human-readable note derived from computed fields only

Avoid exposing internal filesystem paths, secrets, or raw stack traces
in API responses.
