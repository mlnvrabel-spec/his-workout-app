# Skill: Garmin Connection Security
## Goal
Ensure a 100% stable, "headless" connection to Garmin Connect without triggering rate-limits or security bans.

## Instructions
1. **Token Handshake**: Use `garth` to load tokens from `./backend/.garth/`.
2. **Persistence Check**: Before calling `client.login()`, verify if `client.oauth1_token` is still valid.
3. **MFA Protocol**:
   - Catch `GarthHTTPError` (401).
   - If MFA is required, trigger the `X-Garmin-MFA-Required` header back to the frontend.
   - Do not attempt more than 3 login retries per hour.

## Constraints
- **Zero-Password Storage**: Passwords exist only in memory during the initial `/auth/login` call.
- **User-Agent Spoofing**: Always set headers to mimic a Chrome/Windows 2026 environment to avoid bot-detection.