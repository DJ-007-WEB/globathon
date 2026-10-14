# 12 --- Three-Minute Demo Runbook and Priorities

## 1. Demo objective

Show that the engine explains a forecast miss, exposes uncertainty
honestly, separates controllable from uncontrollable causes, and
validates its attribution against injected truth. The validation is the
credibility centerpiece.

## 2. Three-minute sequence

### 0:00--0:20 --- Select the bad month/scenario

-   Open the existing frontend.
-   Select `curtailment_heavy`.
-   Point out "Synthetic demo data".
-   State the selected period and plant capacity.

### 0:20--0:45 --- Headline variance

-   Show forecast, actual, gap kWh and illustrative INR impact.
-   Explain sign convention: negative gap means actual below forecast.

### 0:45--1:25 --- Attribution and curtailment evidence

-   Show the waterfall with six causes, interaction convention and
    unexplained.
-   Open grid curtailment evidence: time windows, curtailment signal,
    contribution, confidence and "Potentially claimable --- contract
    review required".
-   State clearly that the flag is not a legal determination.

### 1:25--1:55 --- Unexplained

-   Point to the prominent unexplained bucket and its uncertainty band.
-   Show what missing data could narrow it.
-   Explain that the system does not force unknown loss into a named
    category.

### 1:55--2:30 --- Validation

-   Open validation results.
-   Show injected versus recovered causes and error metrics.
-   Show that the hidden cause is not invented as a named cause and
    remains in the residual/uncertainty.
-   Show exact reconciliation pass.

### 2:30--3:00 --- Report

-   Export PDF or open print-ready report.
-   Point out methodology, confidence, evidence and synthetic-data
    disclosure.

## 3. Hard questions to prepare

-   Why Shapley? Because sequential attribution depends on order;
    Shapley averages marginal contributions across coalitions.
-   Does Shapley prove physical causality? No. It allocates modelled
    differences under the chosen simulator and assumptions; evidence and
    validation matter.
-   Why unexplained? Because the model should not invent explanations
    when data is insufficient.
-   Why synthetic data? Operational SCADA data is not assumed available;
    synthetic ground truth lets the team test whether known causes are
    recovered.
-   Is curtailment legally claimable? The system only flags it for
    contract/regulatory review.
-   What is novel? Not the waterfall; the combination of
    order-independent attribution, visible residual/uncertainty,
    investor-facing classification and injected-ground-truth validation
    is the product hypothesis.
-   What are the limitations? Synthetic plant operations, simplified
    assumptions, limited historical weather reference, no contract
    engine, and no real SCADA validation.

## 4. Cut lines if time runs short

Cut in this order: 1. PDF becomes a print-friendly page. 2. Monte Carlo
sample count is reduced or intervals use a documented simple range. 3.
Claimable flag is dropped if it cannot be responsibly supported. 4.
Scenario count shrinks to two.

Never cut: - exact reconciliation - visible unexplained bucket -
validation page/run - synthetic data disclosure - preserving the
existing frontend design

## 5. Final pre-demo checklist

-   [ ] Frontend unchanged visually except minimum additive integration.
-   [ ] Backend health check passes.
-   [ ] Three scenarios are selectable, or documented cut to two.
-   [ ] All six causes appear in the response.
-   [ ] Attribution is order-independent.
-   [ ] Interaction convention is explicit and not double-counted.
-   [ ] Unexplained is prominent and has a band/status.
-   [ ] Hidden cause is not falsely named.
-   [ ] Reconciliation closes exactly on serialized values.
-   [ ] Evidence details open for each cause.
-   [ ] Claimability wording includes contract review.
-   [ ] Report/print works.
-   [ ] No secrets in Git.
-   [ ] All tests were actually run and results recorded.
-   [ ] Every demo value is clearly labelled synthetic unless verified
    otherwise.
