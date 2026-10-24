# Hypertrophy Protocol Dashboard

## Run locally

Use two terminals from the repository root.

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --reload --port 8001
```

```powershell
python -m http.server 3000 --bind 127.0.0.1
```

Open `http://localhost:3000`. The frontend expects the FastAPI Garmin bridge at `http://localhost:8001`.

## Checks

```powershell
npm.cmd ci
npm.cmd run verify
python backend/test_api.py
python backend/test_coach.py
python backend/test_security.py
python -m compileall -q backend
```

The provider-neutral agent setup is verified together with the frontend checks:

```powershell
npm.cmd run verify
```


## Workout behavior

The app opens to Workout for the checklist and set logger. Use Calendar for
dated training and planning. Rest,
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

## Coach connection from a phone

Workout and Calendar are the navigation destinations; the separate Coach button opens a dialog. Recent training shows
recorded gym and run sessions/week over the last 14 and 28 calendar days.

Open Coach → AI connection. Use a provider API key, not a DeepSeek account password.
The backend supports DeepSeek (default), OpenAI and Gemini. Provider calls use the
server; keys never enter localStorage or IndexedDB. Only the backend URL is saved.
Phone-entered keys live in server memory for up to eight hours, with an HttpOnly
cookie on the phone; disconnect, expiry, eviction or a server restart removes access.
This deliberately requires reconnection rather than storing permanent credentials.

The frontend repository alone does not provide a hosted Python service. To enable
phone use, host `backend/coach_app.py` behind HTTPS, preferably on the same site as the app.
This AI-only entrypoint does not expose the local Garmin bridge's auth/sync routes.
Keep the existing Garmin bridge local; do not expose it as the phone coach service.

- Set `COACH_ALLOWED_ORIGINS` to the exact frontend HTTPS origin (comma-separated
  when needed), and `COACH_ACCESS_CODE` to a random secret of at least 24 characters.
  Generate one privately with `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
- Enter that access code and your provider API key in the phone connection form.
  Alternatively configure `DEEPSEEK_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY` on
  the backend and leave the phone key field blank. Never commit these values.
- Run one backend worker because sessions are process-local. Use trusted proxy/TLS
  configuration so the app receives the correct HTTPS scheme. Restrict request-body
  logging; never log connection forms, provider headers or chat content. Keep host,
  dependency and account security maintained. Cross-site cookie restrictions on a
  phone can prevent connection; a same-site reverse proxy avoids that dependency.
- No backend was provisioned or deployed by the GitHub push. Until an HTTPS backend
  and a real provider key are available, the app labels its local guidance clearly.

For loopback development only, HTTP on localhost is supported. Include the local
preview origin in `COACH_ALLOWED_ORIGINS` and run `python -m uvicorn coach_app:app --app-dir backend --host 127.0.0.1 --port 8001`.
New credential-flow checks: `python backend/test_coach.py` (mock providers; no billing).
The current DeepSeek default, `deepseek-flash`, and endpoint were verified against
the [official API guide](https://api-docs.deepseek.com/) on 20 October 2026;
`DEEPSEEK_MODEL` can select another supported model. OpenAI/Gemini model variables
remain supported. Real-provider and physical-phone tests require the actual setup.

## Publish and update the app

`main` is the production source. Feature branches do not update the production app.
For a release, verify the changes, merge them into `main`, and confirm the production
deployment uses that commit. A push to a feature branch alone is not a release.
Do not delete unmerged branches or force-push history as part of a routine release.

`npm run build` creates `dist` from the service worker's runtime asset list.
Vercel publishes only `dist`, never the repository root. Source, tests and useful
development documentation stay in GitHub; credentials, local Vercel metadata,
temporary patches and reference/debug screenshots stay out of Git tracking.
See `SECURITY.md` for security boundaries and reporting guidance.
