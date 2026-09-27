# AI Interview Platform

An automated first-round technical interviewer. Recruiters add a candidate
and schedule a role-specific interview; at the scheduled time, an AI
conducts a real, spoken conversation with the candidate over a browser —
asking role-specific questions, probing answers with natural follow-ups,
and adapting question difficulty to what the candidate's CV suggests about
their seniority. When it's done, the recruiter gets a scored report with
quoted evidence for every competency assessed, with no interviewer time
spent on a screening call that didn't need one.

## How it works

1. **Add a candidate** — email, name, and a CV. The CV is parsed in the
   background the moment it's uploaded, so it's ready before any interview
   is even scheduled.
2. **Schedule the interview** — pick a role and a time. Each role has a
   fixed interview blueprint (an ordered list of competencies to assess);
   the actual question text is selected later, per candidate.
3. **Send the invite** — one click. The candidate is emailed automatically
   (an initial invite, a follow-up, and the join link closer to the day),
   and the interview's questions are prepared a couple of minutes ahead of
   time — chosen from the question bank for relevance to that candidate's
   CV and seniority, so no two candidates for the same role necessarily
   hear the exact same phrasing.
4. **The interview happens** — the candidate opens a link, no download or
   account required, and has a live spoken conversation with the AI
   interviewer. A candidate who disconnects mid-interview can resume
   within a 30-minute window without losing progress; one who never shows
   up is automatically marked so, with no recruiter follow-up needed.
5. **The report lands automatically** — once the interview ends (by the
   candidate's own request or a disconnect), the transcript is scored
   per competency, each score backed by a quoted excerpt from what the
   candidate actually said, and every recruiter is notified by email with
   a link to the full report.

For the full technical walkthrough — every API call, database write, and
decision the system makes along the way — see
[HOW_IT_WORKS.md](HOW_IT_WORKS.md).

## What's in here

```
apps/
  api               Express API (port 3001)
  admin             Vite + React recruiter admin panel (port 3002)
  engine            Python voice agent — CV parsing, question selection,
                     the voice pipeline, transcript scoring. Not a yarn
                     workspace member; built via its own pyproject.toml.
packages/
  db                Prisma schema, client, and seed data (Postgres + pgvector)
  mailer            EmailJob union, BullMQ queue, React Email templates, and
                     the worker process itself (`yarn workspace @repo/mailer dev`)
                     — the one package that also runs as its own process
  enums             Shared enums, kept in sync with the Prisma schema
  shared-schemas    JSON Schema definitions shared across process boundaries
                     (the API, the mailer, and the Python agent)
  ui                Shared React components used by the admin app
  eslint-config     Shared ESLint flat configs
  typescript-config Shared tsconfig bases
  prettier-config   Shared Prettier config
```

## Roadmap

Built one phase at a time — each phase produces something that runs on its
own before the next one starts:

| Phase | Goal                                                          | Status      |
| ----- | -------------------------------------------------------------- | ----------- |
| 0     | Repo scaffold                                                 | Done        |
| 1     | Data layer: Candidate, Role, Question, InterviewSession, User | Done        |
| 2     | Interview logic, text-only (Python CLI, no voice)             | Done        |
| 3     | Admin panel + API CRUD                                        | Done        |
| 4     | Mailer package (invite, follow-up, meeting-link)              | Done        |
| 5     | Scheduler — BullMQ delayed jobs off `scheduledAt`             | Done        |
| 6     | Voice, browser-based (Pipecat)                                | Done        |
| 7     | Meeting-bot swap (Teams)                                      | Not started |
| 8     | Reports on the admin panel                                    | Done        |
| 9     | Hardening for production (auth, deployment, monitoring, load) | In progress |

## Getting started

```bash
corepack enable && corepack prepare yarn@4.11.0 --activate
yarn install

# Each app/package has a .env — fill in DATABASE_URL (a Neon serverless
# Postgres connection string works, no local Postgres install needed) and
# AGENT_WEBHOOK_SECRET (must match between apps/api and apps/engine).

yarn ollama_up                      # starts Ollama natively, pulls the chat model (qwen3:30b-a3b)
yarn docker_up                      # starts Redis, Mailpit, STT/TTS, and the embeddings containers

# One-time: unlike native Ollama, the STT container and the Dockerized
# embeddings Ollama don't lazy-download their models on first request —
# pull both explicitly once (cached after that):
curl -X POST http://localhost:8000/v1/models/Systran/faster-whisper-small
curl -X POST http://localhost:11435/api/pull -d '{"name":"nomic-embed-text"}'

yarn workspace @repo/db db-migrate
yarn workspace @repo/db db-seed
yarn dev                            # api + admin + mailer + agent

# When you're done:
yarn docker_down
yarn ollama_down
```

## Stack

- **Frontend:** Vite + React, Redux Toolkit Query
- **Backend:** Express, Prisma, PostgreSQL with pgvector, Redis + BullMQ
- **Voice AI:** Python + Pipecat, talking to an LLM, speech-to-text, and
  text-to-speech over OpenAI-compatible APIs — swappable for any provider
  that speaks that protocol; runs against a local Ollama model by default
  for zero-cost local development
- **Email:** React Email templates rendered and sent by a dedicated worker
- **Tooling:** Turborepo, Yarn workspaces, ESLint, Prettier, Husky + lint-staged, GitHub Actions CI

This repo currently targets local development only — see the Roadmap above
for what's still ahead of a production deployment. Implementation detail
that would clutter this section (exact ports, container images, model
names) is in [HOW_IT_WORKS.md](HOW_IT_WORKS.md) instead.
