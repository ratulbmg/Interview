import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PipecatClient, RTVIEvent } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import { AGENT_PUBLIC_URL } from "../../config/agent";

type ConnectionState = "idle" | "connecting" | "connected" | "ended" | "error";

/**
 * The v1 browser-based interview room a candidate lands on from the
 * meeting-link email (see apps/api's meetingProvider.ts, which mints the
 * `/room/:token` URL). Public route — candidates never log in, so this
 * page lives outside ProtectedRoute (see app/routes.tsx).
 *
 * Connects directly to apps/interview-agent's voice server (Phase 6), not
 * to this app's own API.
 */
export default function Room() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ConnectionState>("idle");
  const [micEnabled, setMicEnabled] = useState(true);
  const clientRef = useRef<PipecatClient | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  const connect = async () => {
    if (!token) {
      return;
    }
    setState("connecting");

    const transport = new SmallWebRTCTransport();
    const client = new PipecatClient({
      transport,
      enableMic: true,
      enableCam: false,
      callbacks: {
        onConnected: () => setState("connected"),
        onDisconnected: () => setState("ended"),
        onError: () => setState("error"),
      },
    });

    client.on(RTVIEvent.TrackStarted, (track, participant) => {
      if (participant?.local || track.kind !== "audio") {
        return;
      }
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.srcObject = new MediaStream([track]);
      audioContainerRef.current?.appendChild(audio);
    });

    clientRef.current = client;

    try {
      await client.startBotAndConnect({
        endpoint: `${AGENT_PUBLIC_URL}/start`,
        requestData: { transport: "webrtc", body: { roomToken: token } },
      });
    } catch {
      setState("error");
    }
  };

  const toggleMic = () => {
    if (!clientRef.current) {
      return;
    }
    const next = !micEnabled;
    clientRef.current.enableMic(next);
    setMicEnabled(next);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-900 text-white">
      <h1 className="text-xl font-semibold">Interview Room</h1>

      {state === "idle" && (
        <button
          onClick={connect}
          className="rounded bg-blue-600 px-6 py-3 text-sm font-medium hover:bg-blue-700"
        >
          Join interview
        </button>
      )}

      {state === "connecting" && (
        <p className="text-sm text-gray-300">Connecting…</p>
      )}

      {state === "connected" && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-green-400">
            Connected — the interview is in progress.
          </p>
          <button
            onClick={toggleMic}
            className="rounded border border-gray-500 px-4 py-2 text-sm hover:bg-gray-800"
          >
            {micEnabled ? "Mute mic" : "Unmute mic"}
          </button>
        </div>
      )}

      {state === "ended" && (
        <p className="text-sm text-gray-300">
          The interview has ended. You can close this tab.
        </p>
      )}

      {state === "error" && (
        <p className="text-sm text-red-400">
          Couldn't connect. If your interview time hasn't arrived yet, come back
          a couple of minutes early.
        </p>
      )}

      <div ref={audioContainerRef} hidden />
    </div>
  );
}
