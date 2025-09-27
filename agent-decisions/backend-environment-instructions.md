# Backend environment instructions refresh

## Context
- The backend README previously listed only the minimal `poetry install` and `uvicorn` commands, which left unanswered questions about environment variables and alternative installation flows.
- The `Settings` class already supports `.env` files, but there was no example file to guide contributors.

## Decisions
- Expand `backend/README.md` with step-by-step setup guidance (prerequisites, Poetry workflow, environment variables, running, testing) so the service can be bootstrapped locally and in other environments.
- Provide a `.env.example` file documenting the supported configuration keys and their defaults.
- Document a fallback `pip`/`venv` workflow for environments where Poetry is unavailable, enabling broader compatibility.

## Status
Accepted — the updated documentation now equips contributors to configure and run the backend across different environments.
