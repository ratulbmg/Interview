"""A standalone, text-only interview practice tool — predates the live voice
agent (agent/voice/) and never goes through it or apps/api. Run with:

    python -m agent.legacy_cli.cli --cv sample.pdf --role "Frontend Engineer"

Kept isolated from agent/conversation, agent/interview, and agent/voice
on purpose: this tool's interview_loop.py/scorer.py make real turn-by-turn
judgment calls (which follow-up to ask, when to move on) appropriate for an
offline practice CLI, but not appropriate to blend into the live voice
agent's structure, where apps/api owns every session-lifecycle decision.
"""
