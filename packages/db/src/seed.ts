import { prisma } from "./index";
import bcrypt from "bcryptjs";

/**
 * Seed data for local development: one recruiter account, two roles with
 * real blueprints, and a question bank spanning the slots those blueprints
 * reference.
 *
 * A blueprint is an ordered array of slot objects. `competency` on a slot
 * is the value matched against Question.competency at selection time (see
 * apps/interview-agent's question_selector.py, Phase 2): for "opener",
 * "cv_probe", "scenario", "behavioral" and "candidate_questions" slots it's
 * just the slot name itself; "core_competency" slots name a specific skill
 * instead.
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
}[] = [
  // opener
  {
    text: "Walk me through your background and what brought you to apply for this role.",
    competency: "opener",
    difficulty: "EASY",
    tags: ["intro"],
  },
  {
    text: "In a couple of sentences, how would you describe what you do to someone outside tech?",
    competency: "opener",
    difficulty: "EASY",
    tags: ["intro"],
  },
  // cv_probe
  {
    text: "Pick the project on your CV you're proudest of — what was your specific contribution?",
    competency: "cv_probe",
    difficulty: "MEDIUM",
    tags: ["cv", "projects"],
  },
  {
    text: "Was there a project on your CV that didn't go the way you planned? What happened?",
    competency: "cv_probe",
    difficulty: "MEDIUM",
    tags: ["cv", "projects"],
  },
  // React
  {
    text: "How do you decide when a piece of UI state belongs in local component state versus a shared store?",
    competency: "React",
    difficulty: "MEDIUM",
    tags: ["react", "state"],
  },
  {
    text: "Explain what causes an unnecessary re-render in a React tree and how you'd track one down.",
    competency: "React",
    difficulty: "HARD",
    tags: ["react", "performance"],
  },
  // JavaScript
  {
    text: "What's the difference between a microtask and a macrotask in the JS event loop, and why does it matter?",
    competency: "JavaScript",
    difficulty: "HARD",
    tags: ["javascript", "async"],
  },
  // CSS
  {
    text: "How would you build a responsive layout that has to work from a 320px phone up to a 4K monitor?",
    competency: "CSS",
    difficulty: "MEDIUM",
    tags: ["css", "layout"],
  },
  // API Design
  {
    text: "How would you design pagination for an endpoint returning millions of rows?",
    competency: "API Design",
    difficulty: "MEDIUM",
    tags: ["api", "pagination"],
  },
  {
    text: "When would you choose PATCH over PUT for an update endpoint, and what changes about how a client must call it?",
    competency: "API Design",
    difficulty: "MEDIUM",
    tags: ["api", "rest"],
  },
  // Databases
  {
    text: "Walk through how you'd diagnose a query that used to be fast and is now slow in production.",
    competency: "Databases",
    difficulty: "HARD",
    tags: ["database", "performance"],
  },
  // System Design
  {
    text: "How would you design a system that has to send three emails at precise, different times relative to a future event?",
    competency: "System Design",
    difficulty: "HARD",
    tags: ["system-design", "scheduling"],
  },
  // scenario
  {
    text: "You discover a bug in production that's silently corrupting a small percentage of records. Walk me through what you do first, second, and third.",
    competency: "scenario",
    difficulty: "HARD",
    tags: ["scenario", "incident"],
  },
  {
    text: "A teammate's PR would ship faster but cuts a corner you're not comfortable with. What do you do?",
    competency: "scenario",
    difficulty: "MEDIUM",
    tags: ["scenario", "collaboration"],
  },
  // behavioral
  {
    text: "Tell me about a time you disagreed with a technical decision and how you handled it.",
    competency: "behavioral",
    difficulty: "MEDIUM",
    tags: ["behavioral", "conflict"],
  },
  // candidate_questions
  {
    text: "What questions do you have for us about the role or the team?",
    competency: "candidate_questions",
    difficulty: "EASY",
    tags: ["closing"],
  },
];

async function main() {
  // Guards against reseeding an already-populated database — this runs
  // automatically on every dev container start (see docker-compose.dev.yml),
  // not just on a fresh volume, so it has to be safe to call repeatedly.
  const existingRoleCount = await prisma.role.count();
  if (existingRoleCount > 0) {
    console.log("Database already seeded — skipping.");
    return;
  }

  const recruiterPassword = process.env.SEED_RECRUITER_PASSWORD ?? "password";
  const passwordHash = await bcrypt.hash(recruiterPassword, 10);

  await prisma.user.upsert({
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
    },
  });
  await prisma.role.create({
    data: {
      name: "Backend Engineer",
      description: "Designs and operates the product's API and data layer.",
      blueprint: BACKEND_BLUEPRINT,
    },
  });
  console.log("Seeded 2 roles.");

  await prisma.question.createMany({ data: QUESTIONS });
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
