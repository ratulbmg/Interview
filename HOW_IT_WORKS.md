# How It Works — The Full Interview Lifecycle

A step-by-step trace of everything that happens between a recruiter adding
a candidate and a scored report landing in their inbox — every database
write, every queued job, every HTTP call between the two backend
processes, and every decision the AI interviewer makes. Written against
the actual code as of this commit; file paths are given throughout so any
claim here can be checked directly against the source.

This is an engineering reference, not a user guide — see the root
[README.md](README.md) for what the product is and how to run it locally.

## Contents

1. [The processes involved](#1-the-processes-involved)
2. [Recruiter setup: candidate → schedule → invite](#2-recruiter-setup-candidate--schedule--invite)
3. [The countdown: what fires, and when](#3-the-countdown-what-fires-and-when)
4. [The candidate clicks the link: the join decision tree](#4-the-candidate-clicks-the-link-the-join-decision-tree)
5. [Inside the interview](#5-inside-the-interview)
6. [Ending the interview](#6-ending-the-interview)
7. [Scoring and the report](#7-scoring-and-the-report)
8. [Appendix A — Full API reference](#appendix-a--full-api-reference)
9. [Appendix B — Database fields](#appendix-b--database-fields)
10. [Appendix C — BullMQ queues and jobs](#appendix-c--bullmq-queues-and-jobs)
11. [Appendix D — Config reference](#appendix-d--config-reference)

---

## 1. The processes involved

| Process | What it is | Owns |
|---|---|---|
| `apps/admin` | Vite + React recruiter UI, port 3002 | Nothing server-side — just calls `apps/api` |
| `apps/api` | Express + Prisma, port 3001 | **Every session-lifecycle decision.** Postgres is only ever written to from here. |
| `apps/engine` (Python package `agent`) | Pipecat voice process, port 7860 | Running the live voice call and scoring a finished transcript. Decides nothing about *when* an interview happens — it asks `apps/api`. |
| `packages/mailer` | Standalone Node worker | Rendering and sending the four email types |
| Postgres | Neon, cloud | The only source of truth for session state |
| Redis | BullMQ backing store | Three queues: `agent-jobs`, `orchestrator-jobs`, `email` |
| Ollama (native) | Chat LLM, `:11434` | Interview conversation, CV parsing, scoring |
| Ollama (Docker) | Embeddings, `:11435` | CV/question relevance ranking |
| speaches (Docker) | STT, `:8000` | Transcribing the candidate's speech |
| Kokoro (Docker) | TTS, `:8880` | Synthesizing the bot's speech |

The one architectural rule everything below follows: **`apps/api` decides,
`apps/engine` executes.** The Python process never queries Postgres for
session state and never decides on its own whether a candidate is early,
late, or should be allowed to resume — it asks `apps/api` over HTTP
(`agent/orchestrator_client.py`) and does exactly what it's told, including
speaking the literal message text handed back. The one call that runs in
the opposite direction is `/score`, because only the Python process has an
LLM client wired up.

---

## 2. Recruiter setup: candidate → schedule → invite

These are three separate, independent recruiter actions — adding a
candidate never implies a role or a schedule; scheduling never implies an
invite has gone out.

### 2.1 Add a candidate

`apps/admin`'s Candidates page → `POST /candidates` (`multipart/form-data`,
requires the recruiter's auth cookie).

**Request** (`apps/api/src/routes/candidateRoute.ts`, `apps/api/src/validation/candidateValidation.ts`):
```
POST /candidates
Content-Type: multipart/form-data

email: "jane@example.com"
name: "Jane Doe"          (optional)
cv: <PDF file>
```

**What happens** (`apps/api/src/service/candidateService.ts`):
1. Reject with `409` if a `Candidate` with this email already exists.
2. The uploaded PDF is saved to `apps/api/uploads/` by `uploadMiddleware.ts`; a public URL is built as `{API_PUBLIC_URL}/uploads/{filename}`.
3. Insert into `candidates`:
   ```json
   {
     "uniqueId": "<randomUUID>",
     "email": "jane@example.com",
     "name": "Jane Doe",
     "cvUrl": "http://localhost:3001/uploads/1758-resume.pdf",
     "cvParsedJson": null
   }
   ```
4. Enqueue a `cv-parse` job onto the `agent-jobs` Redis queue: `{ candidateId: 42 }`. The HTTP response does **not** wait for this — adding 30 candidates back-to-back stays instant regardless of how long CV parsing takes.

**Response** — `201`:
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Candidate added",
  "data": {
    "id": 42,
    "uniqueId": "b7e1...-...",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "cvUrl": "http://localhost:3001/uploads/1758-resume.pdf",
    "cvParsedJson": null,
    "createdAt": "2026-09-27T09:00:00.000Z"
  }
}
```

**CV parsing, asynchronously** (`apps/engine/agent/jobs/consumer.py`'s
`_process_cv_parse_job`, `apps/engine/agent/interview/cv.py`):
1. The Python `agent-jobs` consumer (concurrency 1 — CVs are parsed one at a time) picks up the job, downloads the PDF from `cvUrl` (the two processes don't share a filesystem), and extracts raw text with `pypdf`.
2. The raw text goes to the chat LLM with a fixed system prompt asking for a single JSON object:
   ```json
   {
     "skills": ["React", "PostgreSQL", "..."],
     "years_experience": 4,
     "projects": [{"name": "...", "description": "..."}],
     "employers": ["Acme Corp"],
     "seniority_signal": "mid"
   }
   ```
3. That object is written back to `candidates.cvParsedJson`. Nothing calls the API back for this — the Python process talks to Postgres directly here, since CV content (not session lifecycle) is squarely its job.

### 2.2 Schedule an interview

`apps/admin`'s Sessions page → `POST /sessions`.

**Request** (`apps/api/src/validation/sessionValidation.ts`):
```json
{ "candidateId": 42, "roleId": 1, "scheduledAt": "2026-10-02T14:00:00.000Z" }
```

**What happens** (`sessionService.scheduleSession`): validates the candidate and role both exist, then inserts one row into `sessions`:
```json
{
  "candidateId": 42, "roleId": 1,
  "status": "SCHEDULED",
  "scheduledAt": "2026-10-02T14:00:00.000Z",
  "meetingUrl": null, "transcript": null, "reportJson": null,
  "checkpointJson": null, "consentGivenAt": null
}
```
No queue job is touched yet — nothing is sent to the candidate until "Send Invite" is pressed. This is deliberately a separate action from adding the candidate.

**Response** — `201` with the new `InterviewSession` row (same shape as above, plus `id` and `createdAt`).

### 2.3 Send the invite

`POST /sessions/:id/send-invite` — the recruiter's **last** required action. Everything after this runs on its own.

**What happens** (`sessionService.sendInvite`), in order:
1. Rejects with `409` if `status` isn't `SCHEDULED` (an invite can only be sent once).
2. Mints a meeting URL (`apps/api/src/lib/meetingProvider.ts`): `{roomToken}` is a fresh `randomUUID()`, and `meetingUrl = "{ADMIN_PUBLIC_URL}/room/{roomToken}"`. There is no separate `roomToken` column — the token *is* the trailing path segment of `meetingUrl`.
3. Updates the row: `status → INVITE_SENT`, `meetingUrl` set.
4. Schedules **four delayed jobs**, all computed off `scheduledAt` (see §3 for the exact timing table):
   - three emails onto the `email` queue (`packages/mailer`),
   - one `agent-start` job onto the `agent-jobs` queue,
   - one `noshow-check` and one `interview-timeout-finalize` job onto the `orchestrator-jobs` queue.

**Response** — `200` with the updated session (`status: "INVITE_SENT"`, `meetingUrl` populated).

---

## 3. The countdown: what fires, and when

All four delayed jobs are computed by one helper, `delayUntil(scheduledAt, offsetMs)` in `apps/api/src/lib/scheduling.ts` — `max(0, (scheduledAt - offsetMs) - now)`, so anything whose target time has already passed (e.g. the interview is only 1 day out when "Send Invite" is clicked) fires immediately instead of erroring.

| Offset from `scheduledAt` | What fires | Queue | Handler |
|---|---|---|---|
| immediately | `interview-invite` email | `email` | `packages/mailer` |
| `scheduledAt - 2 days` (or now, if under 2 days out) | `interview-followup` email | `email` | `packages/mailer` |
| `scheduledAt - 1 day` (or now) | `interview-meeting-link` email — carries the actual join link | `email` | `packages/mailer` |
| `scheduledAt - 2 minutes` | `agent-start` job — selects this interview's questions | `agent-jobs` | `apps/engine`'s `jobs/consumer.py` |
| `scheduledAt + 15 minutes` | `noshow-check` — marks `NO_SHOW` if the session never left `SCHEDULED`/`INVITE_SENT` | `orchestrator-jobs` | `apps/api`'s `orchestratorWorker.ts` |
| `scheduledAt + 30 minutes` | `interview-timeout-finalize` — safety net for an abandoned `IN_PROGRESS` session | `orchestrator-jobs` | `apps/api`'s `orchestratorWorker.ts` |

**`agent-start`** (`apps/engine/agent/jobs/consumer.py`'s `_process_agent_start_job`) is where question selection actually happens, two minutes before the candidate can join:
1. Loads the candidate's `cvParsedJson` (parsing inline, synchronously, on the rare race where `cv-parse` hasn't finished yet — see §2.1).
2. Loads the role's `blueprint` and the full `questions` bank.
3. Runs `select_questions(...)` (full algorithm in §5.2) to pick one question per blueprint slot.
4. `POST`s the result to `apps/api` (`/agent/sessions/:id/questions-selected`, detailed in Appendix A), which writes it into `sessions.checkpointJson` as `{ transcript: [], selectedQuestions: [...] }`.

This is also the gate that makes "not ready yet" mean something specific: if a candidate's browser somehow reaches the room before this job has run (e.g. they clicked a very early meeting-link email), `checkpointJson` is still `null` and the join decision in §4 returns `MSG_NOT_READY` even though `scheduledAt` may still be minutes away.

**`noshow-check`** (`apps/api/src/lib/orchestratorWorker.ts`) is a pure Postgres check: if the session is still sitting at `SCHEDULED` or `INVITE_SENT` 15 minutes after the scheduled time (i.e. the candidate never even attempted to join), it's marked `NO_SHOW`. A session that already started (`IN_PROGRESS`/`COMPLETED`) or was already resolved another way is left untouched.

**`interview-timeout-finalize`** is the safety net for the messier case: a candidate who *did* start, then disconnected without deliberately ending the call, and never came back within the 30-minute resume window (§4, §6). If the session is still `IN_PROGRESS` at this point, whatever was checkpointed gets scored and finalized exactly as if the candidate had clicked "End Interview" — see §6.2. If the session already reached a terminal state some other way (finished normally, or a lazy join attempt already triggered the same finalize — see §4), this is a no-op.

---

## 4. The candidate clicks the link: the join decision tree

The candidate never logs in. Clicking the meeting-link email opens `apps/admin`'s public `/room/:token` route (`apps/admin/src/pages/Room/Room.tsx`), which lives outside the recruiter's `ProtectedRoute`.

**Browser → agent.** Pressing "Join interview" calls Pipecat's client SDK, which `POST`s straight to `apps/engine` (not `apps/api` — a separate process the browser talks to directly over WebRTC):
```
POST {AGENT_PUBLIC_URL}/start
{ "transport": "webrtc", "body": { "roomToken": "<the token from the URL>" } }
```

**Agent → API.** `agent/voice/server.py`'s `bot()` extracts `roomToken` from the request body and immediately asks `apps/api` what to do — it makes no decision of its own:
```
POST /agent/rooms/join
X-Agent-Webhook-Secret: <AGENT_WEBHOOK_SECRET>
{ "roomToken": "<token>" }
```

**The decision** (`apps/api/src/service/sessionService.ts`'s `getJoinInstruction` — this function *is* the whole join policy):

| Session state found | Instruction returned |
|---|---|
| No session matches this token | `speak_and_end`, "hasn't started yet" |
| `status = COMPLETED` | `speak_and_end`, "already been completed" |
| `status = NO_SHOW` or `CANCELLED` | `speak_and_end`, "link has expired" |
| `status = IN_PROGRESS`, now ≤ `scheduledAt + 30min` | **`resume`** — hands back the checkpointed transcript and questions |
| `status = IN_PROGRESS`, now > `scheduledAt + 30min` | Scores and finalizes the checkpoint in the background (see §7), then `speak_and_end`, "already been completed" |
| `SCHEDULED`/`INVITE_SENT`, now > `scheduledAt + 30min` | Marks the session `NO_SHOW`, then `speak_and_end`, "link has expired" |
| `SCHEDULED`/`INVITE_SENT`, now ≤ deadline, but `checkpointJson` is still `null` | `speak_and_end`, "hasn't started yet" — the `agent-start` job hasn't selected questions yet |
| `SCHEDULED`/`INVITE_SENT`, checkpoint exists | Marks the session `IN_PROGRESS`, returns **`start`** with the selected questions |

The three candidate-facing messages are literal, verbatim strings owned by `apps/api` (`sessionService.ts`'s `MSG_NOT_READY`/`MSG_EXPIRED`/`MSG_ALREADY_COMPLETED`) — the Python side never composes its own wording for these cases, it just speaks whatever string comes back. Example response body for a fresh start:
```json
{
  "statusCode": 200, "success": true, "message": "Join instruction resolved",
  "data": {
    "action": "start",
    "sessionId": 501,
    "candidateName": "Jane Doe",
    "roleName": "Frontend Engineer",
    "selectedQuestions": [
      { "slot": "opener", "competency": "opener", "questionText": "Walk me through your background..." },
      { "slot": "core_competency", "competency": "React", "questionText": "How do you decide when..." }
    ]
  }
}
```

`agent/voice/server.py`'s `bot()` branches on `action` exactly this way: `speak_and_end` builds a minimal TTS-only pipeline that plays the message once and hangs up; `start`/`resume` dispatch into `agent/conversation/manager.py`'s `_run_interview_bot` (§5).

---

## 5. Inside the interview

### 5.1 Pipeline shape

`agent/conversation/manager.py`'s `build_pipeline` wires together, in order:

```
transport.input()  →  STT (speaches)  →  user aggregator (+ Silero VAD)
   →  LLM (Ollama, via OpenAI-compatible API)  →  ProsodyPacingProcessor
   →  TTS (Kokoro)  →  transport.output()  →  assistant aggregator
```

- **STT/TTS** (`agent/stt/client.py`, `agent/tts/client.py`) are thin factories around Pipecat's `OpenAISTTService`/`OpenAITTSService`, pointed at the two self-hosted Docker containers over their OpenAI-compatible endpoints. TTS uses the voice name `"alloy"` even though the actual engine is Kokoro — Pipecat's client rejects any voice name outside real OpenAI's own list before the request ever reaches the container, and `"alloy"` is what passes that client-side check while Kokoro still returns real synthesized audio for it.
- **The user aggregator's `SileroVADAnalyzer`** is what gives the whole pipeline both turn-detection (knowing the candidate has stopped talking) and barge-in (new speech interrupts the bot mid-sentence) — both are Pipecat's own default behavior once a VAD analyzer is wired in, not custom logic. `ENABLE_BARGE_IN=false` removes the analyzer entirely.
- **`ProsodyPacingProcessor`** (`agent/conversation/prosody.py`) sits between the LLM and TTS purely to make the bot's cadence feel less robotic: it buffers the LLM's streamed tokens into whole sentences (reusing Pipecat's own `SimpleTextAggregator`, the same sentence-boundary logic `TTSService` itself uses), forwards each confirmed sentence to TTS immediately, then sleeps briefly before releasing the next one — 140ms normally, 220ms after a short acknowledgement like "Understood." (`SHORT_PAUSE_MS`/`NORMAL_PAUSE_MS` in `agent/config.py`). The sentence currently being spoken is never delayed, only the gap before the next one. An `InterruptionFrame` (candidate barges in) cancels any pending sleep immediately and is never queued behind it — this is Pipecat's own two-task `FrameProcessor` model, not anything built by hand here.

### 5.2 Where the questions come from

`agent/interview/questions.py`'s `select_questions`, called once per session inside the `agent-start` job (§3), not at conversation time:

1. Embed the candidate's CV summary text (skills, years of experience, employers, project descriptions) via the embeddings model.
2. Map the CV's inferred `seniority_signal` (`junior`/`mid`/`senior`) to a target `difficulty` (`EASY`/`MEDIUM`/`HARD`).
3. For each slot in the role's fixed `blueprint`, in order (e.g. `opener` → `cv_probe` → `core_competency: React` → ... → `candidate_questions`):
   - Filter the question bank to this slot's `competency`, excluding questions already used elsewhere in this same interview.
   - Prefer questions matching the target difficulty; fall back to the full competency-matched set if none match.
   - Drop any question whose embedding is too cosine-similar (`> 0.85`) to one already selected for this interview, so slots don't end up asking near-duplicates.
   - Rank what's left by cosine similarity to the candidate's CV embedding, take the top 3.
   - Pick one of those 3 with weighted random sampling, weighted `1 / (1 + timesAsked)` — so less-used questions are favored, keeping phrasing varied across candidates even though the *competencies* tested are fixed by the blueprint.

The result — one `{slot, competency, questionText}` per blueprint slot — is what's reported to `apps/api` and later handed back verbatim on `/agent/rooms/join`'s `start`/`resume` response.

### 5.3 The system prompt

`agent/interview/flow.py`'s `_build_system_instruction` builds one fixed prompt per interview from: the candidate's name and role name, a `/no_think` directive (suppresses the LLM's chain-of-thought preamble for latency, harmless if the configured model doesn't support it), an instruction that the recording/AI-evaluation notice must be the very first thing the bot says, an instruction to ask for clarification rather than guess on unclear audio, the `end_interview` tool-calling instruction (§6.1), the numbered list of selected questions to ask *in order* with 1-2 natural follow-ups each, and (if `ENABLE_ACKNOWLEDGEMENTS`) permission to occasionally open a reply with "Okay," or "Understood." The LLM owns all conversational judgment inside this — which follow-ups to ask, when a question is sufficiently answered — there is no separate turn-by-turn script driving it.

### 5.4 Consent and resume

The first time the pipeline connects to the client (`on_client_ready`), `_run_interview_bot` reports consent once, unconditionally, via `POST /agent/sessions/:id/consent-given` — the assumption being that the system prompt's own first line is exactly the recording/AI-evaluation notice, so "the client is ready" and "the notice is about to be spoken" happen together. This sets `sessions.consentGivenAt`.

If this is a **resume** (candidate reconnecting after a drop within the 30-minute window), the prior transcript from `checkpointJson` is loaded straight into the LLM's context as prior conversation history (`resume_messages` in `build_pipeline`), and a system-injected message tells the LLM to briefly acknowledge the reconnect and continue — not restart or re-ask anything already covered.

---

## 6. Ending the interview

There are exactly two ways a live interview ends deliberately, and one way it ends by accident — all three funnel into the same `reportDisconnect` logic on the API side.

### 6.1 The candidate says so

`agent/interview/flow.py`'s system prompt instructs the LLM: the moment the candidate clearly and explicitly asks to stop (not just answering that something is hard), call the `end_interview` tool with no other words. `agent/conversation/manager.py` registers the handler (`_handle_end_interview_call`): it marks `ended_deliberately = True`, speaks a fixed closing line ("Understood — thank you for your time today...") via the same pipeline, then sends `EndFrame()`.

### 6.2 The candidate clicks "End Interview"

`Room.tsx`'s red hang-up button sends a data-channel message (`sendClientMessage("end_interview")`), waits 300ms to give it time to actually go out, then disconnects. On the agent side, `on_client_message` just sets the same `ended_deliberately` flag — there's no separate code path from §6.1 beyond how the flag gets set.

### 6.3 The connection just drops

Network blip, closed tab, dead battery — `on_client_disconnected` fires with `ended_deliberately` still `False`.

### 6.4 What happens next, either way

`on_client_disconnected` extracts the transcript from the LLM context and calls `orchestrator_client.report_disconnected(session_id, transcript, selected_questions, ended_deliberately)` →
```
POST /agent/sessions/:id/disconnected
{ "transcript": [...], "selectedQuestions": [...], "endedDeliberately": true|false }
```
On the API side (`sessionService.reportDisconnect`):
- **`endedDeliberately: true`** → scores immediately and finalizes (§7) — the candidate is done, no reason to wait.
- **`endedDeliberately: false`** → just writes `checkpointJson = { transcript, selectedQuestions }` and leaves `status` as `IN_PROGRESS`. If the candidate reconnects within 30 minutes of `scheduledAt`, §4's `resume` branch picks this back up. If they don't, `interview-timeout-finalize` (§3) scores and finalizes it for them once the window closes.

A stale-connection guard (`agent/voice/ready_rooms.py`, an in-process counter keyed by room token — the only in-memory state left in the whole agent process) makes sure that if a candidate reconnects *before* their old connection's disconnect handler has run, the old handler recognizes a newer connection has already taken over and skips reporting, rather than racing to report the same disconnect twice.

---

## 7. Scoring and the report

Scoring is the one call that runs backwards: `apps/api` has decided a session is over, but only `apps/engine` has an LLM client, so `apps/api` calls back into it.

`apps/api/src/lib/agentClient.ts`'s `scoreInterview`:
```
POST {AGENT_URL}/score
X-Agent-Webhook-Secret: <AGENT_WEBHOOK_SECRET>
{ "transcript": [...], "selectedQuestions": [...], "roleName": "Frontend Engineer" }
```
(3-minute timeout — a local Ollama model scoring several competencies can be slow.)

`agent/interview/evaluator.py`'s `score_interview`, on the receiving end: for each *distinct* competency actually asked (de-duplicated, since a blueprint asks each competency's slot once), hand the LLM the full transcript and ask it to score 1–5 with a mandatory verbatim quote as evidence:
```json
{
  "role": "Frontend Engineer",
  "scores": [
    { "slot": "core_competency", "competency": "React", "score": 4,
      "evidence": "I usually reach for a shared store once two sibling components need the same state" },
    { "slot": "behavioral", "competency": "behavioral", "score": 3,
      "evidence": "..." }
  ]
}
```

Back on the API side, `finalizeSession`:
1. Writes `transcript`, `reportJson`, `status → COMPLETED`, and clears `checkpointJson` (nothing left to resume).
2. If a report came back, enqueues a `report-ready` email to **every** recruiter (`User` row) — not just whoever scheduled it.

The recruiter opens the session's detail page in `apps/admin` and sees the transcript and the per-competency scores with their quoted evidence. This candidate-evaluation report is the only scoring this system does — there's no separate evaluation of the AI interviewer's own conduct.

---

## Appendix A — Full API reference

All recruiter-facing routes require the `token` httpOnly JWT cookie (`authMiddleware.ts`). All agent-facing routes require the `X-Agent-Webhook-Secret` header (`webhookAuthMiddleware.ts`) instead — the agent is a Python process, not a logged-in recruiter, so it can't carry that cookie. Every response is wrapped in `{ statusCode, success, message, data }` (`apiResponse.ts`).

### Recruiter-facing (`apps/api`, cookie auth)

| Method & path | Body | Notes |
|---|---|---|
| `POST /auth/login` | `{ email, password }` | Sets the `token` cookie |
| `POST /auth/logout` | — | Clears the cookie |
| `GET /auth/me` | — | Current recruiter, from the JWT |
| `GET /candidates` | — | All candidates |
| `POST /candidates` | `multipart/form-data`: `email`, `name?`, `cv` (file) | `201`; enqueues `cv-parse` |
| `DELETE /candidates/:id` | — | Cascades to all of that candidate's sessions |
| `GET /sessions` | — | All sessions, with candidate + role |
| `GET /sessions/:id` | — | One session |
| `POST /sessions` | `{ candidateId, roleId, scheduledAt }` | `201` |
| `POST /sessions/:id/send-invite` | — | See §2.3 |
| `DELETE /sessions/:id` | — | Only this session |
| `GET /roles` | — | All roles |
| `GET /questions` | — | Read-only bank view — grown by `apps/engine`, not authored here |

### Agent-facing (`apps/api`, webhook-secret auth) — see §4, §5.4, §6.4

| Method & path | Body | Returns |
|---|---|---|
| `POST /agent/rooms/join` | `{ roomToken }` | A `JoinInstruction` — see §4's table |
| `POST /agent/sessions/:id/questions-selected` | `{ selectedQuestions: [{slot, competency, questionText}] }` | — |
| `POST /agent/sessions/:id/consent-given` | — | — |
| `POST /agent/sessions/:id/disconnected` | `{ transcript, selectedQuestions, endedDeliberately }` | — |

### Engine-facing (`apps/engine`, webhook-secret auth, the one reverse call)

| Method & path | Body | Returns |
|---|---|---|
| `POST /score` | `{ transcript: [{role, content}], selectedQuestions, roleName }` | `{ report: {...} }` — see §7 |

---

## Appendix B — Database fields

`packages/db/prisma/schema.prisma` — four models, four enums-backed status transitions.

**`InterviewSessionStatus`**: `SCHEDULED → INVITE_SENT → IN_PROGRESS → COMPLETED`, with `NO_SHOW` and `CANCELLED` as side exits. Every transition and who triggers it is covered in §2–§7 above.

| Field (on `InterviewSession`) | Written by | Meaning |
|---|---|---|
| `meetingUrl` | `sendInvite` | Also the source of the room token (its trailing path segment) |
| `checkpointJson` | `questions-selected`, `disconnected` (accidental) | `{ transcript, selectedQuestions }` — cleared on finalize |
| `consentGivenAt` | `consent-given` | Set once, on first connect |
| `transcript` / `reportJson` | `finalizeSession` | The final, permanent record |

---

## Appendix C — BullMQ queues and jobs

| Queue | Producer | Consumer | Jobs |
|---|---|---|---|
| `agent-jobs` | `apps/api` (`agentQueue.ts`) | `apps/engine` (`jobs/consumer.py`, concurrency 1) | `cv-parse`, `agent-start` |
| `orchestrator-jobs` | `apps/api` (`orchestratorQueue.ts`) | `apps/api`, in-process (`orchestratorWorker.ts`, concurrency 5) | `noshow-check`, `interview-timeout-finalize` |
| `email` | `apps/api` (via `@repo/mailer`'s `enqueueEmail`) | `packages/mailer`, its own process (concurrency 1, rate-limited 10/sec) | `interview-invite`, `interview-followup`, `interview-meeting-link`, `report-ready` |

`agent-jobs` and `orchestrator-jobs` are deliberately separate queues even though both ultimately serve "interview timing" — `agent-jobs` holds content-preparation work Python does (CV parsing, question selection), `orchestrator-jobs` holds pure session-status timing decisions `apps/api` now owns outright. This split is what makes the "engine executes, API decides" boundary hold at the infrastructure level, not just in code review.

---

## Appendix D — Config reference

The full list lives in each app's `.env`; the ones that matter for this document:

| Var | Where | Purpose |
|---|---|---|
| `AGENT_WEBHOOK_SECRET` | both `apps/api` and `apps/engine` | Must match — authenticates every call in both directions |
| `AGENT_URL` / `API_URL` | `apps/api` / `apps/engine` | Where each process reaches the other |
| `ADMIN_PUBLIC_URL`, `ADMIN_PORT` | `apps/api` | Builds `meetingUrl` and the report-ready email's session link |
| `VITE_AGENT_PUBLIC_URL` | `apps/admin` | Where the candidate's browser opens its WebRTC connection |
| `SIMILARITY_REJECTION_THRESHOLD` | `apps/engine` | Question de-duplication cutoff, §5.2 |
| `ENABLE_INTERVIEW_PROSODY`, `SHORT_PAUSE_MS`, `NORMAL_PAUSE_MS`, `ENABLE_ACKNOWLEDGEMENTS` | `apps/engine` | Speech cadence, §5.1/§5.3 |
| `ENABLE_BARGE_IN` | `apps/engine` | Whether the VAD analyzer (and therefore turn-detection + barge-in) is wired in at all, §5.1 |
