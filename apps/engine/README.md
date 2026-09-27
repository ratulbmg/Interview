# engine

A Pipecat-based voice interview bot: it runs the live STT → LLM → TTS
conversation with a candidate, plus the supporting CV-parsing, question-
selection, and transcript-scoring pipeline around it. Not a yarn workspace
member — a standalone Python app (its own `.venv`), spawned by
`scripts/dev.mjs` alongside the TypeScript apps.

apps/api is "the orchestrator" for this whole system: it owns every session-
lifecycle decision (is this candidate too early, has the link expired, is
this a fresh start or a resume, what exactly the bot should say) and this
agent is a pure executor that asks it what to do and reports back what
happened. Keep that in mind reading through the rest of this doc — nowhere
below does the agent decide on its own that an interview is "done" or
"expired"; it only acts on an instruction from apps/api.

## 1. Architecture at a glance

```
agent/
├── api/                    inbound HTTP surface apps/api calls into this agent
├── orchestrator_client.py  outbound HTTP client this agent calls apps/api with
├── config.py               all env-var-driven configuration, one place
├── conversation/           the live voice pipeline: build it, run it, log it, pace it
├── interview/              interview content: CV parsing, question selection, the
│                           system prompt, transcript scoring — no I/O to apps/api
├── jobs/                   BullMQ consumer (cv-parse / engine-start background jobs)
├── llm/                    LLM provider client (OpenAI-compatible)
├── stt/                    STT provider factory (OpenAI-compatible)
├── tts/                    TTS provider factory (OpenAI-compatible)
├── voice/                  FastAPI/Pipecat process entrypoint + WebRTC connection glue
├── legacy_cli/             a separate, unrelated text-only CLI practice tool —
│                           NOT part of the voice/API-orchestrator system above
└── log_setup.py            loguru configuration
```

## 2. Folder responsibilities

- **`conversation/`** — the live pipeline itself. `manager.py` builds the
  STT → LLM → prosody → TTS `Pipeline` for one call (`build_pipeline`) and
  drives it for the lifetime of a WebRTC connection (`_run_interview_bot`),
  or speaks a single message and hangs up (`_speak_and_end`) when apps/api
  says the candidate can't join right now. `state.py` extracts a plain
  `[{role, content}, ...]` transcript out of the live `LLMContext`.
  `logging.py` is a `BaseObserver` that prints a clean, human-readable
  transcript to the terminal (candidate said / interviewer said), separate
  from Pipecat's own frame-level debug logging. `turn_manager.py` is a
  typed snapshot of the speech-cadence config (`TurnTimingConfig`) so the
  pacing processor doesn't read env vars directly. `prosody.py`
  (`ProsodyPacingProcessor`) sits between the LLM and TTS and inserts a
  short pause between the bot's own spoken sentences.
- **`interview/`** — everything about interview *content*, with no
  awareness of apps/api or session lifecycle. `cv.py` turns a CV PDF into a
  structured `CandidateProfile` via the LLM. `db.py` is direct, read-mostly
  Postgres access (candidate/role/question-bank rows) — this agent isn't a
  Prisma client, it talks to the same database with hand-written SQL.
  `questions.py` (`select_questions`) fills a role's blueprint slots with
  questions from the bank, biased by CV relevance and by how often a
  question's already been asked. `flow.py`
  (`_build_system_instruction`) turns a candidate + role + selected
  questions into the LLM's system prompt — pure string templating, no
  branching on *when* the interview ends. `evaluator.py`
  (`score_interview`) is the rubric-based LLM scorer for a finished
  transcript.
- **`llm/`, `stt/`, `tts/`** — one thin provider client/factory each, all
  wrapping OpenAI-compatible HTTP APIs. Nothing outside these three files
  should need to know which concrete provider or SDK class is in use.
- **`api/`** — the one inbound HTTP surface this agent exposes: `POST
  /score` (`routes.py`), authenticated by the same shared-secret header
  this agent uses on its own outbound calls. `schemas.py` holds the
  Pydantic request/response models plus the `SelectedQuestion` ⇄
  `{slot, competency, questionText}` conversion helpers shared by the
  `/score` payload and apps/api's join-instruction payload.
