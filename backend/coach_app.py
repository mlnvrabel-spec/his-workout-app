"""Phone-facing AI entrypoint. Does not expose the local Garmin bridge routes."""
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from coach_sessions import allowed_origins, validation_error, private_coach_responses
from routers.ai import router

app = FastAPI(title="Workout Coach API")
app.middleware('http')(private_coach_responses)
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins(), allow_credentials=True,
                   allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type"])
app.add_exception_handler(RequestValidationError, validation_error)
app.include_router(router, prefix="/api/ai", tags=["AI Coach"])
