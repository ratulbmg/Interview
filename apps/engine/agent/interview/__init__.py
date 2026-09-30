"""Interview-domain logic: CV parsing, question selection, the live-interview
system prompt (prompt.py), question-by-question progression and adaptive
follow-up reasoning (adaptive_questioning.py, interview_state.py,
answer_analyzer.py, followup_policy.py), and agent_data_client.py — the one
way this process reads or writes anything apps/api owns in Postgres.

Post-interview scoring lives in agent/scoring/ instead, not here — this
package conducts the interview, it doesn't judge it afterward. Session-
lifecycle state and timing decisions (is this candidate too early, has the
link expired, is this a fresh start or a resume) live in apps/api — see
agent/orchestrator_client.py — not here either.
"""
