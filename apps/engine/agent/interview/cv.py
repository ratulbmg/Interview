"""PDF CV -> structured JSON profile, via an LLM.

Text extraction (pypdf) is a mechanical step; everything after that —
pulling out skills, work history, projects, claims, and a seniority read —
needs actual language understanding, so it goes through the LLM rather
than regex/heuristics.

The LLM's raw JSON is validated against ParsedCV (a Pydantic schema)
before anything touches CandidateProfile — malformed output fails loudly
here rather than surfacing as a confusing AttributeError/KeyError
somewhere downstream. CandidateProfile itself keeps its original five
fields (skills, years_experience, projects, employers, seniority_signal)
exactly as before — agent/interview/questions.py's summary_text() and CV-
relevance embedding, and agent/jobs/consumer.py's
CandidateProfile(**candidate.cv_parsed_json) reconstruction, both depend
on that shape unchanged. Every richer field below is additive, stored as
plain dicts/lists (not nested dataclasses) for the same reason `projects`
already was: this whole object round-trips through JSON (Postgres's
cvParsedJson column, then apps/api's HTTP layer) on every read, so a
faithfully-typed nested object would just get flattened back to a dict
the moment it's saved anyway.
"""

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field, ValidationError
from pypdf import PdfReader

from agent.llm import client as llm_client

SeniorityLevel = Literal["junior", "mid", "senior"]
ConfidenceLevel = Literal["low", "medium", "high"]


# --- LLM output schema -------------------------------------------------
# Mirrors the extraction sections below one-for-one; field names are the
# exact JSON keys the system prompt asks the LLM to use. Every field has a
# default (None / empty list) so a section the CV genuinely doesn't cover
# validates as "explicitly absent" rather than failing the whole parse —
# per the prompt's own "use null/empty values rather than making
# assumptions" rule.


class BasicInfo(BaseModel):
    name: str | None = None
    title: str | None = None
    location: str | None = None
    email: str | None = None
    phone: str | None = None
    summary: str | None = None


class TotalExperience(BaseModel):
    years: float | None = None
    confidence: ConfidenceLevel | None = None
    evidence: str | None = None


class WorkExperienceEntry(BaseModel):
    company: str | None = None
    title: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    duration: str | None = None
    responsibilities: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    frameworks_tools: list[str] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)
    measurable_results: list[str] = Field(default_factory=list)
    leadership_responsibilities: list[str] = Field(default_factory=list)
    ownership_level: str | None = None
    technical_decisions: list[str] = Field(default_factory=list)


class TechnicalSkills(BaseModel):
    programming_languages: list[str] = Field(default_factory=list)
    frameworks: list[str] = Field(default_factory=list)
    libraries: list[str] = Field(default_factory=list)
    databases: list[str] = Field(default_factory=list)
    cloud_platforms: list[str] = Field(default_factory=list)
    devops_infrastructure: list[str] = Field(default_factory=list)
    testing: list[str] = Field(default_factory=list)
    architecture_design: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    other: list[str] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    """Kept as the `projects` field's item shape (not a separate list) —
    "name"/"description" stay present so CandidateProfile.summary_text()
    keeps working unmodified, with the richer fields alongside them."""

    name: str | None = None
    description: str | None = None
    role: str | None = None
    responsibilities: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    architecture: str | None = None
    scale: str | None = None
    measurable_results: list[str] = Field(default_factory=list)
    challenges: list[str] = Field(default_factory=list)
    outcomes: list[str] = Field(default_factory=list)
    ownership_level: str | None = None


class EducationEntry(BaseModel):
    institution: str | None = None
    degree: str | None = None
    field_of_study: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    relevant_coursework: list[str] = Field(default_factory=list)


class CertificationEntry(BaseModel):
    name: str | None = None
    issuer: str | None = None
    date: str | None = None


class Achievement(BaseModel):
    """A quantified or otherwise notable outcome, separated from routine
    responsibilities — see the system prompt's explicit list of what
    counts (performance, cost, revenue, scale, latency, team size, ...)."""

    description: str
    category: str | None = None
    metric: str | None = None
    evidence: str | None = None


class CandidateClaim(BaseModel):
    """Something the candidate asserted that's worth an interviewer
    probing — the whole point of this richer schema: not just "what can
    this candidate do" but "what did they say, and how well-evidenced is
    it"."""

    claim: str
    category: str | None = None
    related_skills: list[str] = Field(default_factory=list)
    importance: ConfidenceLevel | None = None
    confidence: ConfidenceLevel | None = None
    evidence: str | None = None


