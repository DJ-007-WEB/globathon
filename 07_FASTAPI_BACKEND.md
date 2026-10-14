# 07 --- FastAPI Backend Implementation

## 1. Framework and dependencies

Use the repository's existing backend framework if one exists. If
starting a backend from scratch, use Python 3.12, FastAPI and Pydantic.
Core numerical dependencies from the brief: pvlib, numpy, pandas or
polars, scipy. Use DuckDB/Parquet only if useful. Avoid unnecessary
database infrastructure.

Create a pinned or bounded dependency file using the repo's current
convention. Do not install every suggested library blindly.

## 2. Routes

### `GET /api/health`

Returns:

``` json
{"success": true, "data": {"status": "ok", "service": "variance-engine"}}
```

### `GET /api/scenarios`

Returns scenario IDs, labels, descriptions, period coverage, data
disclosure and demo suitability.

### `GET /api/scenarios/{scenario_id}`

Returns scenario metadata and data-quality assumptions. Do not expose
private filesystem paths.

### `POST /api/analysis`

Input: `scenario_id`, optional start/end, tariff, seed. Output: the
shared analysis contract in `03_ARCHITECTURE_AND_DATA_CONTRACT.md`.

Processing: 1. Validate request. 2. Load/generate scenario data
deterministically. 3. Run baseline/actual simulation. 4. Compute Shapley
values and interaction diagnostic. 5. Compute uncertainty bands and
classifications. 6. Create evidence records. 7. Canonicalize numbers and
calculate residual. 8. Assert reconciliation before returning. 9. Log a
correlation/request ID and runtime without logging secrets or full
sensitive data.

### `POST /api/validation/run`

Input: scenario ID and optional seed/sample configuration. Output: -
injected cause truth - recovered attribution - per-cause absolute error
and relative error where denominator is meaningful - aggregate error
metric - hidden cause magnitude - unexplained residual response -
reconciliation result - test status

Do not claim validation success solely because the API returned 200. The
validation service must compare computed output to stored injected
truth.

### `POST /api/reports/variance`

Accept either an analysis request or an analysis result identifier. For
a simple stateless prototype, accept the analysis payload after schema
validation or recompute from the request. Prefer recomputing from a
validated request to avoid trusting arbitrary client-submitted figures.
Return PDF bytes with correct content type and filename, or a
print-ready HTML page if PDF implementation is deferred.

## 3. Error contract

Return predictable errors:

``` json
{
  "success": false,
  "error": {
    "code": "INVALID_ANALYSIS_REQUEST",
    "message": "The analysis request is invalid.",
    "details": [{"field": "tariff_inr_per_kwh", "reason": "must be >= 0"}],
    "request_id": "..."
  }
}
```

Do not expose stack traces in production responses. Log full exception
details server-side without secrets.

## 4. CORS

-   Configure allowed origins through environment variable.
-   Allow only the configured frontend origin(s), not wildcard origins
    with credentials.
-   Permit only needed methods/headers.
-   Do not add credentials unless authentication is actually in scope
    (it is not).

## 5. Runtime and API quality

-   Set request timeouts/limits for expensive Monte Carlo runs.
-   Bound period length and sample count.
-   Use synchronous computation if it remains fast; do not add a queue
    for a small demo.
-   Use a deterministic seed for repeatable results.
-   Add OpenAPI descriptions for each endpoint.
-   Include units in schema descriptions (`kWh`, `INR/kWh`, `MWp`,
    Celsius, W/m²).
-   Return UTC timestamps or ISO dates consistently.

## 6. Backend test expectations

-   Route health check.
-   Valid and invalid analysis requests.
-   Unknown scenario returns 404.
-   Invalid dates/tariff/seed returns 422 or documented client error.
-   API schema serialization and all enums.
-   Reconciliation invariant on every scenario.
-   Validation route detects a deliberately corrupted expected value in
    a test.
-   Report endpoint has expected content type and non-empty output.
-   CORS configuration reads allowed origins from env.
