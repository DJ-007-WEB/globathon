# 11 --- Environment, Deployment, and Security

## 1. Environment variables

Add all required variables to `.env.example` or the repository's
existing example file. Never commit real credentials.

Suggested variables (include only those actually used):

``` dotenv
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=8000
FRONTEND_ORIGINS=http://localhost:3000,http://localhost:5173
DEFAULT_TARIFF_INR_PER_KWH=2.7
DEFAULT_SCENARIO_ID=curtailment_heavy
DEFAULT_RANDOM_SEED=42
MONTE_CARLO_SAMPLES=250
MAX_MONTE_CARLO_SAMPLES=2000
MAX_ANALYSIS_DAYS=366
ENABLE_NARRATIVE=false
NARRATIVE_PROVIDER_API_KEY=
VITE_API_BASE_URL=http://127.0.0.1:8000
# or NEXT_PUBLIC_API_BASE_URL for Next.js; use the correct one, not both by default
```

Only keep frontend variables relevant to the actual framework. Public
frontend variables must never contain secrets. The API key is optional
and should not be required for core functionality.

## 2. Secret handling

-   `.env` must be gitignored.
-   `.env.example` contains placeholders only.
-   Never put API keys in frontend source, client bundles, logs,
    screenshots or generated reports.
-   Do not ask for credentials for the synthetic prototype.
-   Validate config at startup and fail with a clear message for invalid
    ranges.
-   Avoid printing the full environment in logs.

## 3. Input safety

-   Validate all request fields and numeric ranges.
-   Limit date range and Monte Carlo sample count.
-   Reject path traversal and do not accept raw file paths from clients.
-   Restrict uploads to explicit allowlisted types and sizes if uploads
    are added; uploads are not required for MVP.
-   Escape report template values.
-   Restrict CORS to configured origins.
-   Do not expose stack traces to clients.
-   Do not store personal data or add authentication to a no-account
    demo.

## 4. Local development

Document exact commands based on actual repo structure. Typical backend:

``` bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\\Scripts\\Activate.ps1
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Typical frontend command must be taken from existing `package.json`; do
not assume it is `npm run dev`.

## 5. Deployment

-   Keep frontend hosting/deployment configuration as-is.
-   Deploy API to the existing or simplest suitable host
    (Render/Railway/Fly or Docker) only if demo deployment is needed.
-   Configure frontend API base URL and backend allowed origin.
-   Use HTTPS in deployed environments.
-   Do not add a database unless a concrete feature requires
    persistence.
-   Include health checks and deterministic demo scenarios.
-   Ensure build/start commands match the actual repository.

## 6. Docker

Only add Docker/Docker Compose if it helps reproduce the demo. Avoid
changing an existing Docker setup unnecessarily. If added: - non-root
runtime user where practical - pinned dependencies - no secrets baked
into image - health check - minimal base image and build context -
`.dockerignore` excluding `.env`, `.git`, virtualenvs, caches and large
local data
