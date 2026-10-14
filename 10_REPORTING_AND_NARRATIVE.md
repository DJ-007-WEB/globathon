# 10 --- Investor Report and Optional Narrative

## 1. Report requirements

One-click variance report must use the exact same canonical analysis
response as the UI. The report should contain: 1. Title and reporting
period. 2. Plant metadata and capacity. 3. Data disclosure: Synthetic
demo data, unless real inputs have been verified. 4. Forecast kWh,
actual kWh, gap kWh, tariff assumption and monetary impact. 5.
Attribution table with each named cause, kWh, INR, class, confidence and
claimable flag. 6. Interaction line and definition of interaction
convention. 7. Unexplained residual, confidence band, percentage of gap
and recommended missing data. 8. Weather percentile and reference
dataset. 9. Evidence details and source signals. 10. Methodology and
engine version. 11. Validation summary where applicable. 12. Limitations
and non-legal disclaimer.

## 2. PDF implementation

Preferred if time permits: - HTML template rendered to PDF with
WeasyPrint or Playwright, depending on dependencies and runtime
support. - If PDF setup is unreliable, implement a clean print
stylesheet or print-ready HTML page and call this a deliberate cut
line. - Do not create a second independent calculation path for the
report. - Use server-side generated report data, validate inputs and
avoid accepting arbitrary HTML from the client. - Escape all
user-controlled strings in templates.

## 3. Optional narrative layer

The brief suggests an LLM may turn engine-computed numbers into
plain-language explanations, but must not compute causes or invent
evidence. This is optional and should be cut before core correctness is
compromised.

If implemented: - Keep it behind a feature flag. - It receives a compact
structured analysis object and evidence summaries. - Prompt it to use
only supplied facts and not calculate or introduce numbers. - Validate
every number in generated text against allowed engine values; if any
number is not present/derivable, reject the narrative and use
deterministic templates. - Do not send secrets or unnecessary raw
operational data. - API key must be backend-only and stored in
environment variables. - If provider/API is unavailable, deterministic
templates must still work. - Do not build a chatbot.

## 4. Deterministic narrative fallback

Examples of allowed template logic: - "Actual generation was
{abs(gap_kwh)} kWh below forecast for {period}." - "Grid curtailment
contributed {cause_kwh} kWh under the current model; this is marked
potentially claimable and requires contract review." -
"{unexplained_kwh} kWh remains unexplained by the current six-cause
model. {recommended_data} could narrow the estimate."

Templates must preserve sign, units and uncertainty language. Avoid
claims such as "the grid operator owes the plant money" or "this loss is
definitely recoverable."
