# Omniscient

Omniscient is a graph-first simulation sandbox for exploring multi-agent behavior, branching timelines, and causal explanations.

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `USE_IN_MEMORY_STORE="true"` for demo mode or provide a PostgreSQL `DATABASE_URL`.
4. Run `npm run prisma:generate`.
5. Start the app with `npm run dev`.

## MVP scope

- Next.js App Router scaffold
- Deterministic simulation engine with branch creation
- AI action proposal contract with fallback heuristics
- Graph-first world workspace, compare view, and insights view
- Prisma schema and Auth.js wiring for a single-user MVP
