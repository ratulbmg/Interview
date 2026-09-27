"""Transcript extraction from a live pipeline's LLM context. Relocated
from agent/voice/pipeline.py, verbatim.
"""

from pipecat.processors.aggregators.llm_context import LLMContext


def extract_transcript(context: LLMContext) -> list[dict]:
    """context.messages holds only the user/assistant turns — the system
    prompt is a service setting (OpenAILLMService.Settings.system_instruction),
    not a context message, under this Pipecat version's pattern."""
    return [{"role": m.get("role"), "content": m.get("content")} for m in context.messages]
