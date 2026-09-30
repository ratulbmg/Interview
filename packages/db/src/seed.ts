import { prisma } from "./index";
import bcrypt from "bcryptjs";

/**
 * Seed data for local development: one recruiter account, two roles with
 * real blueprints, and a question bank spanning the slots those blueprints
 * reference.
 *
 * A blueprint is an ordered array of slot objects. `competency` on a slot
 * is the value matched against Question.competency at selection time (see
 * apps/engine's agent/interview/questions.py, Phase 2): for "opener",
 * "cv_probe", "scenario", "behavioral" and "candidate_questions" slots it's
 * just the slot name itself; "core_competency" slots name a specific skill
 * instead.
 *
 * `questionType`/`objective`/`expectedSignals` drive the live interview's
 * adaptive follow-up logic (see apps/engine's agent/interview/
 * answer_analyzer.py and followup_policy.py) — `expectedSignals` are
 * specific pieces of evidence an answer should provide, not generic
 * keywords (a signal like "personal_contribution" is checkable; "React" or
 * "experience" isn't).
 */

const FRONTEND_BLUEPRINT = [
  { slot: "opener" },
  { slot: "cv_probe" },
  { slot: "core_competency", competency: "React" },
  { slot: "core_competency", competency: "JavaScript" },
  { slot: "core_competency", competency: "CSS" },
  { slot: "scenario" },
  { slot: "behavioral" },
  { slot: "candidate_questions" },
];

const BACKEND_BLUEPRINT = [
  { slot: "opener" },
  { slot: "cv_probe" },
  { slot: "core_competency", competency: "API Design" },
  { slot: "core_competency", competency: "Databases" },
  { slot: "core_competency", competency: "System Design" },
  { slot: "scenario" },
  { slot: "behavioral" },
  { slot: "candidate_questions" },
];

