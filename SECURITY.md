# Security boundaries

- The public frontend stores workout history locally in the browser. Do not commit
  real exports, API keys, environment files, Garmin tokens or personal screenshots.
- The Garmin bridge uses one local account. Bind it to loopback, never expose it
  through a public tunnel or reverse proxy. Garmin routes reject remote clients,
  non-loopback Host values and untrusted browser origins. This is not multi-user authentication.
- For hosted coaching use `backend/coach_app.py`, not `backend/main.py`. Configure
  HTTPS, exact allowed origins and a strong access code as described in README.
- The static deployment contains only explicitly listed runtime assets. Backend
  source, tests and project notes are not included in `dist`.
- Removing a file in a commit does not erase it from Git history or other clones.
  Revoke exposed credentials first. History rewriting needs a separate coordinated plan.

Do not put credentials or private workout data in public issues. Use GitHub's
private vulnerability-reporting option when available; otherwise contact the
maintainer privately before sending sensitive evidence.

Checks cover automated regressions, known dependency advisories and credential
patterns in reachable text history. They are not a penetration test and do not
establish that images, deleted remote references or third-party copies are clean.
