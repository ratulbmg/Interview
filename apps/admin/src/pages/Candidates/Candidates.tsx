import { FormEvent, ReactNode, useRef, useState } from "react";
import { Badge, Button, Card, Input, Label, Modal } from "@repo/ui";
import {
  Candidate,
  useAddCandidateMutation,
  useDeleteCandidateMutation,
  useListCandidatesQuery,
} from "../../redux/api/candidatesApi";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground">—</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <Badge key={`${item}-${index}`} variant="outline">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <ul className="ml-4 list-disc space-y-0.5 text-muted-foreground">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

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
        className="max-w-2xl"
      >
        {parsedCvCandidate?.cvParsedJson &&
          (() => {
            const profile = parsedCvCandidate.cvParsedJson;
            const seniorityLevel = profile.seniority?.level ?? profile.seniority_signal;
            const yearsExperience = profile.total_experience?.years ?? profile.years_experience;
            const techCategories = profile.technical_skills
              ? Object.entries(profile.technical_skills).filter(
                  ([, items]) => items.length > 0,
                )
              : [];

            return (
              <div className="space-y-5 text-sm">
                <div>
                  <p className="text-foreground">
                    <span className="font-medium">
                      {profile.basic_info?.name ?? parsedCvCandidate.name ?? parsedCvCandidate.email}
                    </span>
                    {profile.basic_info?.title && (
                      <span className="text-muted-foreground"> · {profile.basic_info.title}</span>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="capitalize">{seniorityLevel}</span> ·{" "}
                    {yearsExperience} yrs experience
                    {profile.basic_info?.location && <> · {profile.basic_info.location}</>}
                  </p>
                  {profile.seniority?.evidence && (
                    <p className="mt-1 italic text-muted-foreground">
                      {profile.seniority.evidence}
                    </p>
                  )}
                </div>

                {profile.basic_info?.summary && (
                  <Section title="Summary">
                    <p className="text-muted-foreground">{profile.basic_info.summary}</p>
                  </Section>
                )}

                <Section title="Technical skills">
                  {techCategories.length > 0 ? (
                    <div className="space-y-2">
                      {techCategories.map(([category, items]) => (
                        <div key={category}>
                          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                            {category.replace(/_/g, " ")}
                          </p>
                          <TagList items={items} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <TagList items={profile.skills} />
                  )}
                </Section>

                <Section title="Employers">
                  <p className="text-muted-foreground">{profile.employers.join(", ") || "—"}</p>
                </Section>

                {profile.work_experience && profile.work_experience.length > 0 && (
                  <Section title="Work experience">
                    <ul className="space-y-3">
                      {profile.work_experience.map((entry, index) => (
                        <li key={index}>
                          <p className="text-foreground">
                            <span className="font-medium">{entry.company ?? "Unknown company"}</span>
                            {entry.title && <span className="text-muted-foreground"> — {entry.title}</span>}
                          </p>
                          {(entry.start_date || entry.end_date || entry.duration) && (
                            <p className="text-xs text-muted-foreground">
                              {[entry.start_date, entry.end_date].filter(Boolean).join(" – ")}
                              {entry.duration && ` (${entry.duration})`}
                            </p>
                          )}
                          <BulletList items={entry.achievements} />
                          <BulletList items={entry.measurable_results} />
                          {entry.technologies.length > 0 && (
                            <div className="mt-1">
                              <TagList items={entry.technologies} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                <Section title="Projects">
                  <ul className="space-y-3">
                    {profile.projects.map((project, index) => (
                      <li key={index}>
                        <p className="font-medium text-foreground">{project.name}</p>
                        {project.role && (
                          <p className="text-xs text-muted-foreground">{project.role}</p>
                        )}
                        <p className="text-muted-foreground">{project.description}</p>
                        <BulletList items={project.outcomes} />
                        {project.technologies.length > 0 && (
                          <div className="mt-1">
                            <TagList items={project.technologies} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </Section>

                {profile.education && profile.education.length > 0 && (
                  <Section title="Education">
                    <ul className="space-y-1.5">
                      {profile.education.map((entry, index) => (
                        <li key={index} className="text-muted-foreground">
                          <span className="text-foreground">{entry.institution}</span>
                          {entry.degree && <> — {entry.degree}</>}
                          {entry.field_of_study && <>, {entry.field_of_study}</>}
                          {(entry.start_date || entry.end_date) && (
                            <span className="text-xs">
                              {" "}
                              ({[entry.start_date, entry.end_date].filter(Boolean).join(" – ")})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {profile.certifications && profile.certifications.length > 0 && (
                  <Section title="Certifications">
                    <ul className="space-y-1 text-muted-foreground">
                      {profile.certifications.map((cert, index) => (
                        <li key={index}>
                          {cert.name}
                          {cert.issuer && ` — ${cert.issuer}`}
                          {cert.date && ` (${cert.date})`}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {profile.achievements && profile.achievements.length > 0 && (
                  <Section title="Achievements">
                    <ul className="space-y-1.5">
                      {profile.achievements.map((achievement, index) => (
                        <li key={index} className="text-muted-foreground">
                          {achievement.description}
                          {achievement.metric && (
                            <span className="text-foreground"> ({achievement.metric})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {profile.candidate_claims && profile.candidate_claims.length > 0 && (
                  <Section title="Claims worth probing">
                    <ul className="space-y-2">
                      {profile.candidate_claims.map((claim, index) => (
                        <li key={index}>
                          <p className="text-muted-foreground">{claim.claim}</p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {claim.importance && (
                              <Badge variant="secondary">importance: {claim.importance}</Badge>
                            )}
                            {claim.confidence && (
                              <Badge variant="secondary">confidence: {claim.confidence}</Badge>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {profile.ambiguous_information && profile.ambiguous_information.length > 0 && (
                  <Section title="Unclear — worth asking about">
                    <ul className="space-y-1.5">
                      {profile.ambiguous_information.map((item, index) => (
                        <li key={index} className="text-muted-foreground">
                          {item.statement}
                          {item.ambiguity_type && (
                            <span className="italic"> ({item.ambiguity_type})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {profile.career_progression?.summary && (
                  <Section title="Career progression">
                    <p className="text-muted-foreground">{profile.career_progression.summary}</p>
                  </Section>
                )}
              </div>
            );
          })()}
      </Modal>
    </div>
  );
}
