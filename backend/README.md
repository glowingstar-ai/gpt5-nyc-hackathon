# Backend service

This directory houses the FastAPI application for the GPT5 Hackathon monorepo. It is structured to scale with feature teams and encourages modular, testable code.

## Prerequisites

- Python 3.11
- [Poetry](https://python-poetry.org/) **or** `pip`/`venv`

> 💡 The commands below default to Poetry because it manages virtual environments and scripts for you. If you prefer to manage dependencies manually, use the alternative instructions that follow.

## 1. Install dependencies (Poetry workflow)

```bash
cd backend
poetry install
```

This creates an isolated virtual environment containing all runtime and development dependencies.

### Activate the shell (optional)

```bash
poetry shell
```

When the shell is active you can run `uvicorn` or `pytest` directly. Otherwise, prefix commands with `poetry run` as shown later in this guide.

## 2. Configure environment variables

Runtime configuration is handled by `pydantic-settings` and can be supplied via `.env` files, environment variables, or process managers such as systemd or Docker. The easiest approach locally is to copy the example file and edit the values you need:

```bash
cp .env.example .env
```

Available settings (with defaults shown in `app/core/config.py`):

- `PROJECT_NAME` — Name displayed in the OpenAPI docs (`GPT5 Hackathon API`).
- `API_V1_PREFIX` — Root prefix for versioned routes (`/api/v1`).
- `ENVIRONMENT` — Environment label for logging/monitoring (`development`).
- `OPENAI_API_KEY` — Required to enable the realtime session endpoint (no default).
- `OPENAI_API_BASE_URL` — Base URL for OpenAI's API (`https://api.openai.com/v1`).
- `OPENAI_REALTIME_MODEL` — Realtime model identifier (`gpt-4o-realtime-preview-2024-12-17`).
- `OPENAI_REALTIME_VOICE` — Voice used for speech output (`verse`).
- `OPENAI_REALTIME_INSTRUCTIONS` — Optional system prompt for each session.
- `AUTH0_DOMAIN` — Auth0 tenant domain used for hosted login (no default).
- `AUTH0_CLIENT_ID` — Client ID for the Auth0 application (no default).
- `AUTH0_CLIENT_SECRET` — Client secret for the Auth0 application (no default).
- `AUTH0_AUDIENCE` — Optional API audience to request during login.
- `AUTH0_DEFAULT_REDIRECT_URI` — Default redirect URI passed to Auth0 when one is not supplied by the client.
- `STRIPE_API_KEY` — Secret key for Stripe API access (no default).
- `STRIPE_DEFAULT_PRICE_ID` — Optional default Price ID used for checkout sessions.
- `STRIPE_SUCCESS_URL` — Default success redirect for Stripe Checkout sessions.
- `STRIPE_CANCEL_URL` — Default cancel redirect for Stripe Checkout sessions.

If a key is omitted it will fall back to the default defined in `Settings`.

## 3. Run the API locally

```bash
poetry run uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` to explore the interactive Swagger UI.

## Alternative: pip + venv workflow

If Poetry is unavailable, you can use a standard virtual environment:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r <(poetry export --format=requirements.txt --without-hashes)
```

> If `poetry export` is not available, install dependencies manually with `pip install fastapi uvicorn[standard] pydantic pydantic-settings python-dotenv` plus any optional tools you need from `pyproject.toml`.

Once installed, reuse the same `.env` instructions and start the server with:

```bash
uvicorn app.main:app --reload
```

## Run tests

```bash
poetry run pytest
```

Add `-q` for quiet output or `-k <expression>` to run a subset of tests.

## Project layout

```
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── dependencies.py
│   │   └── routes.py
│   ├── core/
│   │   └── config.py
│   ├── models/
│   │   └── __init__.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── emotion.py
│   │   ├── health.py
│   │   ├── payments.py
│   │   └── realtime.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── emotion.py
│   │   └── payments.py
│   └── main.py
├── tests/
│   └── test_health.py
├── pyproject.toml
└── README.md
```

Each layer has a clear responsibility:

- **core** — application-wide configuration.
- **api** — routers, dependencies, and view logic.
- **schemas** — Pydantic models for request/response validation.
- **services** — business logic that can be shared across routers.
- **tests** — pytest-based integration/unit tests.
