"""In-memory registry of rooms the voice server is ready to accept a
connection for — populated by consumer.py when an agent-start job fires
(scheduledAt minus 2 minutes, see apps/api/src/lib/agentQueue.ts), read by
server.py's `bot()` when the candidate's browser actually connects.

In-memory, not Postgres, on purpose: this is transient "is anyone allowed
to join right now" state for the one process serving WebRTC connections,
not durable interview data.
"""

from dataclasses import dataclass, field
from threading import Lock

from agent.question_selector import SelectedQuestion


@dataclass
class ReadySession:
    session_id: int
    candidate_id: int
    role_id: int
    role_name: str
    candidate_name: str
    selected_questions: list[SelectedQuestion] = field(default_factory=list)


_rooms: dict[str, ReadySession] = {}
_lock = Lock()


def _room_token(meeting_url: str) -> str:
    """The room the candidate is expected to connect to is
    `{DASHBOARD_PUBLIC_URL}/room/{token}` (see apps/api's
    meetingProvider.ts) — the token is the last path segment."""
    return meeting_url.rstrip("/").rsplit("/", 1)[-1]


def mark_ready(meeting_url: str, session: ReadySession) -> None:
    with _lock:
        _rooms[_room_token(meeting_url)] = session


def get_ready_session(room_token: str) -> ReadySession | None:
    with _lock:
        return _rooms.get(room_token)


def clear(room_token: str) -> None:
    with _lock:
        _rooms.pop(room_token, None)
