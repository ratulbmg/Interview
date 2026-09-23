"""Terminal entrypoint for a full text-only interview — no voice yet (that's
Phase 6). Wires cv_parser -> question_selector -> interview_loop -> scorer
together end to end.

Usage:
    python -m agent.cli --cv sample.pdf --role "Frontend Engineer"
"""

import argparse
import json
import sys

from agent import db
from agent.cv_parser import parse_cv
from agent.interview_loop import run_interview
from agent.question_selector import select_questions
from agent.scorer import score_transcript


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a full text-only interview against a candidate's CV.")
    parser.add_argument("--cv", required=True, help="Path to the candidate's CV (PDF).")
    parser.add_argument("--role", required=True, help="Role name, matching a seeded Role.name (e.g. 'Frontend Engineer').")
    args = parser.parse_args()

    print(f"Parsing CV: {args.cv}")
    profile = parse_cv(args.cv)
    print(f"  seniority_signal={profile.seniority_signal}, skills={profile.skills}")

    role = db.get_role_by_name(args.role)
    bank = db.get_questions()
    print(f"Loaded {len(bank)} questions from the bank for role '{role.name}'.")

    selected = select_questions(profile, role, bank)
    print(f"Selected {len(selected)} questions covering the blueprint.\n")
    print("=" * 60)
    print("INTERVIEW START — type your answer and press enter after each question.")
    print("=" * 60)

    transcript = run_interview(selected)
    db.mark_questions_asked([item.question.id for item in selected])

    print("\n" + "=" * 60)
    print("SCORING...")
    print("=" * 60)
    report = score_transcript(transcript, role.name)

    print("\n--- TRANSCRIPT ---")
    print(json.dumps(transcript, indent=2, default=str))
    print("\n--- SCORED REPORT ---")
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError) as error:
        print(f"\nError: {error}", file=sys.stderr)
        sys.exit(1)
