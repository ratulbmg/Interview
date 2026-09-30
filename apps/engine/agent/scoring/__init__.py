"""Post-interview evaluation: the /score route apps/api calls into this
agent for (routes.py, schemas.py), the wire-format conversion helpers
between the DB-shaped question and the checkpoint DTO (serializers.py), and
the actual scoring logic — evaluator.py orchestrates two independent
passes over the finished transcript, competency_scorer.py (does the
transcript demonstrate each technical competency asked) and
dimension_scorer.py (how did the candidate perform across the whole
interview on seven behavioral/professional dimensions), then
aggregation.py combines both into one structured result with no arbitrary
overall score. Rubric prompt text lives in prompts/, not in the scorer
modules themselves.

/score is the one inbound HTTP call in the whole package — everything else
in the orchestrator/executor relationship flows the other way, through
agent/orchestrator_client.py.
"""
