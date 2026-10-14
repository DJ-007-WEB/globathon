# Method
1. Forecast F = simulator with all 7 causes at forecast-time state (typical-year irradiance/temperature, 99.5% availability, no curtailment, 2% soiling, 0.5%/yr degradation, financing derate 0.970).
2. Actual state = measured inputs (irradiance sensor, temperature, inverter log, setpoint log, soiling station, flash test) + derate calibrated on clean unconstrained high-irradiance hours of the first 21 days.
3. Evaluate all 2^7 on/off coalitions; Shapley value per cause = average marginal contribution over all 5,040 orderings.
4. Unexplained U = metered actual − simulated actual. Σ Shapley + U = gap exactly.
5. Monte Carlo (80 runs): perturb irradiance bias (sd 1%), temperature offset (sd 0.8°C), soiling offset (sd 0.4 pts), flash-test error (sd 0.1 pts), meter (sd 0.3%); recalibrate; 5–95% band. Unexplained flagged when its band excludes zero.
6. Classes: irradiance/temperature = luck (flagged *extreme* if outside p10–p90 of 30 synthetic years); downtime, soiling = controllable; degradation, model bias = predictable; curtailment = outside operator control, flagged potentially claimable (no legal conclusion).
7. Validation: truth world has the hidden cause as an 8th switch (256 coalitions); compare per-cause truth vs recovered.
