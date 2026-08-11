from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import httpx # httpx is asynchronous and standard in modern FastAPI stacks

router = APIRouter()

class CoachRequest(BaseModel):
    readiness_score: int
    exercise_name: str
    last_session_log: str

# Defined precisely from skills/skill-mr-olympia-coach.md
SYSTEM_PROMPT = """
You are an elite, evidence-based bodybuilding coach (PhD in Kinesiology), applying the hypertrophy principles of Dr. Andrew Galpin and Jeff Nippard. Your tone is authoritative, quiet, precise, and highly scientific. No fluff, no emojis, no generic motivation.

Your primary directive is to enforce Progressive Overload and perfect biomechanics based on the user's past data and current Garmin Readiness score.
- Base Target: Target RPE 8-9 (1-2 Reps in Reserve) with a strict 3-second eccentric phase.
- If Readiness > 75: Demand a micro-load increase (+2.5kg/5lbs) or +1 rep compared to their last session. 
- If Readiness < 40: Instruct them to match the previous session's weight but focus entirely on technique. Do not increase weight.

Output Constraints:
1. Maximum 3 sentences. No exceptions.
2. Sentence 1: Acknowledge last session's data.
3. Sentence 2: State the exact target load/reps for today based on readiness, enforcing the RPE 8-9 target.
4. Sentence 3: One specific, highly scientific biomechanical cue for the current exercise (e.g., internal/external rotation, muscle length position).
"""

@router.post("/coach")
async def generate_coach_cue(req: CoachRequest):
    """
    Receives current biomechanical and historical context and fetches 
    a highly constrained coaching cue from an LLM.
    """
    context_str = f"{{ Readiness: {req.readiness_score}, Exercise: '{req.exercise_name}', Last_Session: '{req.last_session_log}' }}"
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")
    
    # If no key is set on the backend, fall back immediately to avoid hanging.
    if not api_key:
        return {"cue": f"Focus purely on technique today with a 3-second eccentric on {req.exercise_name}."}

    try:
        if api_key.startswith("AIza"):
            # Gemini payload
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
            payload = {
                "system_instruction": { "parts": [{"text": SYSTEM_PROMPT}] },
                "contents": [{"parts": [{"text": context_str}]}]
            }
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, timeout=5.0)
                res.raise_for_status()
                data = res.json()
                reply = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                return {"cue": reply.strip()}
        else:
            # OpenAI payload
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": context_str}
                ]
            }
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, headers=headers, timeout=5.0)
                res.raise_for_status()
                data = res.json()
                reply = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return {"cue": reply.strip()}
    except Exception as e:
        print(f"[Coach AI] Error: {e}")
        return {"cue": f"Form first. Strictly control the eccentric on {req.exercise_name}."}
