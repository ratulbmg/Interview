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
 * Session.checkpointJson.selectedQuestions. */
export type SelectedQuestionDto = {
  slot: string;
  competency: string;
  questionText: string;
};
