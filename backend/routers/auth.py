from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import garth
from garth import sso
from auth_manager import save_session, clear_session

router = APIRouter()

# Temporary in-memory storage for MFA state (MVP only)
mfa_storage = {}

class LoginRequest(BaseModel):
    email: str
    password: str

class MfaRequest(BaseModel):
    code: str

@router.post("/login")
def login(req: LoginRequest):
    """
    Attempts to login using garth.
    If MFA is required, returns 401 Unauthorized with {"detail": "MFA_REQUIRED"}.
    """
    try:
        # Use return_on_mfa=True to get the client_state if MFA is needed
        result = sso.login(req.email, req.password, client=garth.client, return_on_mfa=True)
        
        if isinstance(result, tuple) and result[0] == "needs_mfa":
            # Store the state using the email as key (basic approach for MVP)
            mfa_storage[req.email] = result[1]
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="MFA_REQUIRED"
            )
        
        # If no MFA, tokens are already set in garth.client
        save_session()
        return {"detail": "LOGIN_SUCCESS"}
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        print(f"Login failure: {error_msg}")
        
        if "429" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="GARMIN_RATE_LIMIT: Too many login attempts. Please wait 15-30 minutes."
            )
            
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ERROR: {error_msg}"
        )

@router.post("/mfa")
def mfa_verify(req: MfaRequest, email: str):
    """
    Accepts the 6-digit MFA code and the user email to complete handshake.
    """
    try:
        if email not in mfa_storage:
            raise HTTPException(status_code=400, detail="No pending MFA for this email")
            
        client_state = mfa_storage.pop(email)
        mfa_code = req.code.strip()
        
        # Complete the login using the stored state
        tokens = sso.resume_login(client_state, mfa_code)
        garth.client.oauth1_token, garth.client.oauth2_token = tokens
        
        # Persist tokens
        save_session()
        return {"detail": "MFA_SUCCESS"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"MFA_FAILED: {str(e)}"
        )

@router.delete("/session")
def logout():
    """
    Clears the saved session, logging the user out.
    """
    clear_session()
    return {"detail": "LOGGED_OUT"}
