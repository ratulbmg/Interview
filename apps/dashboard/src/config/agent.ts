/** apps/interview-agent's own publicly reachable base URL — where the
 * voice server (agent/voice/server.py) listens for the candidate's
 * browser WebRTC connection. Not the API's URL: this is a separate
 * process. */
export const AGENT_PUBLIC_URL: string =
  import.meta.env.VITE_AGENT_PUBLIC_URL ?? "http://localhost:7860";
