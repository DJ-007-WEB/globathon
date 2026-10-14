# 08 --- Frontend Integration (Preserve Existing UI)

## Highest priority instruction

**Do not change the current frontend design.** The implementation agent
must work with the existing frontend rather than create a new dashboard.
No redesign, theme changes, layout changes, typography/color changes,
component replacement or global CSS changes.

## 1. Before editing

Inspect and record: - framework and app entry point - route/navigation
structure - existing plant/scenario selector, charts, cards, evidence
panels, classification and validation surfaces - chart library and
existing chart wrapper - styling approach and tokens - existing mock
data/API client - error/loading state patterns

Take a baseline screenshot if the environment supports it. Save it
outside production source or in the implementation notes.

## 2. API integration

Add a thin API client in the existing convention,
e.g. `src/services/varianceApi.ts` (path is illustrative; use actual
repository layout). It should expose: - `getHealth()` -
`getScenarios()` - `getScenario(id)` - `runAnalysis(request)` -
`runValidation(request)` - `getVarianceReport(request)`

Requirements: - base URL comes from an environment variable such as
`VITE_API_BASE_URL` or `NEXT_PUBLIC_API_BASE_URL`, based on the actual
frontend framework. - no hard-coded localhost URL in production code. -
centralize error parsing. - add request timeout/abort handling if the
app already uses it. - validate/normalize response fields before
rendering if existing conventions support it. - never calculate Shapley
attribution in the browser.

## 3. Map data into existing components

Reuse existing components and props wherever possible: - forecast/actual
headline values - gap and monetary impact - waterfall bars for six
causes + interaction + unexplained - evidence details for each cause -
class/confidence/claimability labels - weather percentile - validation
injected-vs-recovered table/chart - report download/print action

If existing components expect different field names, add a mapping
layer. Do not distort the backend contract to fit accidental UI variable
names; keep a clean API model and map at the boundary.

## 4. Missing UI elements

If a required feature is absent: 1. State what is missing in
`IMPLEMENTATION_LOG.md`. 2. Search for a current component pattern that
can be reused. 3. Add the smallest additive component/section consistent
with current styling. 4. Do not rework the overall page. 5. Keep all
existing routes and navigation working.

A simple tab or section may be added only if needed to reach validation.
It must use the existing navigation/layout convention.

## 5. Chart behavior

-   Use the chart library already installed.
-   Preserve existing chart styling.
-   Signed negative contributions must be visually represented
    correctly.
-   Unexplained should be as prominent as named causes, not hidden in
    "Other".
-   Provide a text/table alternative or accessible labels.
-   Tooltips/evidence details must use API values, not recalculate
    values.
-   Ensure the displayed values reconcile to the headline gap.

## 6. Loading, errors, and offline demo

-   Show a loading state in the existing UI style.
-   Show a recoverable error with retry if API fails.
-   If using a fixture fallback, make it an explicit demo mode and
    display "Synthetic demo data --- fixture fallback". Never silently
    substitute fixture data for live API output.
-   Do not break the app if an optional narrative/report feature is
    unavailable.

## 7. Visual regression checks

Compare before/after: - app shell - navigation - typography/colors -
spacing and layout - existing charts and cards - mobile/responsive
behavior already supported

Expected changes are data values and minimal new functional affordances
only. Any broad visual change is a bug and must be reverted.
