# 09 --- Validation, Tests, and Acceptance Criteria

## 1. Validation is a core feature, not optional polish

The supplied brief says the demo should show known injected causes,
recover them, and refuse to invent the hidden cause. The validation page
is mandatory even if PDF and Monte Carlo depth are cut.

## 2. Ground-truth dataset

Create a deterministic test dataset with known values for: - irradiance
anomaly - temperature anomaly - inverter downtime window and duration -
curtailment window/fraction - soiling ramp - forecast bias - one hidden
loss not represented by a visible signal or switch

Record injected truth in a separate ground-truth structure unavailable
to the attribution function during analysis. Keep it available to the
validation evaluator only. This prevents leakage.

## 3. Metrics

For each known cause: - injected loss kWh - recovered attribution kWh -
absolute error kWh - relative error percentage only if injected
magnitude is above a safe denominator threshold - confidence interval
coverage (whether injected truth falls within the interval)

Overall: - mean absolute error across known causes - total known-cause
error - hidden cause true loss - unexplained residual - hidden-cause
capture ratio (with sign conventions documented) - exact reconciliation
pass/fail - validation timestamp/version/seed

Because Shapley contributions allocate interactions, injected physical
losses and recovered attribution need not match one-to-one in every
scenario. Document this. The acceptance threshold should be based on the
simulator design and interaction behavior rather than inventing an
arbitrary perfect-recovery promise.

## 4. Test layers

### Unit tests

-   PV simulator units/ranges and deterministic seed.
-   All cause switches independently affect output.
-   Coalition output cache uses 64 unique masks.
-   Shapley formula on a small hand-checkable cooperative game.
-   Shapley efficiency.
-   Order invariance.
-   Interaction diagnostic convention.
-   Unexplained residual and zero-gap behavior.
-   Confidence interval quantiles.
-   Weather percentile empirical-rank convention.
-   Classification rules.
-   Evidence IDs resolve to records.

### Integration tests

-   health/scenarios/analysis/validation/report routes.
-   Pydantic response schema.
-   bad request handling.
-   CORS config.
-   frontend API client mapping if frontend tests exist.

### End-to-end/manual checks

-   baseline scenario
-   operational underperformance scenario
-   curtailment-heavy scenario
-   cause evidence details open correctly
-   validation run displays injected/recovered results
-   unexplained bar remains visible
-   report export works
-   API outage displays recoverable error
-   frontend visual baseline remains unchanged

## 5. Exact reconciliation test

After canonical serialization:
`gap_kwh == sum(components[].contribution_kwh) + interaction.contribution_kwh + unexplained.contribution_kwh`

Test using the actual serialized response values, not internal floats.
If decimal JSON values are parsed as binary floats, use a fixed
canonical precision or Decimal in the assertion. The user-facing
equation must close with no hidden rounding trick.

## 6. Acceptance gates

### Gate A --- Engine

-   deterministic simulator
-   six causes
-   64 coalition outputs
-   Shapley efficiency/order invariance tests pass
-   residual is explicit
-   no invalid numeric values

### Gate B --- API

-   documented endpoints work
-   stable response schema
-   input validation and errors tested
-   health endpoint succeeds

### Gate C --- Validation

-   known injections evaluated against truth
-   hidden cause not added to named cause list
-   residual reports the unexplained part
-   reconciliation passes

### Gate D --- Frontend

-   existing frontend design preserved
-   data loaded from API
-   cause evidence and classifications work
-   validation visible
-   errors handled

### Gate E --- Demo

-   all three scenarios run
-   report/print flow works
-   synthetic disclosure is visible
-   demo completes in three minutes

## 7. Test commands

Adapt to the repository: - Python: `pytest -q` - Backend startup:
`uvicorn app.main:app --reload` - Frontend: use the existing package
scripts, discovered from package.json - Integration: run backend and
frontend, then use the existing browser/test tooling if available

Do not invent package scripts. Inspect manifests first.