const QUESTIONS: {
  text: string;
  competency: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  questionType: "ROLE" | "CV_BASED" | "GAP" | "SCENARIO" | "BEHAVIORAL";
  objective: string;
  expectedSignals: string[];
}[] = [
  // opener
  {
    text: "Walk me through your background and what brought you to apply for this role.",
    competency: "opener",
    difficulty: "EASY",
    tags: ["intro"],
    questionType: "ROLE",
    objective: "Get a concise, coherent overview of the candidate's background and genuine motivation for this specific role.",
    expectedSignals: ["relevant_background_summary", "motivation_for_role"],
  },
  {
    text: "In a couple of sentences, how would you describe what you do to someone outside tech?",
    competency: "opener",
    difficulty: "EASY",
    tags: ["intro"],
    questionType: "ROLE",
    objective: "Assess how clearly the candidate can communicate their own technical work to a non-technical audience.",
    expectedSignals: ["clarity_of_communication", "non_technical_framing"],
  },
  // cv_probe
  {
    text: "Pick the project on your CV you're proudest of — what was your specific contribution?",
    competency: "cv_probe",
    difficulty: "MEDIUM",
    tags: ["cv", "projects"],
    questionType: "CV_BASED",
    objective: "Verify the candidate's actual personal contribution and technical depth on a project they chose to highlight themselves.",
    expectedSignals: ["personal_contribution", "technical_depth", "ownership_justification"],
  },
  {
    text: "Was there a project on your CV that didn't go the way you planned? What happened?",
    competency: "cv_probe",
    difficulty: "MEDIUM",
    tags: ["cv", "projects"],
    questionType: "CV_BASED",
    objective: "Assess the candidate's self-awareness and what they actually learned from a project that didn't go as planned.",
    expectedSignals: ["honest_self_assessment", "root_cause_understanding", "lessons_learned"],
  },
  // React
  {
    text: "How do you decide when a piece of UI state belongs in local component state versus a shared store?",
    competency: "React",
    difficulty: "MEDIUM",
    tags: ["react", "state"],
    questionType: "ROLE",
    objective: "Assess practical judgment on React state-placement trade-offs, not just textbook definitions.",
    expectedSignals: ["state_placement_reasoning", "tradeoff_awareness", "concrete_example"],
  },
  {
    text: "Explain what causes an unnecessary re-render in a React tree and how you'd track one down.",
    competency: "React",
    difficulty: "HARD",
    tags: ["react", "performance"],
    questionType: "ROLE",
    objective: "Assess depth of understanding of React's rendering model and a concrete debugging methodology.",
    expectedSignals: ["rerender_cause_understanding", "debugging_methodology", "profiling_tool_familiarity"],
  },
  // JavaScript
  {
    text: "What's the difference between a microtask and a macrotask in the JS event loop, and why does it matter?",
    competency: "JavaScript",
    difficulty: "HARD",
    tags: ["javascript", "async"],
    questionType: "ROLE",
    objective: "Assess depth of understanding of the JavaScript event loop and its practical, not just theoretical, implications.",
    expectedSignals: ["event_loop_mechanics", "practical_implication_awareness"],
  },
  // CSS
  {
    text: "How would you build a responsive layout that has to work from a 320px phone up to a 4K monitor?",
    competency: "CSS",
    difficulty: "MEDIUM",
    tags: ["css", "layout"],
    questionType: "ROLE",
    objective: "Assess practical, hands-on experience building layouts that work across a genuinely wide range of screen sizes.",
    expectedSignals: ["responsive_technique_knowledge", "concrete_example", "tradeoff_awareness"],
  },
  // API Design
  {
    text: "How would you design pagination for an endpoint returning millions of rows?",
    competency: "API Design",
    difficulty: "MEDIUM",
    tags: ["api", "pagination"],
    questionType: "ROLE",
    objective: "Assess practical experience designing pagination that actually holds up at scale, including its trade-offs.",
    expectedSignals: ["pagination_strategy_knowledge", "scale_awareness", "tradeoff_reasoning"],
  },
  {
    text: "When would you choose PATCH over PUT for an update endpoint, and what changes about how a client must call it?",
    competency: "API Design",
    difficulty: "MEDIUM",
    tags: ["api", "rest"],
    questionType: "ROLE",
    objective: "Assess understanding of REST semantics and their concrete, client-facing implications.",
    expectedSignals: ["rest_semantics_understanding", "client_impact_awareness"],
  },
  // Databases
  {
    text: "Walk through how you'd diagnose a query that used to be fast and is now slow in production.",
    competency: "Databases",
    difficulty: "HARD",
    tags: ["database", "performance"],
    questionType: "ROLE",
    objective: "Assess a practical, ordered database-performance diagnostic methodology, not just naming tools.",
    expectedSignals: ["diagnostic_methodology", "tool_familiarity", "root_cause_identification"],
  },
  // System Design
  {
    text: "How would you design a system that has to send three emails at precise, different times relative to a future event?",
    competency: "System Design",
    difficulty: "HARD",
    tags: ["system-design", "scheduling"],
    questionType: "ROLE",
    objective: "Assess system design skill for time-precise, multi-stage scheduled workflows, including reliability under failure.",
    expectedSignals: ["scheduling_approach", "reliability_consideration", "failure_handling"],
  },
  // scenario
  {
    text: "You discover a bug in production that's silently corrupting a small percentage of records. Walk me through what you do first, second, and third.",
    competency: "scenario",
    difficulty: "HARD",
    tags: ["scenario", "incident"],
    questionType: "SCENARIO",
    objective: "Assess incident-response judgment and prioritization when data integrity is at risk.",
    expectedSignals: ["prioritization_reasoning", "containment_approach", "communication_consideration"],
  },
  {
    text: "A teammate's PR would ship faster but cuts a corner you're not comfortable with. What do you do?",
    competency: "scenario",
    difficulty: "MEDIUM",
    tags: ["scenario", "collaboration"],
    questionType: "SCENARIO",
    objective: "Assess how the candidate balances delivery pressure against code-quality concerns, and how they communicate it.",
    expectedSignals: ["quality_tradeoff_reasoning", "communication_approach", "conflict_handling"],
  },
  // behavioral
  {
    text: "Tell me about a time you disagreed with a technical decision and how you handled it.",
    competency: "behavioral",
    difficulty: "MEDIUM",
    tags: ["behavioral", "conflict"],
    questionType: "BEHAVIORAL",
    objective: "Assess how the candidate handles technical disagreement professionally and what they took away from it.",
    expectedSignals: ["conflict_handling", "communication_approach", "outcome_reflection"],
  },
  // candidate_questions
  {
    text: "What questions do you have for us about the role or the team?",
    competency: "candidate_questions",
    difficulty: "EASY",
    tags: ["closing"],
    questionType: "ROLE",
    objective: "Give the candidate a chance to ask questions and gauge their genuine interest in the role.",
    expectedSignals: ["genuine_engagement"],
  },
];

async function main() {
  // Guards against reseeding an already-populated database — `yarn db:seed`
  // is safe to run repeatedly, not just against a fresh database.
  const existingRoleCount = await prisma.role.count();
  if (existingRoleCount > 0) {
    console.log("Database already seeded — skipping.");
    return;
  }

  const recruiterPassword = process.env.SEED_RECRUITER_PASSWORD ?? "password";
  const passwordHash = await bcrypt.hash(recruiterPassword, 10);

  const recruiter = await prisma.user.upsert({
    where: { email: "recruiter@example.com" },
    update: {},
    create: {
      uniqueId: "recruiter01",
      name: "Test Recruiter",
      email: "recruiter@example.com",
      passwordHash,
    },
  });
  console.log("Seeded recruiter user (recruiter@example.com).");

  await prisma.role.create({
    data: {
      name: "Frontend Engineer",
      description: "Builds and maintains the product's React-based UI.",
      blueprint: FRONTEND_BLUEPRINT,
      createdById: recruiter.id,
    },
  });
  await prisma.role.create({
    data: {
      name: "Backend Engineer",
      description: "Designs and operates the product's API and data layer.",
      blueprint: BACKEND_BLUEPRINT,
      createdById: recruiter.id,
    },
  });
  console.log("Seeded 2 roles.");

  await prisma.question.createMany({
    data: QUESTIONS.map((question) => ({
      ...question,
      createdById: recruiter.id,
    })),
  });
  console.log(`Seeded ${QUESTIONS.length} questions.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
