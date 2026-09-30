export interface CreateQuestionRequest {
  text: string;
  competency: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  questionType: "ROLE" | "CV_BASED" | "GAP" | "SCENARIO" | "BEHAVIORAL";
  objective?: string | null;
  expectedSignals: string[];
  maxFollowups: number;
  maxDurationSeconds: number;
}

export interface UpdateQuestionRequest {
  text?: string;
  competency?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  tags?: string[];
  questionType?: "ROLE" | "CV_BASED" | "GAP" | "SCENARIO" | "BEHAVIORAL";
  objective?: string | null;
  expectedSignals?: string[];
  maxFollowups?: number;
  maxDurationSeconds?: number;
}
