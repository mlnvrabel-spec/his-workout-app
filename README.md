# Hypertrophy Protocol Dashboard

## Run locally

Use two terminals from the repository root.

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn main:app --app-dir backend --reload --port 8001
```

```powershell
python -m http.server 3000
```

Open `http://localhost:3000`. The frontend expects the FastAPI Garmin bridge at `http://localhost:8001`.

## Checks

```powershell
npm.cmd ci
npm.cmd run verify
python backend/test_api.py
python -m compileall -q backend
```

The provider-neutral agent setup is verified together with the frontend checks:

```powershell
npm.cmd run verify
```


## Workout behavior

Finish checks every remaining exercise, saves the named day, and leaves it visible
with one Undo action. Undo reopens that day with an empty checklist while retaining
subsequent progress, including a draft of the next cycle. The next unfinished day
is ready in the flow. Open an exercise to log sets, and use the history control to
review or export local data.

The service worker lives at `/service-worker.js`. Bump its cache version whenever
shipping application assets. An installed app offers an update; save any unlogged
input before applying it. The local bridge queues sets durably but does not yet
publish workouts to Garmin. Optional provider configuration uses backend
`OPENAI_API_KEY` / `GEMINI_API_KEY` and `OPENAI_MODEL` / `GEMINI_MODEL` variables.

See `REVIEW_VERIFICATION.md` for regression coverage and device-only checks.
