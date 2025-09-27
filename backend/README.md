# Backend service

This directory houses the FastAPI application for the GPT5 Hackathon monorepo. It is structured to scale with feature teams and encourages modular, testable code.

# how to run

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
poetry install
uvicorn app.main:app --reload
```

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
│   │   └── health.py
│   ├── services/
│   │   └── __init__.py
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
