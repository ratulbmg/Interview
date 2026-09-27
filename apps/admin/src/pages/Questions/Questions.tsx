import { useListQuestionsQuery } from "../../redux/api/questionsApi";

/** Read-only — the bank is seeded and grown by apps/engine, not
 * authored through the admin app. */
export default function Questions() {
  const { data: questions, isLoading } = useListQuestionsQuery();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-foreground">
        Question bank
      </h1>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="px-4 py-3 font-medium">Question</th>
              <th className="px-4 py-3 font-medium">Competency</th>
              <th className="px-4 py-3 font-medium">Difficulty</th>
              <th className="px-4 py-3 font-medium">Times asked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {questions?.map((q) => (
              <tr key={q.id}>
                <td className="px-4 py-3 text-foreground">{q.text}</td>
                <td className="px-4 py-3 text-foreground">{q.competency}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {q.difficulty}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {q.timesAsked}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
