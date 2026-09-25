/** apps/interview-engine's own publicly reachable base URL — where the
 * voice server (engine/voice/server.py) listens for the candidate's
 * browser WebRTC connection. Not the API's URL: this is a separate
 * process. */
export const ENGINE_PUBLIC_URL: string =
  import.meta.env.VITE_ENGINE_PUBLIC_URL ?? "http://localhost:7860";
