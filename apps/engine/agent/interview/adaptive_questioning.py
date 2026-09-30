"""Drives question-by-question progression during a live interview.

This is interview-domain logic, not voice mechanics: it tracks which
selected question is current, invokes answer_analyzer.py and
followup_policy.py after each answer, tracks which questions remain, and
decides what the candidate hears next (a follow-up, the next question, or
the close). It lives in interview/ for the same reason questions.py and
flow.py do — conversation/ stays limited to the actual voice pipeline
(STT/TTS/VAD/turn handling/pacing/interruption), never interview content or
decisions.

The one thing this class IS entangled with mechanically: it has to run as a
Pipecat FrameProcessor, sitting between the user context aggregator and the
LLM in the pipeline (see agent/conversation/manager.py's build_pipeline) —
the same "intercept what's about to reach the next stage" position
agent/conversation/prosody.py's ProsodyPacingProcessor occupies between the
LLM and TTS. Pipecat's push_context_frame() (see the installed
LLMUserAggregator source) pushes an LLMContextFrame carrying the pipeline's
actual LLMContext object BY REFERENCE, not a copy — so adding a message to
`frame.context` here, before forwarding the frame, is genuinely what the
LLM sees for this turn. No new LLM call is inserted into the turn itself;
the analysis call below runs in a worker thread (asyncio.to_thread) and
completes before the frame is forwarded, so the LLM only ever sees the
context after the directive lands.

Known limitation, by design: the first user turn of a connection is always
treated as the candidate's consent confirmation, never analyzed as an
answer (see _awaiting_consent_turn) — a fresh start's very first real reply
is consent ("yes, go ahead"), not a substantive answer. On resume, that
skip doesn't apply (consent was already given on the earlier connection),
but this processor also doesn't re-inject "ask this question now" for the
in-flight question on resume — the existing resume directive
(agent/conversation/manager.py's "_run_interview_bot") already tells the
LLM to continue naturally from the transcript, so re-injecting here would
risk an awkward literal re-ask.
"""

import asyncio

from loguru import logger
from pipecat.frames.frames import Frame, LLMContextFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from agent.interview.answer_analyzer import AnalyzerInput, analyze_answer
from agent.interview.followup_policy import FollowupPolicyInput, decide_next_action
from agent.interview.interview_state import InterviewState
from agent.interview.questions import SelectedQuestion


