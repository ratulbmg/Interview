"""Phase 6: the browser-based voice interview.

consumer.py picks up agent-start jobs from Redis (the same BullMQ
"agent-jobs" queue apps/api's sessionService.sendInvite enqueues to) and
prepares a room; pipeline.py builds the Pipecat STT/LLM/TTS pipeline for a
candidate's browser connection; server.py hosts both behind the same
process, since the ready-room registry (ready_rooms.py) they share only
means anything in-process.
"""
