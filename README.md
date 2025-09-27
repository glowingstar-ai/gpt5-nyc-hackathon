# GPT5 Hackathon Monorepo Starter

A batteries-included monorepo that pairs a modern Next.js frontend with a FastAPI backend. The structure is optimized for teams collaborating on product features and services simultaneously.

## Repository layout

```
.
├── frontend/      # Next.js 14 + Tailwind CSS + shadcn/ui-inspired components
├── backend/       # FastAPI service with modular routers and typed schemas
├── .gitignore
└── README.md
```

## Getting started

### Frontend

```bash
cd frontend
pnpm install  # or npm install / yarn install
pnpm dev
```

Visit `http://localhost:3000` to view the application. The starter ships with Tailwind CSS, Radix Themes, and Framer Motion ready to use.

### Backend

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs` for interactive OpenAPI documentation.

## Development conventions

- **Code quality** — ESLint, TypeScript, Prettier, Ruff, and Black keep contributions consistent.
- **Isolation** — Frontend and backend live in separate workspaces so teams can deploy independently.
- **Shared patterns** — Components, schemas, and services are organized to encourage reuse and clear boundaries.

## Next steps

- Connect the frontend to backend APIs using `@tanstack/react-query`.
- Add CI workflows for linting, testing, and type checking.
- Configure deployment infrastructure (e.g., Vercel for frontend, Fly.io/Render for backend).
