# 02 --- Repository Audit and Execution Sequence

## Phase 0: Audit before coding

The agent must inspect the repository and report findings before making
changes.

### Inspect

-   Root tree and package manifests/lockfiles.
-   Frontend framework, routes, app shell, existing components, chart
    library and styling system.
-   Backend framework, existing API conventions, configuration and test
    framework.
-   Existing data files, mock fixtures, env examples, Docker setup and
    deployment config.
-   Existing visual state and which screens already exist.
-   Git status and current branch. Never overwrite uncommitted user
    work.

### Required audit output

Create `IMPLEMENTATION_LOG.md` with: - current architecture (actual, not
assumed) - frontend entry point and relevant components - backend entry
point and current endpoints - existing chart library/design system -
files proposed to add/change - files explicitly protected from
redesign - dependency gaps and rationale - risks or unresolved questions

Do not proceed with a frontend rewrite. If the repository structure is
unexpected, adapt the plan and preserve the current architecture.

## Phase 1: Contract and fixtures first

1.  Implement shared Pydantic schemas in the backend.
2.  Create one fixture JSON matching the response schema with plausible,
    internally reconciled values.
3.  Add contract tests for required fields, enums, numeric signs and
    reconciliation.
4.  Use this fixture to unblock frontend integration while the engine is
    being implemented.
5.  Keep fixture values visibly synthetic.

Suggested backend paths (adapt to repo conventions):

``` text
backend/
  app/
    main.py
    api/routes/
      health.py
      scenarios.py
      analysis.py
      validation.py
      reports.py
    schemas/
      analysis.py
      scenario.py
      validation.py
    services/
      analysis_service.py
      scenario_service.py
      report_service.py
    engine/
      simulator.py
      attribution.py
      uncertainty.py
      classification.py
      synthetic_data.py
    data/
      scenarios/
      fixtures/
  tests/
```

Do not create a second frontend or duplicate existing application
structure.

## Phase 2: Deterministic data and simulator

-   Implement scenario configuration and seeded synthetic time series.
-   Implement a pure simulator function with explicit input assumptions
    and cause switches.
-   Add unit tests before attribution.
-   Keep physics calculations separate from data generation and API
    code.

## Phase 3: Attribution and reconciliation

-   Implement all coalition simulations and Shapley contributions.
-   Define how the interaction term is calculated, rather than adding a
    decorative interaction bar.
-   Compute unexplained as a residual using a documented numeric
    convention.
-   Add order-independence and exact-reconciliation tests.

## Phase 4: Uncertainty and classifications

-   Add input perturbation/Monte Carlo intervals using deterministic
    seed support.
-   Compute historical weather percentile from the generated or supplied
    site reference distribution.
-   Add classification rules and evidence references.
-   Do not let an LLM or UI code assign numerical attribution.

## Phase 5: API

-   Add endpoints, validation, predictable error shapes and CORS
    restricted to configured frontend origins.
-   Add endpoint tests.
-   Ensure endpoint payloads can be consumed by the existing frontend
    without changing the UI architecture.

## Phase 6: Existing frontend integration

-   Add API client functions in the existing frontend convention.
-   Replace only the relevant mock data source/props with API data.
-   Preserve styles and layout.
-   Add loading/error/retry behavior matching current design patterns.
-   Keep a fixture fallback only if useful for offline demo, clearly
    labelled.

## Phase 7: Validation and report

-   Run injected-cause validation and return machine-readable metrics.
-   Implement PDF or print fallback.
-   Ensure all report numbers are sourced from the same analysis object
    shown in the UI.

## Phase 8: Demo hardening

-   Run backend and frontend tests.
-   Test all three scenarios.
-   Test malformed inputs and API unavailable state.
-   Confirm no secrets are committed.
-   Verify current frontend remains visually unchanged except for
    minimal functional additions.
-   Rehearse the demo using `12_DEMO_RUNBOOK_AND_CUT_LINES.md`.

## Git and implementation hygiene

-   Work on a feature branch if repository workflow supports it.
-   Never delete or overwrite existing user data to make tests pass.
-   Avoid adding libraries when standard library/current dependencies
    suffice.
-   Pin or constrain new dependencies consistently with existing
    conventions.
-   Record every changed file and why.
-   Do not claim a test passed unless it was run.
