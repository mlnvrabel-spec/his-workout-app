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

The app opens to a dated training agenda. Open the active workout to use the
existing checklist and set logger; use Agenda to return. Office days, rest,
4×4 runs and other activities can be scheduled locally. Review displaced dates
before applying a calendar change. Calendar Undo is separate from workout Undo
and will not overwrite intervening training progress.

Four gym sessions per week is the planning target; 3.5 is the user's acceptable
long-term average. The split rolls across weeks. The accepted training evidence,
preferences and deferred Garmin authority rules are recorded in
[TRAINING_SCHEDULING_DECISIONS.md](TRAINING_SCHEDULING_DECISIONS.md).

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
