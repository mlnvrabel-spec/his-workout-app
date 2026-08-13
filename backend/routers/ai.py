from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import httpx # httpx is asynchronous and standard in modern FastAPI stacks

router = APIRouter()

class CoachRequest(BaseModel):
    readiness_score: int
    exercise_name: str
    last_session_log: str
    target_rir: str = "1-2"
    rep_range: str = ""

# Defined precisely from skills/skill-mr-olympia-coach.md
SYSTEM_PROMPT = """
You are an elite, evidence-based bodybuilding coach (PhD in Kinesiology), applying the hypertrophy principles of Dr. Andrew Galpin and Jeff Nippard. Your tone is authoritative, quiet, precise, and highly scientific. No fluff, no emojis, no generic motivation.

Your primary directive is to enforce progressive overload and sound biomechanics based on the user's past data, current Garmin Readiness score, and the supplied exercise prescription.
- Follow the supplied target RIR and rep range. Compounds normally use 1-2 RIR; stable isolations can use 0-2 RIR.
- Prescribe a controlled eccentric and full pain-free range, not a fixed three-second tempo.
- If Readiness > 75: first prescribe +1 rep within the range; use the smallest practical load increase only after all prescribed sets reach the top of that range at the target RIR.
- If Readiness < 40: retain the prior load, reduce effort if needed, and focus on technique. Do not increase load.

Output Constraints:
1. Maximum 3 sentences. No exceptions.
2. Sentence 1: Acknowledge last session's data.
3. Sentence 2: State the exact target load/reps for today based on readiness and the supplied prescription.
4. Sentence 3: One specific, highly scientific biomechanical cue for the current exercise (e.g., internal/external rotation, muscle length position).
"""


def build_fallback_cue(req: CoachRequest) -> str:
    """Return an immediate three-sentence cue when the provider is unavailable."""
    last_session = req.last_session_log.strip()
    session_sentence = (
        "No prior session is logged, so establish a clean baseline today."
        if last_session.lower().startswith("first time")
        else f"Your last logged session was {last_session}."
    )
    rep_range = req.rep_range or "the prescribed range"
    if req.readiness_score > 75:
        target_sentence = (
            f"Readiness is high: add one rep within {rep_range} at {req.target_rir} RIR "
            "before increasing load."
        )
    elif req.readiness_score < 40:
        target_sentence = (
            f"Readiness is low: match or reduce the prior load and stay within {rep_range} "
            f"at {req.target_rir} RIR without forcing progression."
        )
    else:
        target_sentence = (
            f"Use a repeatable load within {rep_range} and finish around {req.target_rir} RIR."
        )
    form_sentence = f"Use a controlled eccentric and full pain-free range on {req.exercise_name}."
    return f"{session_sentence} {target_sentence} {form_sentence}"


def usable_cue_or_fallback(cue: object, req: CoachRequest) -> str:
    """Avoid passing empty or malformed provider text through to the exercise card."""
    return cue.strip() if isinstance(cue, str) and cue.strip() else build_fallback_cue(req)

@router.post("/coach")
async def generate_coach_cue(req: CoachRequest):
    """
    Receives current biomechanical and historical context and fetches 
    a highly constrained coaching cue from an LLM.
    """
    context_str = (
        f"{{ Readiness: {req.readiness_score}, Exercise: '{req.exercise_name}', "
        f"Last_Session: '{req.last_session_log}', Target_RIR: '{req.target_rir}', "
        f"Rep_Range: '{req.rep_range}' }}"
    )
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")
    
    # If no key is set on the backend, fall back immediately to avoid hanging.
    if not api_key:
        return {"cue": build_fallback_cue(req)}

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
                return {"cue": usable_cue_or_fallback(reply, req)}
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
                return {"cue": usable_cue_or_fallback(reply, req)}
    except Exception as e:
        print(f"[Coach AI] Error: {e}")
        return {"cue": build_fallback_cue(req)}
