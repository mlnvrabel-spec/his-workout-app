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
node test_render.mjs
node test_core.mjs
python backend/test_api.py
python -m compileall -q backend
```
