# 01 --- Scope, Requirements, and Coding-Agent Rules

## 1. Product objective

Build a credible demo that answers: **Why did actual solar generation
differ from forecast, which causes can be supported by evidence, what
remains unexplained, and was the miss predictable, controllable,
weather-driven, or outside operator control?**

The chart alone is not the product. The prototype must demonstrate: 1.
Cause attribution that does not depend on the order causes are
evaluated. 2. A quantified and prominent unexplained remainder with a
confidence interval. 3. A verdict per cause: `predictable`,
`controllable`, `luck`, or `outside_operator_control`; optionally flag
potentially claimable curtailment. 4. A reproducible validation run
against known injected causes, including one deliberately hidden cause.

## 2. MVP scope

### Must implement

-   One synthetic solar PV plant, nominally 30 MWp (configurable).
-   A 12-month period with at least three prebuilt scenarios: baseline,
    operational underperformance, and curtailment-heavy.
-   Forecast and actual kWh, gap kWh, tariff assumption and monetary
    impact.
-   Six cause switches:
    1.  irradiance deviation
    2.  temperature deviation
    3.  equipment downtime
    4.  grid curtailment
    5.  soiling/degradation deviation
    6.  forecast model bias
-   Shapley-style attribution across all six binary switches (64
    coalition simulations per period).
-   Explicit interaction line and explicit unexplained remainder.
-   Confidence intervals for uncertainty, using Monte Carlo or a
    documented lightweight approximation if runtime constraints require
    it.
-   Cause classification, evidence references, confidence labels and
    weather percentile.
-   FastAPI API with Pydantic response models.
-   Validation endpoint/page or existing equivalent showing injected vs
    recovered values, hidden cause handling and reconciliation.
-   Report export as PDF, or a print-friendly page if time-constrained.
-   Tests for math invariants, deterministic output, API contracts,
    scenario data and hidden-cause behavior.
-   Minimal integration into the existing frontend without redesign.

### Explicitly out of scope

-   Authentication, user accounts, multi-tenancy, permissions.
-   Chatbot or open-ended AI root-cause generation.
-   PS 2 settlement/payment or contract-rule engine.
-   PS 4 role-based views.
-   Mobile app.
-   ML forecasting experiments.
-   Production SCADA integrations.
-   Claims that a cause is legally compensable.
-   Real plant data unless provided and approved.

## 3. Required user flow

1.  User opens the existing app and selects one of three prebuilt
    scenarios and a reporting period.
2.  Existing UI requests an analysis from the backend.
3.  Backend returns forecast, actual, gap, cause components,
    interaction, unexplained remainder, uncertainty bounds,
    classifications and evidence references.
4.  UI displays the existing dashboard/chart areas using these values.
5.  User opens a cause's evidence details and sees time window, source
    signals, formula, confidence and data-quality notes.
6.  User switches to validation and sees injected truth versus recovered
    attribution, error metrics, hidden-cause outcome and exact
    reconciliation.
7.  User exports or prints the investor variance report.

## 4. Non-negotiable frontend preservation

Before edits, capture a baseline: - current app route map - current
screenshot(s) or visual baseline if available - current package manifest
and lockfile - current global styles/theme tokens - existing chart
library and component conventions

Do not: - replace the frontend framework or bundler - replace the chart
library merely because this plan mentions another option - rewrite the
app shell/navigation - change colors, typography, spacing, component
styling or page structure - remove existing components or features - add
global CSS resets or theme changes - run broad automated formatting over
the frontend - change unrelated dependencies

Do: - add API client/service functions in the existing convention - map
API responses into existing component props - add only missing controls
or small additive sections required for the demo - use current design
tokens/components - add loading, empty and error states in the current
style - keep a small diff and explain every frontend file touched

If the current frontend does not contain a waterfall, evidence drawer,
classification view or validation view, do not invent a new visual
design. Implement the smallest functional addition consistent with
existing patterns and note it in the implementation log.

## 5. Demo data disclosure

All demo records and charts must visibly say **Synthetic demo data**. If
real historical weather is later added, distinguish it from synthetic
plant operations. Do not imply simulated curtailment is a verified event
at a real plant.

## 6. Definitions

-   `forecast_kwh`: expected energy for the selected period under
    forecast-time assumptions.
-   `actual_kwh`: simulated or measured actual energy for that period.
-   `gap_kwh = actual_kwh - forecast_kwh`. Negative means
    underperformance.
-   Cause contributions are signed contributions to the gap.
-   `interaction_kwh`: any explicit non-additive interaction component
    not included in the Shapley cause contributions under the chosen
    convention. The implementation must document this convention and
    test it.
-   `unexplained_kwh`: residual required to reconcile all reported
    contributions to the gap.
-   `money_inr = contribution_kwh * tariff_inr_per_kwh`. Preserve sign.
-   Confidence interval is an uncertainty band, not a guarantee.

## 7. Definition of done

A demo is done only when: - `GET /api/health` succeeds. - Scenario
listing and analysis endpoints work. - Same scenario/configuration
produces deterministic output unless a seed is explicitly changed. - All
six causes are represented in the contract, even if a scenario's
contribution is zero. - Reconciliation is exact under the API's
canonical numeric representation. - The unexplained bucket is always
present and prominent in data, including when it is zero. - The hidden
injected cause is not falsely assigned to a logged named cause by the
validation test. - The validation report provides per-cause errors and
overall metrics. - UI still looks like the original frontend; no
redesign occurred. - The report/print flow works. - README has
setup/run/test instructions and clearly labels demo data as synthetic.