class AdaptiveQuestioningProcessor(FrameProcessor):
    def __init__(self, selected_questions: list[SelectedQuestion], is_resume: bool, **kwargs):
        super().__init__(**kwargs)
        self._questions = selected_questions
        self._index = 0
        self._awaiting_consent_turn = not is_resume

        current = self._current_question()
        # Fresh start: no directive injected yet — the first LLMContextFrame
        # through process_frame() below triggers it. Resume: the question is
        # already in flight from before the disconnect; don't re-announce it,
        # just track it so analysis resumes correctly on the next answer.
        self._state = (
            InterviewState.for_question(current.question.id, current.competency, current.question.question_type, current.question.expected_signals)
            if (is_resume and current is not None)
            else None
        )

    @property
    def remaining_questions(self) -> list[SelectedQuestion]:
        """Whatever hasn't been fully covered yet — agent/conversation/
        manager.py reports exactly this list (not the original full list)
        back to apps/api on disconnect, so a resume picks up here instead
        of repeating already-completed questions."""
        return self._questions[self._index :]

    def _current_question(self) -> SelectedQuestion | None:
        return self._questions[self._index] if self._index < len(self._questions) else None

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if not isinstance(frame, LLMContextFrame):
            await self.push_frame(frame, direction)
            return

        question = self._current_question()
        if question is None:
            # Every selected question already covered — nothing left to
            # drive; let the LLM's own closing instruction (already
            # delivered via the wrap-up directive below, the last time a
            # question completed) carry the conversation to its end.
            await self.push_frame(frame, direction)
            return

        if self._state is None:
            # The very first question of a fresh start — nothing to
            # analyze yet, just announce it.
            self._state = InterviewState.for_question(question.question.id, question.competency, question.question.question_type, question.question.expected_signals)
            self._inject_ask_question(frame, question)
            await self.push_frame(frame, direction)
            return

        if self._awaiting_consent_turn:
            # This is the candidate's response to the recording/AI-
            # evaluation notice ("yes, go ahead"), not an answer to the
            # question above — skip analysis for exactly this one turn.
            self._awaiting_consent_turn = False
            await self.push_frame(frame, direction)
            return

        answer_text = self._latest_candidate_utterance(frame)
        if answer_text is None:
            await self.push_frame(frame, direction)
            return

        try:
            analysis = await asyncio.to_thread(
                analyze_answer,
                AnalyzerInput(
                    question_text=question.question.text,
                    objective=question.question.objective,
                    expected_signals=question.question.expected_signals,
                    answer_text=answer_text,
                    previously_covered_signals=self._state.covered_signals,
                ),
            )
        except asyncio.CancelledError:
            # A barge-in landed while this analysis was in flight (see
            # Pipecat's own interruption handling, invoked via super().
            # process_frame() above, which cancels this processor's
            # in-progress task). Forward the frame as-is rather than
            # losing the candidate's turn entirely — the next answer's
            # analysis will still have this one in the transcript context
            # even though it wasn't scored against expected signals.
            await self.push_frame(frame, direction)
            raise

        self._state.apply_analysis(analysis.covered_signals, analysis.missing_signals, analysis.answer_quality, answer_text)

        decision = decide_next_action(
            FollowupPolicyInput(
                state=self._state,
                analysis=analysis,
                max_followups=question.question.max_followups,
                max_duration_seconds=question.question.max_duration_seconds,
            )
        )

        logger.info(
            f"adaptive_questioning: question_id={question.question.id} competency={question.competency} "
            f"question_type={question.question.question_type} covered_signals={self._state.covered_signals} "
            f"missing_signals={self._state.missing_signals} answer_quality={analysis.answer_quality} "
            f"followup_count={self._state.followup_count} elapsed_topic_seconds={self._state.elapsed_seconds():.0f} "
            f"policy_decision={decision}"
        )

        if decision == "FOLLOW_UP":
            self._state.record_followup_asked()
            self._inject_followup_directive(frame, self._state.missing_signals)
        else:
            self._index += 1
            next_question = self._current_question()
            if next_question is None:
                self._inject_wrap_up_directive(frame)
                self._state = None
            else:
                self._state = InterviewState.for_question(
                    next_question.question.id, next_question.competency, next_question.question.question_type, next_question.question.expected_signals
                )
                self._inject_ask_question(frame, next_question)

        await self.push_frame(frame, direction)

    def _latest_candidate_utterance(self, frame: LLMContextFrame) -> str | None:
        """The context's last message is always the candidate's just-
        aggregated turn at the moment this runs — this function only ever
        reads it, and every directive this class injects is added
        afterwards, so it never mistakes its own injected text for
        something the candidate said."""
        messages = frame.context.messages
        if not messages:
            return None
        last = messages[-1]
        if last.get("role") != "user":
            return None
        content = last.get("content")
        return content if isinstance(content, str) else None

    def _inject_ask_question(self, frame: LLMContextFrame, question: SelectedQuestion) -> None:
        frame.context.add_message(
            {
                "role": "user",
                "content": f'[INTERVIEWER DIRECTIVE — do not read this aloud: ask the candidate this question now, naturally: "{question.question.text}"]',
            }
        )

    def _inject_followup_directive(self, frame: LLMContextFrame, missing_signals: list[str]) -> None:
        focus = ", ".join(missing_signals) if missing_signals else "the parts of the question not yet addressed"
        frame.context.add_message(
            {
                "role": "user",
                "content": (
                    "[INTERVIEWER DIRECTIVE — do not read this aloud: the candidate's answer didn't fully cover this "
                    f"topic. Ask ONE short, natural follow-up question that specifically probes: {focus}. "
                    "Do not move to a new topic yet, and do not ask about anything already sufficiently covered.]"
                ),
            }
        )

    def _inject_wrap_up_directive(self, frame: LLMContextFrame) -> None:
        frame.context.add_message(
            {
                "role": "user",
                "content": (
                    "[INTERVIEWER DIRECTIVE — do not read this aloud: that was the last question. Thank the "
                    "candidate, let them know the interview is complete, say goodbye, and stop talking.]"
                ),
            }
        )
