# AI Interview Platform

A recruiter adds a candidate, schedules an interview, and an AI voice bot
conducts the interview and produces a scored report on a dashboard — built
as a Yarn workspaces + Turborepo monorepo, following the conventions of the
[Arowdox](/Users/ratul/Documents/Projects/Arowdox) reference project.

## What's in here

```
apps/
  api               Express API (port 3001)
  dashboard         Vite + React recruiter dashboard (port 3002)
  email-worker      BullMQ worker sending the three candidate emails
  interview-agent   Python interview bot — CV parsing, question selection,
                     the voice pipeline, transcript scoring. Not a yarn
                     workspace member; built via its own pyproject.toml.
packages/
  db                Prisma schema, client, and seed data (Postgres + pgvector)
  email             EmailJob union, BullMQ queue/worker, React Email templates
  enums             Shared enums, kept in sync with the Prisma schema
  shared-schemas    JSON Schema definitions shared across process boundaries
                     (the API, the email worker, and the Python agent)
  ui                Shared React components used by the dashboard
  eslint-config     Shared ESLint flat configs
  typescript-config Shared tsconfig bases
  prettier-config   Shared Prettier config
```

## Build plan

This repo is built one phase at a time — each phase produces something that
runs on its own before the next one starts:

| Phase | Goal                                                          |
| ----- | ------------------------------------------------------------- |
| 0     | Repo scaffold — this state                                    |
| 1     | Data layer: Candidate, Role, Question, InterviewSession, User |
| 2     | Interview logic, text-only (Python CLI, no voice)             |
| 3     | Dashboard + API CRUD                                          |
| 4     | Email package (invite, follow-up, meeting-link)               |
| 5     | Scheduler — BullMQ delayed jobs off `scheduledAt`             |
| 6     | Voice, browser-based (Pipecat)                                |
| 7     | Meeting-bot swap (Teams)                                      |
| 8     | Reports on the dashboard                                      |
| 9     | Hardening                                                     |

## Getting started

```bash
corepack enable && corepack prepare yarn@4.11.0 --activate
yarn install
yarn dev   # Docker: Postgres + Redis + api + dashboard + email-worker + agent
```

Copy each app/package's `.env.example` to `.env` before running natively
(`yarn dev:local`); the Docker path injects what it needs on its own.

## Stack

- **Frontend:** Vite + React, Redux Toolkit Query
- **Backend:** Express, Prisma, PostgreSQL (pgvector), Redis + BullMQ
- **Voice agent:** Python + Pipecat (the only non-TypeScript app)
- **Tooling:** Turborepo, Yarn workspaces, ESLint (flat config), Prettier,
  Husky + lint-staged
- **Infra:** Docker Compose for dev, GitHub Actions CI
