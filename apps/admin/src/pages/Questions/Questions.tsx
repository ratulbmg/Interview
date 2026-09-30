import { FormEvent, useState } from "react";
import { Badge, Button, Input, Label, Modal, Select } from "@repo/ui";
import {
  QuestionType,
  useAddQuestionMutation,
  useListQuestionsQuery,
} from "../../redux/api/questionsApi";

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
const QUESTION_TYPES: QuestionType[] = [
  "ROLE",
  "CV_BASED",
  "GAP",
  "SCENARIO",
  "BEHAVIORAL",
];

/** Comma-separated free text in the form, a string array on the wire —
 * trims each entry and drops empties so "react, , state" and "react,state"
 * both become ["react", "state"]. */
function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const initialFormState = {
  text: "",
  competency: "",
  difficulty: "MEDIUM" as (typeof DIFFICULTIES)[number],
  questionType: "ROLE" as QuestionType,
  tags: "",
  objective: "",
  expectedSignals: "",
  maxFollowups: "2",
  maxDurationSeconds: "180",
};

/** The bank is seeded by default (packages/db/src/seed.ts) and grown by
 * apps/engine's embedding/selection logic at interview time, but a
 * recruiter can add their own questions here too — see apps/api's
 * questionService.createQuestion, scoped to whichever recruiter is
 * logged in. */
export default function Questions() {
  const { data: questions, isLoading } = useListQuestionsQuery();
  const [addQuestion, { isLoading: isSubmitting, error }] =
    useAddQuestionMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialFormState);

  const closeModal = () => {
    setModalOpen(false);
    setForm(initialFormState);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    await addQuestion({
      text: form.text.trim(),
      competency: form.competency.trim(),
      difficulty: form.difficulty,
      questionType: form.questionType,
      tags: parseList(form.tags),
      objective: form.objective.trim() || undefined,
      expectedSignals: parseList(form.expectedSignals),
      maxFollowups: Number(form.maxFollowups) || 0,
      maxDurationSeconds: Number(form.maxDurationSeconds) || 0,
    }).unwrap();

    closeModal();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">
          Question bank
        </h1>
        <Button onClick={() => setModalOpen(true)}>Add question</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 font-medium">Question</th>
                <th className="px-4 py-3 font-medium">Competency</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Difficulty</th>
                <th className="px-4 py-3 font-medium">Times asked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {questions?.map((q) => (
                <tr key={q.id}>
                  <td className="px-4 py-3 text-foreground">{q.text}</td>
                  <td className="px-4 py-3 text-foreground">
                    {q.competency}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{q.questionType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {q.difficulty}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {q.timesAsked}
                  </td>
                </tr>
              ))}
              {questions?.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No questions yet — add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Add question"
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="text">Question text</Label>
            <textarea
              id="text"
              required
              rows={3}
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="competency">Competency</Label>
              <Input
                id="competency"
                required
                placeholder="e.g. React, scenario, opener"
                value={form.competency}
                onChange={(e) =>
                  setForm({ ...form, competency: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                id="difficulty"
                value={form.difficulty}
                onChange={(e) =>
                  setForm({
                    ...form,
                    difficulty: e.target.value as (typeof DIFFICULTIES)[number],
                  })
                }
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="questionType">Question type</Label>
            <Select
              id="questionType"
              value={form.questionType}
              onChange={(e) =>
                setForm({
                  ...form,
                  questionType: e.target.value as QuestionType,
                })
              }
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (comma-separated, optional)</Label>
            <Input
              id="tags"
              placeholder="e.g. react, state"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="objective">
              Objective (optional) — what should this question verify?
            </Label>
            <textarea
              id="objective"
              rows={2}
              placeholder="e.g. Assess practical judgment on React state-placement trade-offs."
              value={form.objective}
              onChange={(e) =>
                setForm({ ...form, objective: e.target.value })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expectedSignals">
              Expected signals (comma-separated, optional) — specific
              evidence an answer should provide
            </Label>
            <Input
              id="expectedSignals"
              placeholder="e.g. state_placement_reasoning, tradeoff_awareness"
              value={form.expectedSignals}
              onChange={(e) =>
                setForm({ ...form, expectedSignals: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to skip adaptive follow-up analysis for this
              question — it'll still be asked, just without live
              signal-coverage tracking.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="maxFollowups">Max follow-ups</Label>
              <Input
                id="maxFollowups"
                type="number"
                min={0}
                value={form.maxFollowups}
                onChange={(e) =>
                  setForm({ ...form, maxFollowups: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxDurationSeconds">
                Max topic duration (seconds)
              </Label>
              <Input
                id="maxDurationSeconds"
                type="number"
                min={1}
                value={form.maxDurationSeconds}
                onChange={(e) =>
                  setForm({ ...form, maxDurationSeconds: e.target.value })
                }
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">
              {"data" in error &&
              typeof error.data === "object" &&
              error.data &&
              "message" in error.data
                ? String((error.data as { message?: string }).message)
                : "Could not add question."}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add question"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