class AmbiguousInformation(BaseModel):
    """A statement the CV leaves unclear — never resolved by guessing (see
    the prompt's extraction rules), just surfaced as-is so an interviewer
    knows what to ask about."""

    statement: str
    ambiguity_type: str | None = None
    context: str | None = None


class CareerProgression(BaseModel):
    summary: str | None = None
    signals: list[str] = Field(default_factory=list)
    promotions: list[str] = Field(default_factory=list)


class SeniorityAssessment(BaseModel):
    level: SeniorityLevel = "mid"
    confidence: ConfidenceLevel | None = None
    evidence: str | None = None


class ParsedCV(BaseModel):
    basic_info: BasicInfo = Field(default_factory=BasicInfo)
    total_experience: TotalExperience = Field(default_factory=TotalExperience)
    work_experience: list[WorkExperienceEntry] = Field(default_factory=list)
    technical_skills: TechnicalSkills = Field(default_factory=TechnicalSkills)
    skills: list[str] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    employers: list[str] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    certifications: list[CertificationEntry] = Field(default_factory=list)
    achievements: list[Achievement] = Field(default_factory=list)
    candidate_claims: list[CandidateClaim] = Field(default_factory=list)
    ambiguous_information: list[AmbiguousInformation] = Field(default_factory=list)
    career_progression: CareerProgression = Field(default_factory=CareerProgression)
    seniority: SeniorityAssessment = Field(default_factory=SeniorityAssessment)


SYSTEM_PROMPT = """You extract structured data from a candidate's CV/resume text, for a system \
that will later use it to prepare for and conduct a spoken job interview. The goal isn't just \
"what skills does this candidate have" but "what has this candidate actually claimed to have \
done, what evidence supports it, and what's left unclear enough to be worth asking about."

Return a single JSON object with exactly these top-level keys:

- "basic_info": object with "name", "title", "location", "email", "phone", "summary" (each a \
string or null).
- "total_experience": object with "years" (number or null, estimated from dates if not stated \
outright), "confidence" ("low"/"medium"/"high"), and "evidence" (a short explanation of how you \
arrived at the estimate).
- "work_experience": array of objects, one per company/organization, each with "company", \
"title", "start_date", "end_date", "duration", "responsibilities" (array of strings), \
"technologies" (array), "frameworks_tools" (array), "achievements" (array), \
"measurable_results" (array), "leadership_responsibilities" (array), "ownership_level" \
(string or null), "technical_decisions" (array).
- "technical_skills": object categorizing every technical skill mentioned into \
"programming_languages", "frameworks", "libraries", "databases", "cloud_platforms", \
"devops_infrastructure", "testing", "architecture_design", "tools", "other" — each an array of \
strings. Normalize obvious variants (e.g. "ReactJS" -> "React") but don't invent skills that \
aren't mentioned.
- "skills": a flat array of strings — every technical skill/tool mentioned, deduplicated, for \
backward compatibility with existing code. This should be consistent with technical_skills above.
- "projects": array of objects, one per meaningful project, each with "name", "description", \
"role" (the candidate's role on it), "responsibilities" (array), "technologies" (array), \
"architecture" (string or null), "scale" (string or null), "measurable_results" (array), \
"challenges" (array), "outcomes" (array), "ownership_level" (string or null).
- "employers": flat array of strings — company/organization names the candidate has worked for, \
deduplicated (should match the companies in work_experience).
- "education": array of objects, each with "institution", "degree", "field_of_study", \
"start_date", "end_date", "relevant_coursework" (array, only if explicitly listed).
- "certifications": array of objects, each with "name", "issuer", "date".
- "achievements": array of objects, each with "description", "category" (e.g. "performance", \
"cost", "revenue", "scale", "latency", "team_size", "award"), "metric" (the quantified figure if \
any, as stated), "evidence" (the supporting sentence/phrase from the CV). Only include something \
here if the CV states an actual outcome or measurable result — don't promote an ordinary \
responsibility to an achievement just because it sounds impressive.
- "candidate_claims": array of objects for statements worth an interviewer probing further, each \
with "claim" (the assertion itself), "category", "related_skills" (array), "importance" \
("low"/"medium"/"high"), "confidence" ("low"/"medium"/"high" — how well-evidenced the claim is), \
"evidence" (the supporting text).
- "ambiguous_information": array of objects for statements where it's unclear what the candidate \
personally did, how much ownership they had, what technology was actually used, the scale of the \
work, whether it was individual or team-based, or their exact contribution — each with \
"statement", "ambiguity_type" (which of those it is), "context". Do not resolve these by \
guessing; that's the whole point of this list.
- "career_progression": object with "summary" (a short narrative), "signals" (array of strings — \
e.g. increasing scope, title changes), "promotions" (array of strings).
- "seniority": object with "level" ("junior"/"mid"/"senior"), "confidence" \
("low"/"medium"/"high"), "evidence" (a short explanation).

Extraction rules:
- Extract facts from the CV; never invent information. If something isn't present, use null or \
an empty array rather than guessing.
- Don't treat missing information as evidence the candidate lacks that skill or experience.
- Preserve the CV's original wording in "evidence"/description fields where it matters as proof.
- Deduplicate skills, companies, projects, and achievements — don't list the same thing twice \
under slightly different names.
- Normalize obvious skill-name variants (e.g. "Node" / "Node.js" / "NodeJS" -> one canonical \
form) while keeping the original phrasing available in the relevant evidence field.
- Don't invent metrics, dates, technologies, responsibilities, or project details that aren't in \
the text.
- If a date is incomplete or ambiguous, preserve that uncertainty (e.g. "2021" or "early 2022") \
rather than fabricating a precise one.

Return only the JSON object, no other text."""


