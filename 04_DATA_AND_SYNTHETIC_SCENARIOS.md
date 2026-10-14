# 04 --- Data Plan and Synthetic Scenarios

## 1. Principle

The brief explicitly warns that real SCADA data is unlikely to be
available. Build a transparent synthetic plant layer and label it
clearly. Real historical weather may be used later from NASA POWER,
PVGIS or ERA5 only after checking availability, licence, resolution and
suitability. Do not block the prototype on external data.

## 2. Minimum time-series schema

Use hourly data if runtime permits; daily data is acceptable only if the
agent documents the loss of event-level fidelity. Hourly is preferred
for curtailment and downtime windows.

Fields: - `timestamp_utc` - `irradiance_forecast_w_m2` -
`irradiance_actual_w_m2` - `ambient_temperature_forecast_c` -
`ambient_temperature_actual_c` - `wind_speed_m_s` (optional, if
simulator uses it) - `availability_fraction` in \[0, 1\] -
`curtailment_fraction` in \[0, 1\] - `soiling_loss_fraction` in
\[0, 1) - `degradation_fraction` in \[0, 1) - `forecast_bias_fraction` -
`metered_actual_kwh` (simulated output) - `forecast_kwh` (baseline
output) - `data_quality_flags` - `event_ids`

For monthly presentation, aggregate hourly energy to month and full-year
totals only after the engine has modelled the hourly behavior.

## 3. Plant assumptions

-   Asset: solar PV.
-   Plant capacity: 30 MWp by default.
-   Location story: Rajasthan or Gujarat, but do not claim exact
    measured site weather unless sourced.
-   Twelve-month period.
-   Synthetic inverter groups (for example, 6 groups) with deterministic
    event logs.
-   Fixed illustrative tariff configurable per analysis, default INR
    2.7/kWh as an assumption, not a verified market tariff.

## 4. Scenarios

Implement at least three named scenarios with deterministic seeds.

### `baseline`

-   Near-normal irradiance and temperature.
-   High availability.
-   Small plausible soiling/degradation loss.
-   No or negligible curtailment.
-   Intended to show a near-closed forecast and actual result with small
    residual.

### `operational_underperformance`

-   One or more known inverter downtime windows.
-   Soiling ramp higher than the forecast-time assumption.
-   Small forecast model bias.
-   Intended to demonstrate controllable loss and predictable bias
    separately.

### `curtailment_heavy`

-   Curtailment during solar hours in several months.
-   At least one explicit curtailment event with start/end time and
    curtailment fraction.
-   Some weather variability and at least one outage to show attribution
    interactions.
-   Intended as the main demo scenario; highlight "outside operator
    control --- potentially claimable, contract review required".

### Validation-only hidden cause

Inject a known reduction not represented by any visible input signal or
logged event. This cause must be absent from the six named cause
switches. The engine should not confidently assign it to a named cause.
It should remain in the unexplained remainder or be reflected in
uncertainty. Validation must explicitly report the hidden cause's true
impact and recovered residual.

## 5. Generator behavior

-   All random generation must accept a seed.
-   Same seed + scenario + config must produce byte-for-byte stable
    logical output (ignore nondeterministic timestamps/IDs; prefer
    deterministic IDs).
-   Do not generate random values at import time.
-   Keep `generate_weather_series`, `generate_event_logs`, and
    `simulate_plant` separate.
-   Add schema checks for units, missing values, ranges and time order.
-   Store generated datasets in a reproducible format or generate them
    deterministically on demand. Do not commit large unnecessary data
    files.

## 6. Physical model

Use `pvlib` for accepted PV calculations where the selected model is
configured correctly. Do not present a hand-built formula as
pvlib-validated physics. If time or installation limits prevent a
complete pvlib model, implement a clearly named simplified model and
document limitations.

A reasonable model pipeline: 1. Convert irradiance and temperature
inputs into plane-of-array/effective irradiance and cell temperature if
data supports it. 2. Compute DC output or normalized potential energy.
3. Apply inverter/availability losses. 4. Apply
clipping/soiling/degradation assumptions. 5. Apply curtailment as a grid
export cap or curtailment fraction. 6. Integrate output to kWh. 7.
Forecast baseline uses forecast-time assumptions; actual counterfactual
uses actual inputs and logged events.

Avoid double-applying a loss. For example, if availability is already
applied in the simulator, do not subtract a second downtime percentage
afterward.

## 7. Evidence generation

Every known synthetic event should have: - deterministic event ID -
event type - start/end - affected inverter or plant-level scope -
severity/fraction - source signal name - whether the event is visible to
the attribution engine

Use event logs as evidence, not as ground truth that directly writes the
attribution output. Attribution must be recovered through simulator
counterfactuals.

## 8. External data policy

-   No credentials are required for the synthetic MVP.
-   If external weather download is implemented, make it optional and
    cache it.
-   Add source, retrieval date, units, licence note and location
    assumptions to metadata.
-   If data retrieval fails, fall back to synthetic weather with a
    visible disclosure; never silently present it as real.