- **`jobs/`** — `consumer.py`, a BullMQ worker (concurrency 1) draining the
  `agent-jobs` queue apps/api enqueues onto: `cv-parse` (parse a newly
  added candidate's CV ahead of time) and `engine-start` (pick this
  interview's questions ~2 minutes before it starts, then report the
  selection back to apps/api via `orchestrator_client.save_selected_questions`).
  Infra/queue plumbing, not domain logic.
- **`voice/`** — `server.py` is the process entrypoint: hosts the
  Pipecat/FastAPI WebRTC signaling server, mounts the `/score` router, and
  starts the BullMQ consumer on startup. `bot()` is the one place that asks
  `orchestrator_client.join()` what to do for an incoming connection and dispatches
  into `conversation/manager.py` accordingly. `ready_rooms.py` is a tiny
  per-process live-connection counter used only to tell a genuine
  disconnect apart from a stale handler firing after a reconnect — not a
  business-state cache (apps/api owns all of that now).

## 3. How the conversation flow works end to end

```
candidate speech
      │
      ▼
   transport.input()  (WebRTC audio in)
      │
      ▼
      STT            agent/stt/client.py — OpenAI-compatible /v1/audio/transcriptions
      │
      ▼
 user aggregator      buffers transcribed text into a turn (VAD-gated — see §6)
      │
      ▼
      LLM             agent/interview/flow.py's system prompt + conversation so far
      │
      ▼
  prosody pacing       agent/conversation/prosody.py — inserts a short pause
      │                between spoken sentences (longer after a brief
      │                acknowledgement), never touches interview content
      ▼
      TTS             agent/tts/client.py — OpenAI-compatible /v1/audio/speech
      │
      ▼
  transport.output()  (WebRTC audio out)
```

Where apps/api ("the orchestrator") fits in: it is consulted once, at connect time
(`orchestrator_client.join(room_token)` — is this candidate allowed in right now,
fresh start or resume, what are the selected questions), and it's told
about two events after that (`report_consent_given`,
`report_disconnected` with the final transcript). It does **not** sit
anywhere in the live audio path above — once a conversation is running,
this agent drives STT/LLM/TTS entirely on its own, with the question flow
already baked into the system prompt (the LLM asks its own natural
follow-ups turn by turn; there's no separate turn-by-turn orchestration
loop). The only other thing apps/api calls back into this agent for is
scoring a finished interview (`POST /score`), since only this process has
an LLM client wired up.

## 4. Configuring STT / LLM / TTS

All in `agent/config.py`, all env-var-driven with sane local-dev defaults
(loaded from `apps/engine/.env`):

| Purpose | Vars | Local dev default |
|---|---|---|
| Chat LLM (CV parsing, scoring, voice conversation) | `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_CHAT_MODEL` | native Ollama, `http://localhost:11434/v1` |
| Voice-specific chat model override | `VOICE_LLM_MODEL` | same as `LLM_CHAT_MODEL` |
| Embeddings (question-relevance ranking) | `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `LLM_EMBEDDING_MODEL` | Dockerized Ollama on `:11435`, `nomic-embed-text` |
| Speech-to-text | `STT_BASE_URL`, `STT_API_KEY`, `VOICE_STT_MODEL` | Dockerized speaches (faster-whisper), `http://localhost:8000/v1` |
| Text-to-speech | `TTS_BASE_URL`, `TTS_API_KEY`, `VOICE_TTS_VOICE` | Dockerized kokoro-fastapi, `http://localhost:8880/v1`, voice `alloy` |

All three are plain OpenAI-compatible `/v1` APIs, so any compatible
server works (Ollama, LM Studio, llama.cpp's `llama-server`, or real
OpenAI with a real key) — see §8 for how to swap providers.

## 5. Configuring conversational timing

Also in `agent/config.py`, read into a typed `TurnTimingConfig` by
`agent/conversation/turn_manager.py::load_turn_timing_config()`:

