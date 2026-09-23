import { useListQuestionsQuery } from "../../redux/api/questionsApi";

/** Read-only — the bank is seeded and grown by apps/interview-agent, not
 * authored through the dashboard. */
export default function Questions() {
  const { data: questions, isLoading } = useListQuestionsQuery();

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Question bank</h1>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Question</th>
            <th className="py-2">Competency</th>
            <th className="py-2">Difficulty</th>
            <th className="py-2">Times asked</th>
          </tr>
        </thead>
        <tbody>
          {questions?.map((q) => (
            <tr key={q.id} className="border-b border-gray-100">
              <td className="py-2">{q.text}</td>
              <td className="py-2">{q.competency}</td>
              <td className="py-2">{q.difficulty}</td>
              <td className="py-2">{q.timesAsked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
