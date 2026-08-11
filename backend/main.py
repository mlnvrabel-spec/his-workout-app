from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, sync, workouts, ai
from auth_manager import is_authorized

app = FastAPI(title="Garmin Connect Bridge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
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
