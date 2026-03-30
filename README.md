# Omniscient

Omniscient is a graph-first simulation sandbox for exploring multi-agent behavior, branching timelines, and causal explanations.

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `USE_IN_MEMORY_STORE="true"` for demo mode or provide a PostgreSQL `DATABASE_URL`.
4. Run `npm run prisma:generate`.
5. Start the app with `npm run dev`.

## Memory stability

The project scripts now start Next.js and Vitest with explicit Node heap limits to reduce recurring
`Out of Memory` failures during local development, builds, and test runs.

If you still hit memory pressure:

- close any duplicate `next dev`, Playwright, or test processes
- remove `.next` and restart the dev server
- prefer `npm run test` over ad hoc `vitest` commands so the memory limit is applied
- if builds still fail on your machine, increase the heap in `package.json` further

## MVP scope

- Next.js App Router scaffold
- Deterministic simulation engine with branch creation
- AI action proposal contract with fallback heuristics
- Graph-first world workspace, compare view, and insights view
- Prisma schema and Auth.js wiring for a single-user MVP
