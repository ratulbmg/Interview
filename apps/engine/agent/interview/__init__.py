"""Content-prep domain logic: CV parsing, the question bank, question
selection, and the live-interview system-prompt builder. Session-lifecycle
state and timing decisions (is this candidate too early, has the link
expired, is this a fresh start or a resume) live in apps/api now — see
agent/orchestrator_client.py — not here.
"""
