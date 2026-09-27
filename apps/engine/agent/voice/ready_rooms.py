"""Tiny per-process registry answering one question: "is this WebRTC
connection still the most recent one for this room token?"

Used only to tell a genuine end apart from a stale disconnect handler firing
after a newer connection has already taken over the same room (a candidate's
browser reconnecting after a network blip opens a *new* connection before the
old one's on_client_disconnected has necessarily run yet — see
agent/conversation/manager.py's on_client_disconnected). Nothing else lives
here anymore: apps/api is now the source of truth for all session/business
state (candidate, role, questions, transcript, timing) and hands it over
fresh on every /agent/rooms/join call, so there's no more in-memory
ReadySession cache to keep in sync with Postgres.
"""

from threading import Lock

_counters: dict[str, int] = {}
_lock = Lock()


def bump(room_token: str) -> int:
    """Call once per new connection for a room token. Returns this
    connection's id (the new counter value) — hang onto it and compare
    against is_current(...) later, in that connection's own disconnect
    handler."""
    with _lock:
        next_id = _counters.get(room_token, 0) + 1
        _counters[room_token] = next_id
        return next_id


def is_current(room_token: str, connection_id: int) -> bool:
    """True if no newer connection has called bump() for this room token
    since `connection_id` was handed out."""
    with _lock:
        return _counters.get(room_token) == connection_id