| Var | Default | What it does |
|---|---|---|
| `ENABLE_INTERVIEW_PROSODY` | `true` | Master switch for the pause-insertion processor between the LLM and TTS (`ProsodyPacingProcessor`). `false` restores the old behavior exactly — no processor-inserted gaps. |
| `ENABLE_ACKNOWLEDGEMENTS` | `true` | Whether the system prompt tells the LLM it's okay to occasionally open a reply with a brief acknowledgement ("Okay,", "Understood,"). The LLM still decides if/when — this only enables the guidance line. |
| `ACKNOWLEDGEMENT_PROBABILITY` | `0.25` | A rough ceiling communicated to the LLM for how often to use one of those acknowledgements — a suggested upper bound, not an enforced rate. |
| `SHORT_PAUSE_MS` | `140` | Pause inserted after an ordinary sentence boundary in the bot's speech. |
| `NORMAL_PAUSE_MS` | `220` | Pause inserted after a sentence that was just a brief acknowledgement, before the bot continues. |
| `LONG_PAUSE_MS` | `400` | Reserved for a coarser pause (e.g. between one question topic and the next) — not wired into any processor yet. |
| `ENABLE_BARGE_IN` | `true` | See §6. |

All of these are starting points meant to be tuned by ear once
live-tested, not values derived from measurement.

## 6. How interruption / barge-in works

Barge-in (the candidate's speech interrupting the bot's TTS mid-sentence)
and turn detection (knowing when the candidate has finished speaking) are
both **built into Pipecat via VAD** (`SileroVADAnalyzer` on the user
aggregator, wired up in `conversation/manager.py::build_pipeline`) — not
custom code. Wiring a VAD analyzer into the user aggregator is what turns
both behaviors on as pipecat's default handling; nothing in this agent
implements interruption logic by hand.

`ENABLE_BARGE_IN` is a real, structural toggle, not cosmetic: when true,
`build_pipeline` constructs a `SileroVADAnalyzer` and passes it to the
user aggregator; when false, it passes `vad_analyzer=None`, which actually
removes turn detection/barge-in from the pipeline entirely. The VAD
analyzer's `stop_secs` is bumped to `0.8` (from Pipecat's `0.2` default) so
a normal mid-sentence pause doesn't get mistaken for the candidate being
done talking.

The `ProsodyPacingProcessor` pause (§5) is explicitly barge-in-safe: an
`InterruptionFrame` cancels any pause it's mid-sleep on immediately rather
than waiting it out (see the module docstring in `conversation/prosody.py`
for exactly how Pipecat's two-task-per-processor model makes that true
without any special-casing here).

## 7. Running the application

Prerequisites, in order (see root `docker-compose.yml` and
`scripts/dev.mjs`, which check for and fail fast on these rather than
starting them):

1. `yarn ollama_up` — native Ollama, serving the chat model
   (GPU/Metal passthrough; not run in Docker on Mac).
2. `yarn docker_up` — the four Dockerized appliances this agent needs:
   Redis (BullMQ), the STT container (speaches), the TTS container
   (kokoro-fastapi), and a second, dedicated Ollama instance for
   embeddings. (Mailpit also comes up here, but that's for apps/api's
   emails, not this agent.)
3. Postgres — a cloud instance (Neon; see `packages/db/.env`), not started
   locally at all.

With those up, either:

- `yarn dev` from the repo root — starts this agent (`.venv/bin/python -m
  agent.voice.server`) alongside apps/api, the admin app, and the mailer
  via turbo, all in one terminal.
- Or, standalone, from `apps/engine`: `.venv/bin/python -m
  agent.voice.server` (needs apps/api reachable at `API_URL` for
  `orchestrator_client` calls to succeed once a real candidate connects).

First run: `yarn agent:build` from the repo root creates
`apps/engine/.venv` and `pip install -e .`s this package into
it.

## 8. Replacing an STT / TTS / LLM provider

Since all three are OpenAI-compatible-API wrappers today, swapping a
provider should only ever mean editing one file:

- **STT** → `agent/stt/client.py` (`build_stt_service`)
- **TTS** → `agent/tts/client.py` (`build_tts_service`)
- **LLM** → `agent/llm/client.py` (`chat_json`, `chat_text`, `embed`)

Each is a thin factory/wrapper around a pipecat service class or the
`openai` SDK client, reading its own base URL / API key / model name out
of `agent/config.py` (§4). Everything else in the codebase calls through
these factories rather than constructing a provider client directly, so a
provider swap (e.g. moving off Ollama to real OpenAI, or Kokoro to a
different TTS engine) shouldn't require touching `conversation/`,
`interview/`, or `voice/` at all — only the config values and, if the new
provider isn't OpenAI-API-compatible, the one relevant client file.
