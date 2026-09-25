"""PDF CV -> structured JSON profile, via an LLM.

Text extraction (pypdf) is a mechanical step; everything after that —
pulling out skills, projects, employers, and a seniority read — needs
actual language understanding, so it goes through the LLM rather than
regex/heuristics.
"""

from dataclasses import dataclass, field

from pypdf import PdfReader

from engine import llm_client

SYSTEM_PROMPT = """You extract structured data from a candidate's CV/resume text.
Return a single JSON object with exactly these keys:
- "skills": array of strings, the technical skills/tools mentioned
- "years_experience": number, total years of professional experience (estimate from dates if not stated)
- "projects": array of objects, each {"name": string, "description": string} for notable projects or roles
- "employers": array of strings, company/organization names the candidate has worked for
- "seniority_signal": one of "junior", "mid", "senior" — your best read of their overall seniority
Be concise. If the text doesn't clearly state something, make a reasonable estimate rather than leaving it empty."""


@dataclass
class CandidateProfile:
    skills: list[str] = field(default_factory=list)
    years_experience: float = 0.0
    projects: list[dict] = field(default_factory=list)
    employers: list[str] = field(default_factory=list)
    seniority_signal: str = "mid"
    raw_text: str = ""

    def summary_text(self) -> str:
        """A compact text form used to embed the profile for CV-relevance
        ranking in question_selector.py."""
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

    data = llm_client.chat_json(SYSTEM_PROMPT, raw_text)
    seniority = data.get("seniority_signal", "mid")
    if seniority not in ("junior", "mid", "senior"):
        seniority = "mid"

    return CandidateProfile(
        skills=list(data.get("skills", [])),
        years_experience=float(data.get("years_experience", 0) or 0),
        projects=list(data.get("projects", [])),
        employers=list(data.get("employers", [])),
        seniority_signal=seniority,
        raw_text=raw_text,
    )
