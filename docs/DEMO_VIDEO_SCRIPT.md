# Demo video script (about 3 minutes)

**Demo login:** `demo@solarsleuth.app` / `Demo@1234` (or create your own account; saved in this browser only).
Run: `cd frontend && python -m http.server 8000` (offline snapshots) or start the API in `engine/` (`uvicorn api:app`) and open it.

1. **Landing (0:00)**: problem in one line, then click *Open the live demo*.
2. **Sign in (0:20)**: show the demo credentials card, click *Use demo login*. Optionally show a wrong password error and the Create account validation.
3. **Overview (0:40)**: forecast vs actual, the gap, the unexplained remainder.
4. **Variance analysis (1:00)**: waterfall of causes, click a bar for evidence, note that the sum closes to the gap.
5. **Cause classification (1:30)**: predictable / controllable / luck, plus the curtailment "potentially claimable" flag.
6. **Data upload (1:50)**: *Try a broken file* (clear row-level errors), then *Load valid sample* (reconciliation waterfall with hatched Unexplained).
7. **Validation lab (2:20)**: injected truth recovered, hidden 8th cause surfaces as unexplained.
8. **Investor report (2:40)**: reproducible summary; close on the avatar menu, then Sign out.
