export interface ScheduleSessionRequest {
  candidateId: number;
  roleId: number;
  scheduledAt: string;
}

/** One turn of the interview transcript — matches the shape both apps/api
 * and apps/engine agree on for Session.transcript /
 * Session.checkpointJson.transcript entries. Lives here (not
 * sessionService.ts) so lib/agentClient.ts can import it without a
 * circular dependency back on the service. */
export type TranscriptTurn = {
  role: string;
  content: string;
};

/** One question apps/engine selected for the interview (from its
 * question bank, via embeddings) — persisted into
 * Session.checkpointJson.selectedQuestions, and handed back to the agent
 * verbatim on every /agent/rooms/join "start"/"resume" instruction. Carries
 * the adaptive-questioning metadata (see Question.questionType/objective/
 * expectedSignals/maxFollowups/maxDurationSeconds in schema.prisma) through
 * that whole round-trip — apps/engine's agent/interview/questions.py only
 * has the full Question row available once, at agent-start selection time;
 * everything downstream (a fresh "start", or a "resume" after a dropped
 * connection) reconstructs SelectedQuestion from exactly this DTO, so a
 * field missing here is a field the live interview's answer_analyzer.py
 * and followup_policy.py can never see. */
export type SelectedQuestionDto = {
  id: number;
  slot: string;
  competency: string;
  questionText: string;
  difficulty: string;
  questionType: string;
  objective: string | null;
  expectedSignals: string[];
  maxFollowups: number;
  maxDurationSeconds: number;
};

/** What apps/engine's ServiceMetricsObserver actually measured for one
 * connection segment (see agent/conversation/manager.py) — reported on
 * every disconnect and added to whatever the session already has (see
 * sessionRepository.incrementUsage), never overwritten, so a
 * drop-and-resume's later segment adds to the earlier one instead of
 * replacing it. All optional so an older agent build that hasn't been
 * redeployed yet can still call /disconnected without this field. */
export type DisconnectUsageDto = {
  llmPromptTokens?: number;
  llmCompletionTokens?: number;
  sttAudioSeconds?: number;
  ttsCharacters?: number;
  interviewSeconds?: number;
};

/** One row on the recruiter-facing Results screen — a completed, scored
 * session plus the Eligible/Not Eligible verdict derived from it (see
 * lib/eligibility.ts). `negativePoints` is only ever non-empty for a
 * session that scored low on something; an Eligible candidate typically
 * has none. */
export type SessionResult = {
  sessionId: number;
  candidateName: string;
  candidateEmail: string;
  roleName: string;
  scheduledAt: string;
  overallPercentage: number;
  eligible: boolean;
  negativePoints: { label: string; score: number; evidence: string }[];
  /** Score only, per dimension — see lib/eligibility.ts's DimensionSummary.
   * Used by the recruiter Dashboard's evaluation-summary section to
   * average each dimension across sessions, not by the Results screen
   * itself (which only needs the aggregate percentage/verdict). */
  dimensionScores: { dimension: string; score: number }[];
};
