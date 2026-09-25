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
  interview-engine  Python interview bot — CV parsing, question selection,
                     the voice pipeline, transcript scoring. Not a yarn
                     workspace member; built via its own pyproject.toml.
packages/
  db                Prisma schema, client, and seed data (Postgres + pgvector)
  mailer            EmailJob union, BullMQ queue, React Email templates, and
                     the worker process itself (`yarn workspace @repo/mailer dev`)
                     — the one package that also runs as its own process
  enums             Shared enums, kept in sync with the Prisma schema
  shared-schemas    JSON Schema definitions shared across process boundaries
                     (the API, the mailer, and the Python engine)
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
| 4     | Mailer package (invite, follow-up, meeting-link)              |
| 5     | Scheduler — BullMQ delayed jobs off `scheduledAt`             |
| 6     | Voice, browser-based (Pipecat)                                |
| 7     | Meeting-bot swap (Teams)                                      |
| 8     | Reports on the dashboard                                      |
| 9     | Hardening                                                     |

## Getting started

```bash
corepack enable && corepack prepare yarn@4.11.0 --activate
yarn install

# Each app/package has a .env — fill in DATABASE_URL (a Neon serverless
# Postgres connection string works, no local Postgres install needed) and
# ENGINE_WEBHOOK_SECRET (must match between apps/api and apps/interview-engine).

yarn ollama_up                      # starts Ollama natively, pulls the chat model (qwen3:30b-a3b)
yarn docker_up                      # starts Redis, Mailpit, STT/TTS, and the embeddings containers

# One-time: unlike native Ollama, the STT container and the Dockerized
# embeddings Ollama don't lazy-download their models on first request —
# pull both explicitly once (cached after that):
curl -X POST http://localhost:8000/v1/models/Systran/faster-whisper-small
curl -X POST http://localhost:11435/api/pull -d '{"name":"nomic-embed-text"}'

yarn workspace @repo/db db-migrate
yarn workspace @repo/db db-seed
yarn dev                            # api + dashboard + mailer + interview-engine

# When you're done:
yarn docker_down
yarn ollama_down
```

## Stack

- **Frontend:** Vite + React, Redux Toolkit Query
- **Backend:** Express, Prisma, PostgreSQL (pgvector), Redis + BullMQ
- **Voice engine:** Python + Pipecat (the only non-TypeScript app; Python
  3.12 specifically). Chat (`qwen3:30b-a3b`) runs through a native Ollama
  install (`yarn ollama_up`) for GPU/Metal access; point `LLM_BASE_URL` at
  OpenAI or another OpenAI-compatible endpoint instead if you'd rather not
  run it locally. Embeddings (`nomic-embed-text`) run in a second, dedicated
  Ollama instance in Docker instead (`:11435`, see `docker-compose.yml`) —
  small enough that CPU-only is fine there. STT/TTS are also Docker
  containers (speaches for transcription, kokoro-fastapi for speech), all
  talking OpenAI-compatible APIs the same way the chat model does.
- **Tooling:** Turborepo, Yarn workspaces, ESLint (flat config), Prettier,
  Husky + lint-staged
- **Infra (local dev):** Postgres on Neon (cloud, no local install); the
  chat model native (`yarn ollama_up`/`yarn ollama_down`); Redis, Mailpit,
  STT/TTS, and the embeddings Ollama all in Docker (`yarn docker_up`/
  `yarn docker_down`, see `docker-compose.yml`); `yarn dev` then starts
  only the native app processes (api, dashboard, mailer, interview-engine)
  and expects the two `_up` commands to have already run. GitHub Actions CI
  for lint/format/build only. Deployment/production infra isn't built yet —
  this repo is local-dev-only for now, by design (see Build plan below).