@dataclass
class CandidateProfile:
    # Original fields — shape and defaults unchanged. agent/interview/
    # questions.py's summary_text()/CV-embedding and agent/jobs/
    # consumer.py's CandidateProfile(**cv_parsed_json) reconstruction both
    # depend on these staying exactly as they were.
    skills: list[str] = field(default_factory=list)
    years_experience: float = 0.0
    projects: list[dict] = field(default_factory=list)
    employers: list[str] = field(default_factory=list)
    seniority_signal: str = "mid"
    raw_text: str = ""

    # Richer fields, additive only — plain dicts/lists (mirroring how
    # `projects` above was already stored), since this whole object is
    # JSON the moment it's saved to Session/Candidate.cvParsedJson anyway.
    basic_info: dict = field(default_factory=dict)
    total_experience: dict = field(default_factory=dict)
    work_experience: list[dict] = field(default_factory=list)
    technical_skills: dict = field(default_factory=dict)
    education: list[dict] = field(default_factory=list)
    certifications: list[dict] = field(default_factory=list)
    achievements: list[dict] = field(default_factory=list)
    candidate_claims: list[dict] = field(default_factory=list)
    ambiguous_information: list[dict] = field(default_factory=list)
    career_progression: dict = field(default_factory=dict)
    seniority: dict = field(default_factory=dict)

    def summary_text(self) -> str:
        """A compact text form used to embed the profile for CV-relevance
        ranking in agent/interview/questions.py. Deliberately unchanged —
        still built only from the original fields, not the richer ones
        added above, so question-selection behavior doesn't shift here."""
        parts = [
            f"Skills: {', '.join(self.skills)}",
            f"Years of experience: {self.years_experience}",
            f"Employers: {', '.join(self.employers)}",
            "Projects: " + "; ".join(p.get("description", p.get("name", "")) for p in self.projects),
        ]
        return "\n".join(parts)


def extract_pdf_text(pdf_path: str) -> str:
    reader = PdfReader(pdf_path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def parse_cv(pdf_path: str) -> CandidateProfile:
    raw_text = extract_pdf_text(pdf_path)
    if not raw_text.strip():
        raise ValueError(f"Could not extract any text from {pdf_path} — is it a valid, text-based PDF?")

    raw_data = llm_client.chat_json(SYSTEM_PROMPT, raw_text)
    try:
        parsed = ParsedCV.model_validate(raw_data)
    except ValidationError as error:
        raise ValueError(f"CV parse for {pdf_path} didn't match the expected schema: {error}") from error

    return CandidateProfile(
        skills=parsed.skills,
        years_experience=parsed.total_experience.years or 0.0,
        projects=[p.model_dump() for p in parsed.projects],
        employers=parsed.employers,
        seniority_signal=parsed.seniority.level,
        raw_text=raw_text,
        basic_info=parsed.basic_info.model_dump(),
        total_experience=parsed.total_experience.model_dump(),
        work_experience=[w.model_dump() for w in parsed.work_experience],
        technical_skills=parsed.technical_skills.model_dump(),
        education=[e.model_dump() for e in parsed.education],
        certifications=[c.model_dump() for c in parsed.certifications],
        achievements=[a.model_dump() for a in parsed.achievements],
        candidate_claims=[c.model_dump() for c in parsed.candidate_claims],
        ambiguous_information=[a.model_dump() for a in parsed.ambiguous_information],
        career_progression=parsed.career_progression.model_dump(),
        seniority=parsed.seniority.model_dump(),
    )
