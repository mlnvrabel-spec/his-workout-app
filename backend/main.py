from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, sync, workouts, ai
from auth_manager import is_authorized
from coach_sessions import allowed_origins, validation_error, private_coach_responses
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from ipaddress import ip_address

app = FastAPI(title="Garmin Connect Bridge API")
app.middleware('http')(private_coach_responses)

@app.middleware('http')
async def local_garmin_only(request, call_next):
    # These routes use one machine-local Garmin session, not per-user web sessions.
    if request.url.path == '/' or request.url.path.startswith(('/auth/', '/sync/', '/workouts/')):
        try:
            local_client = bool(request.client and ip_address(request.client.host).is_loopback)
        except ValueError:
            local_client = False
        local_host = request.url.hostname in ('localhost', '127.0.0.1', '::1')
        origin = request.headers.get('origin')
        permitted = set(allowed_origins()) | {'http://localhost:5500', 'http://127.0.0.1:5500', 'http://127.0.0.1:3017'}
        if not local_client or not local_host or (origin and origin not in permitted):
            return JSONResponse(status_code=403, content={'detail': 'Garmin bridge requires trusted loopback access.'})
    return await call_next(request)

@app.exception_handler(RequestValidationError)
async def safe_validation_error(request, exc):
    if request.url.path.startswith('/auth/'):
        return JSONResponse(status_code=422, content={'detail': 'Invalid authentication request.'}, headers={'Cache-Control': 'no-store'})
    return await validation_error(request, exc)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(allowed_origins() + [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5500",
        "http://127.0.0.1:3017",
        "http://127.0.0.1:5500",
    ])),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include API routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(sync.router, prefix="/sync", tags=["Sync Data"])
app.include_router(workouts.router, prefix="/workouts", tags=["Workouts"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Coach"])

@app.get("/")
def read_root():
    if not is_authorized():
        raise HTTPException(status_code=401, detail="NOT_CONNECTED")
    return {"message": "Garmin Connect Bridge is running securely."}
