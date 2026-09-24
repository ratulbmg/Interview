-- Prisma doesn't diff the contents of Unsupported() type strings, so this
-- migration is hand-written rather than generated. Safe because
-- questions.embedding is entirely NULL at this point (no OPENAI_API_KEY
-- was ever available in this environment to actually backfill one via
-- question_selector.py's _embedding_for) — a real ALTER on a populated
-- 1536-dim column would need a re-embed pass first, not just a type change.
ALTER TABLE "questions" ALTER COLUMN "embedding" TYPE vector(768);
