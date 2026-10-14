# Globathon PS 3 --- Prototype Implementation Plan

## Purpose

This folder is the coding-agent execution contract for a demo-ready
prototype of **Explaining Performance Variance** for one synthetic solar
PV plant over 12 months.

**Non-negotiable constraint:** preserve the current frontend exactly as
it is. Do not redesign, restyle, replace, restructure, or rewrite
existing frontend pages/components. Implement the backend/core engine
and connect it to the existing UI with the smallest necessary
integration changes. If a required screen does not already exist, first
document the gap and implement only the minimum additive component
needed to demonstrate the feature, following the current design system.

The source problem brief says the demo must explain
forecast-versus-actual generation, attribute losses to named causes,
keep unexplained variance visible, classify causes, and validate
attribution against injected synthetic ground truth. It explicitly
excludes chatbot, accounts, multi-tenancy, PS 2 settlement, PS 4 role
views, mobile app, and ML forecasting experiments.

## Read these files in order

1.  `01_SCOPE_AND_AGENT_RULES.md` --- scope, assumptions, guardrails,
    definition of done.
2.  `02_REPOSITORY_AUDIT_AND_EXECUTION.md` --- inspect the actual repo
    before editing, implementation sequence and Git hygiene.
3.  `03_ARCHITECTURE_AND_DATA_CONTRACT.md` --- components and API
    contract shared between backend and frontend.
4.  `04_DATA_AND_SYNTHETIC_SCENARIOS.md` --- inputs, synthetic data,
    scenario definitions and evidence.
5.  `05_ENGINE_AND_ATTRIBUTION.md` --- simulator, Shapley attribution,
    interaction and exact reconciliation.
6.  `06_UNCERTAINTY_CLASSIFICATION_AND_EVIDENCE.md` --- uncertainty,
    weather percentile, confidence and claimable rules.
7.  `07_FASTAPI_BACKEND.md` --- endpoints, validation, errors,
    configuration and security.
8.  `08_FRONTEND_INTEGRATION_NO_REDESIGN.md` --- connect existing
    frontend without changing its design.
9.  `09_VALIDATION_TESTING_AND_ACCEPTANCE.md` --- test strategy,
    injected ground truth and demo acceptance.
10. `10_REPORTING_AND_NARRATIVE.md` --- PDF/print report and optional
    constrained narrative.
11. `11_ENVIRONMENT_DEPLOYMENT_AND_SECURITY.md` --- environment
    variables, local run, deployment and secrets.
12. `12_DEMO_RUNBOOK_AND_CUT_LINES.md` --- three-minute demo and scope
    cuts.

## Execution rules for the coding agent

-   Begin with a repository audit. Do not assume framework, routes,
    component names, or existing data shapes until inspected.
-   Keep the current frontend intact. No broad UI changes, no
    design-system replacement, no global CSS changes, no layout rewrite,
    and no dependency churn unless strictly required.
-   Write down the current frontend entry points and API assumptions
    before making changes.
-   Build the core engine and a stable fixture/API contract before
    wiring UI.
-   Every number displayed by the frontend must come from the
    deterministic engine/API or be clearly labelled as illustrative.
    Never invent causes in an LLM.
-   Synthetic data must be labelled **Synthetic demo data** anywhere a
    user could mistake it for real operational data.
-   Do not claim legal entitlement to curtailment compensation. Use
    "Potentially claimable --- contract review required".
-   Never silently force the reconciliation to close by modifying a
    named cause. The unexplained remainder is the explicit residual.
-   Run tests after each phase and record commands/results in
    `IMPLEMENTATION_LOG.md`.
-   If the repo conflicts with a recommendation in these docs, preserve
    existing working conventions and document the deviation rather than
    undertaking a broad rewrite.

## Suggested implementation log

Create `IMPLEMENTATION_LOG.md` in the repository with: - phase and
date/time - files changed - commands run - tests and results -
assumptions/deviations - known issues and next action

## Source grounding

This plan follows the supplied "Globathon PS 3: Explaining Performance
Variance" document (prepared 12 Oct 2026). That brief recommends one
solar PV plant, 12 months, six cause switches, order-independent
Shapley-style attribution, a visible unexplained bucket with
uncertainty, cause classification, and synthetic ground-truth
validation. Confirm the official PS card and asset type before locking
scope.
