# 06 --- Uncertainty, Classification, Confidence, and Evidence

## 1. Uncertainty bands

The prototype should quantify uncertainty around contributions and the
unexplained remainder. Use Monte Carlo perturbations of inputs such
as: - irradiance measurement/reanalysis error - temperature sensor
error - availability event duration/severity uncertainty - curtailment
fraction uncertainty - soiling/degradation parameter ranges - simulator
parameter uncertainty

For each sample: 1. Sample uncertain inputs from documented
ranges/distributions. 2. Re-run analysis with deterministic random seed
support. 3. Record each cause contribution and residual. 4. Report a
central estimate and lower/upper quantiles, preferably 5th and 95th
percentiles. 5. Explain the interval as a model/input uncertainty band,
not a probability that the cause is legally or causally proven.

Use a configurable sample count. For a demo, a few hundred samples may
be sufficient if runtime allows. If Monte Carlo is too slow, lower
sample count or use a transparent range-based approximation and label
it; do not fabricate statistical precision.

## 2. Confidence label rules

Implement explicit rules in code and document them. Suggested starting
point: - `high`: direct event/input signal exists, coverage is adequate,
counterfactual has been tested, and interval is relatively narrow. -
`medium`: evidence exists but includes parameter assumptions, partial
coverage or moderate uncertainty. - `low`: cause inferred indirectly,
required signals are missing, event duration/severity uncertain, or
interval is broad.

Confidence is not the same as contribution magnitude. A large loss can
have low confidence; a small measured loss can have high confidence.

## 3. Cause classification

Classification rules should be transparent and cause-specific.

  ---------------------------------------------------------------------------------
  Cause                   Default class              Notes
  ----------------------- -------------------------- ------------------------------
  Forecast model bias     predictable                Indicates
                                                     forecast/underwriting
                                                     assumption bias; not
                                                     necessarily operator fault

  Soiling/degradation     predictable                Cleaning cadence can be
  versus assumption                                  controllable, but the
                                                     deviation from a financing
                                                     assumption is forecastable;
                                                     document which interpretation
                                                     is used

  Equipment downtime      controllable               Downtime may not always be
                                                     avoidable; use controllable as
                                                     a default demo category, with
                                                     confidence/evidence caveat

  Grid curtailment        outside_operator_control   `potentially_claimable=true`
                                                     only as a prompt for contract
                                                     review, never a legal
                                                     conclusion

  Irradiance deviation    luck if within historical  If extreme, label as extreme
                          distribution               weather/event rather than
                                                     normal luck

  Temperature deviation   luck if within historical  Document whether unusually
                          distribution               high temperatures are outside
                                                     normal variability
  ---------------------------------------------------------------------------------

Do not force a single simplistic rule if the evidence contradicts it.
For the prototype, show a primary class and a brief rule rationale.

## 4. Weather percentile

Compare selected-period irradiance against a multi-year reference
distribution for the same site/season: - For monthly analysis, compare
with the same calendar month across the available historical years. -
For a full-year analysis, compare with annual totals from reference
years. - Compute percentile using a documented empirical rank
convention. - If only synthetic reference years are available, say
`synthetic reference distribution`. - Do not say "lowest 12% of the last
20 Julys" unless 20 July observations actually exist in the dataset.

Weather percentile should be associated with irradiance/weather
conditions, not with the total energy gap.

## 5. Evidence drawer data

Every cause needs evidence IDs that resolve to evidence records.
Evidence should show: - cause and amount - period/time windows -
relevant signals - event records if applicable - counterfactual
formula/method - confidence and rationale - source/data disclosure -
missing data that would improve attribution

Suggested missing-data messages: - equipment downtime: "String-level or
inverter-level status logs would narrow this estimate." - curtailment:
"Grid setpoint, dispatch instruction or curtailment notice would improve
event confidence." - irradiance: "On-site irradiance sensor calibration
or higher-resolution local weather data would narrow this interval." -
soiling: "Cleaning logs or soiling sensor measurements would improve
separation from degradation." - forecast bias: "Original forecast inputs
and model version would allow direct forecast-bias testing."

## 6. Claimability

Only grid curtailment should default to potentially claimable in the
demo, and even then: - label: `Potentially claimable` - subtext:
`Contract and regulatory review required` - do not predict compensation
amount as an entitlement - do not give legal advice or assert a
guaranteed recovery - do not build PS 2 settlement logic

## 7. Unexplained presentation

Always return the unexplained record. If its absolute value exceeds its
uncertainty band or a documented materiality threshold, status should
call this out. Do not hide it behind a tooltip or merge it into "other".
Return recommended data inputs that could reduce it.
