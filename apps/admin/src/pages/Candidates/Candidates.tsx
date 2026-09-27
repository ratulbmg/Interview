import { FormEvent, useRef, useState } from "react";
import { Badge, Button, Card, Input, Label, Modal } from "@repo/ui";
import {
  Candidate,
  useAddCandidateMutation,
  useDeleteCandidateMutation,
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
  const [deleteCandidate] = useDeleteCandidateMutation();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedCvCandidate, setParsedCvCandidate] = useState<Candidate | null>(
    null,
  );

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

  const handleDelete = async (candidate: Candidate) => {
    const label = candidate.name ?? candidate.email;
    const confirmed = window.confirm(
      `Delete ${label}? This also deletes all of their interview sessions.`,
    );
    if (!confirmed) return;
    await deleteCandidate(candidate.id).unwrap();
  };

  const handleViewParsedCv = (candidate: Candidate) => {
    if (!candidate.cvParsedJson) {
      window.alert(
        "This CV hasn't finished parsing yet — check back again in a bit.",
      );
      return;
    }
    setParsedCvCandidate(candidate);
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-lg font-semibold text-foreground">
          Add a candidate
        </h1>
        <Card>
          <form
            onSubmit={handleSubmit}
            className="flex flex-wrap items-end gap-3 p-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cv">CV (PDF)</Label>
              <input
                id="cv"
                type="file"
                accept="application/pdf"
                required
                ref={fileInputRef}
                className="text-sm text-foreground"
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add candidate"}
            </Button>
          </form>
        </Card>
        {error && (
          <p className="mt-2 text-sm text-destructive">
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
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Candidates
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">CV</th>
                  <th className="px-4 py-3 font-medium">Parsed CV</th>
                  <th className="px-4 py-3 font-medium">Added</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates?.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className="px-4 py-3 text-foreground">
                      {candidate.email}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {candidate.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={candidate.cvUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        View
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewParsedCv(candidate)}
                        className="text-primary hover:underline"
                      >
                        View
                      </button>
                      {!candidate.cvParsedJson && (
                        <Badge variant="secondary" className="ml-2">
                          Pending
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(candidate.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(candidate)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
                {candidates?.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      No candidates yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={parsedCvCandidate !== null}
        onClose={() => setParsedCvCandidate(null)}
        title="Parsed CV"
      >
        {parsedCvCandidate?.cvParsedJson && (
          <div className="space-y-4 text-sm">
            <p className="text-foreground">
              <span className="font-medium">
                {parsedCvCandidate.name ?? parsedCvCandidate.email}
              </span>{" "}
              ·{" "}
              <span className="capitalize text-muted-foreground">
                {parsedCvCandidate.cvParsedJson.seniority_signal}
              </span>{" "}
              ·{" "}
              <span className="text-muted-foreground">
                {parsedCvCandidate.cvParsedJson.years_experience} yrs experience
              </span>
            </p>

            <div>
              <h3 className="mb-1.5 font-medium text-foreground">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {parsedCvCandidate.cvParsedJson.skills.map((skill) => (
                  <Badge key={skill} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-1.5 font-medium text-foreground">Employers</h3>
              <p className="text-muted-foreground">
                {parsedCvCandidate.cvParsedJson.employers.join(", ") || "—"}
              </p>
            </div>

            <div>
              <h3 className="mb-1.5 font-medium text-foreground">Projects</h3>
              <ul className="space-y-2">
                {parsedCvCandidate.cvParsedJson.projects.map((project) => (
                  <li key={project.name}>
                    <span className="font-medium text-foreground">
                      {project.name}
                    </span>
                    <p className="text-muted-foreground">
                      {project.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
