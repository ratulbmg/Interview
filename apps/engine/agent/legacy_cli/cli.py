"""Terminal entrypoint for a full text-only interview — no voice yet (that's
Phase 6). Wires cv_parser -> question_selector -> interview_loop -> scorer
together end to end.

Usage:
    python -m agent.legacy_cli.cli --cv sample.pdf --role "Frontend Engineer"
"""

import argparse
import json
import sys

from agent.interview import agent_data_client
from agent.interview.cv import parse_cv
from agent.interview.questions import select_questions
from agent.legacy_cli.interview_loop import run_interview
from agent.legacy_cli.scorer import score_transcript


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a full text-only interview against a candidate's CV.")
    parser.add_argument("--cv", required=True, help="Path to the candidate's CV (PDF).")
    parser.add_argument("--role", required=True, help="Role name, matching a seeded Role.name (e.g. 'Frontend Engineer').")
    parser.add_argument(
        "--recruiter-email",
        default="recruiter@example.com",
        help="Whose question bank to draw from — each recruiter has their own (default: the seeded recruiter).",
    )
    args = parser.parse_args()

    print(f"Parsing CV: {args.cv}")
    profile = parse_cv(args.cv)
    print(f"  seniority_signal={profile.seniority_signal}, skills={profile.skills}")

    created_by_id = agent_data_client.get_user_id_by_email(args.recruiter_email)
    role = agent_data_client.get_role_by_name(args.role, created_by_id)
    bank = agent_data_client.get_questions(created_by_id)
    print(f"Loaded {len(bank)} questions from the bank for role '{role.name}'.")

    selected = select_questions(profile, role, bank)
    print(f"Selected {len(selected)} questions covering the blueprint.\n")
    print("=" * 60)
    print("INTERVIEW START — type your answer and press enter after each question.")
    print("=" * 60)

    transcript = run_interview(selected)
    agent_data_client.mark_questions_asked([item.question.id for item in selected])

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
