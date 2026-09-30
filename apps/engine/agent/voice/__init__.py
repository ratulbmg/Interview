"""The browser-based voice interview's WebRTC-serving process.

server.py hosts the pipecat signaling server and the "agent-jobs" BullMQ
consumer (agent/jobs/consumer.py) in one process; ready_rooms.py is the
one piece of in-process state they still share — a live-connection counter
per room token, used to tell a genuine disconnect apart from a stale
handler firing after a reconnect already took over. Everything else that
used to live in this package (the pipeline builder, the interview runner,
CV/question/scoring domain logic) has moved out to
agent/conversation/, agent/interview/, agent/scoring/, and agent/jobs/ —
see server.py's own module docstring for how they fit together.
"""
