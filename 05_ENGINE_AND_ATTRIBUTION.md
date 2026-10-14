# 05 --- Core Engine: Simulator, Shapley Attribution, Interaction, Residual

## 1. Module boundaries

Keep the numerical core pure and testable: - `simulator.py`: calculate
generation for a configuration and coalition of switches. -
`attribution.py`: compute Shapley contributions. - `uncertainty.py`:
uncertainty perturbation and intervals. - `classification.py`: label
causes from rules/evidence. - `analysis_service.py`: orchestration and
API mapping.

No frontend code, API request objects, LLM calls or report rendering
inside the numerical engine.

## 2. Define the counterfactual carefully

Let `F` be the baseline forecast energy and `A` the actual simulated
energy. `G = A - F`.

For six causes, define a coalition simulator `v(S)` where each cause
switch is either set to forecast-time assumption (off) or actual
condition (on). The agent must explicitly define which coalition
represents the baseline and which represents actual. Ensure: -
`v(empty)` equals the selected baseline output. - `v(all_causes)` equals
the modelled actual output before any deliberately hidden cause. - cause
IDs map to exactly one switch. - no switch applies the same physical
loss twice.

If the hidden cause is intentionally omitted from the visible switch
set, it must reduce the observed/simulated actual output without
appearing in any coalition switch.

## 3. Shapley calculation

For cause `i` among `n=6` causes:
`phi_i = sum over S subset N\\{i} [ |S|! (n-|S|-1)! / n! ] * (v(S union {i}) - v(S))`

Implementation options: - Enumerate all subsets and calculate the exact
standard Shapley weights. - Or enumerate all 6! = 720 permutations and
average marginal contributions. The brief notes 64 coalition runs;
subset-based evaluation is preferred because it reuses coalition outputs
and computes exact Shapley values. - Cache all 64 coalition outputs per
analysis. - Keep a stable cause ordering for serialization, but
attribution values must not change if the order of cause definitions
changes.

## 4. Important interaction-term convention

A standard Shapley decomposition of `v(all)-v(empty)` already allocates
the total difference across the players and therefore sums to the total
game difference. Do not add an arbitrary "interaction" on top of that
total; doing so double-counts.

The brief asks for a separate interaction line. Implement one explicit
convention and document it: - Preferred prototype convention: use
Shapley values as the order-independent cause allocations; set
`interaction_kwh = 0` for the additive reconciliation layer and provide
a separate `interaction_diagnostics` object quantifying non-additivity
(for example, the difference between combined effects and the sum of
isolated effects). If the UI contract requires a visible interaction
bar, it may display the signed interaction diagnostic only if the cause
contributions are adjusted under a mathematically documented
decomposition that still sums exactly to the gap. - Alternative: use a
declared factorial/interaction decomposition where main effects plus
interaction terms are calculated together and sum to the total. This is
more complex and must have its own tests. - Never report a nonzero
interaction bar as a decorative value that is then ignored by the
reconciliation equation.

The contract should distinguish: `interaction.contribution_kwh`
(included in reconciliation) from `interaction_diagnostics`
(informational and not added again).

## 5. Unexplained residual

The hidden or unmodelled portion is:
`unexplained = gap - sum(cause contributions) - interaction contribution`.

This is a residual, not a cause. Never relabel it as "other". Keep sign
and amount. Include: - kWh - INR - share of absolute gap (with defined
behavior when gap is zero) - lower/upper confidence bounds - status:
`immaterial`, `material`, or `outside_expected_band` - data required to
reduce uncertainty

If the engine's modeled `v(all)-v(empty)` equals the observed gap and
Shapley is used across all six modeled switches, residual should only
contain the intentionally hidden cause plus numerical/model mismatch. If
residual is unexpectedly large, report it; do not force it to zero.

## 6. Numerical correctness

-   Use finite values only; reject NaN and infinity.
-   Keep full internal precision.
-   Define a canonical serialized precision.
-   Calculate `unexplained_kwh` after serialization of gap, components
    and interaction to guarantee displayed reconciliation.
-   Money = canonical kWh × tariff, rounded only at the reporting
    boundary.
-   Preserve signs consistently: negative cause contribution reduces
    generation versus forecast.
-   Do not clamp negative contributions to zero. A cause can improve
    generation relative to forecast.
-   Avoid rounding each hourly observation before aggregation.

## 7. Performance

Six binary switches require 64 coalition evaluations. Cache each
coalition output within a request. Do not rerun identical simulations.
Add a benchmark or a test asserting a reasonable local runtime, but do
not optimize prematurely.

## 8. Required tests

-   Empty coalition and full coalition match baseline/actual
    definitions.
-   Six causes always returned in stable schema order.
-   Shapley efficiency: sum(phi_i) equals `v(all)-v(empty)` within
    internal floating tolerance.
-   Cause ordering invariance.
-   Same seed is deterministic.
-   Each known injected cause moves the output in the expected
    direction.
-   Hidden cause does not become a seventh named cause.
-   Residual remains visible and captures hidden/model mismatch.
-   Canonical serialized reconciliation is exact.
-   No NaN/Infinity in response.
-   Negative/zero gap behavior works.
