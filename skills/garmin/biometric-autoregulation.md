# Skill: Biometric Autoregulation
## Goal
Adjust training intensity dynamically based on Garmin's "Training Readiness" and "Body Battery" metrics.

## Instructions
1. **Data Normalization**: Fetch `HRV Status` (ms) and `Sleep Score` (0-100).
2. **The "Load Guard" Logic**:
   - If `Readiness < 40`: Recommend "Recovery Session" (Delete heavy sets, keep mobility).
   - If `Readiness > 85`: Recommend "Overreach Session" (Add 1 set to primary lifts).
3. **Cache Policy**: Only fetch new biometrics every 30 minutes to prevent API throttling.

## Constraints
- Never prescribe a weight increase if the `Stress Score` is > 60 for the last 4 hours.