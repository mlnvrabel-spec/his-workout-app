import os
import garth
from garminconnect import Garmin

# Define the hidden directory for session tokens
# WARNING: DO NOT SHARE THIS FOLDER. It contains sensitive Garmin session tokens.
GARTH_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".garth")

def is_authorized() -> bool:
    """Checks if a valid, resumable session exists."""
    if not os.path.exists(GARTH_DIR):
        return False
    try:
        garth.resume(GARTH_DIR)
        return True
    except:
        return False

def get_garmin_client() -> Garmin:
    """
    Resumes session or raises 401 if missing.
    """
    if not is_authorized():
        raise Exception("Unauthorized: No valid session.")
    
    # Initialize the Garmin client
    client = Garmin()
    client.login(GARTH_DIR)
    return client

def save_session():
    """Saves the current garth session."""
    os.makedirs(GARTH_DIR, exist_ok=True)
    garth.save(GARTH_DIR)

def clear_session():
    """Removes the saved session directory to log out the user."""
    if os.path.exists(GARTH_DIR):
        import shutil
        shutil.rmtree(GARTH_DIR)
