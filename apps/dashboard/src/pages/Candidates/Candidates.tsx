import { FormEvent, useRef, useState } from "react";
import {
  useAddCandidateMutation,
  useListCandidatesQuery,
} from "../../redux/api/candidatesApi";

/**
 * Adding a candidate is a short, separate step from scheduling: email
 * (required), name (optional), and the CV file — no age, no role at this
 * stage. Scheduling an interview for a candidate happens on the Sessions
 * page instead.
 */
export default function Candidates() {
  const { data: candidates, isLoading } = useListCandidatesQuery();
  const [addCandidate, { isLoading: isSubmitting, error }] =
    useAddCandidateMutation();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("email", email);
    if (name.trim()) {
      formData.append("name", name.trim());
    }
    formData.append("cv", file);

    await addCandidate(formData).unwrap();
    setEmail("");
    setName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-lg font-semibold">Add a candidate</h1>
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-4"
        >
          <div className="space-y-1">
            <label className="block text-sm text-gray-600" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm text-gray-600" htmlFor="name">
              Name (optional)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm text-gray-600" htmlFor="cv">
              CV (PDF)
            </label>
            <input
              id="cv"
              type="file"
              accept="application/pdf"
              required
              ref={fileInputRef}
              className="text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Adding…" : "Add candidate"}
          </button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-red-600">
            {"data" in error &&
            typeof error.data === "object" &&
            error.data &&
            "message" in error.data
              ? String((error.data as { message?: string }).message)
              : "Could not add candidate."}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Candidates</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Email</th>
                <th className="py-2">Name</th>
                <th className="py-2">CV</th>
                <th className="py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {candidates?.map((candidate) => (
                <tr key={candidate.id} className="border-b border-gray-100">
                  <td className="py-2">{candidate.email}</td>
                  <td className="py-2">{candidate.name ?? "—"}</td>
                  <td className="py-2">
                    <a
                      href={candidate.cvUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  </td>
                  <td className="py-2">
                    {new Date(candidate.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {candidates?.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    No candidates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
