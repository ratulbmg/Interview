import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PipecatClient, RTVIEvent } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import {
  TbAlertTriangle,
  TbMicrophone,
  TbMicrophoneOff,
  TbPhoneOff,
} from "react-icons/tb";
import { AGENT_PUBLIC_URL } from "../../config/agent";

type ConnectionState = "idle" | "connecting" | "connected" | "ended" | "error";

/**
 * The v1 browser-based interview room a candidate lands on from the
 * meeting-link email (see apps/api's meetingProvider.ts, which mints the
 * `/room/:token` URL). Public route — candidates never log in, so this
 * page lives outside ProtectedRoute (see app/routes.tsx).
 *
 * Connects directly to apps/engine's voice agent (Phase 6), not
 * to this app's own API. Deliberately its own dark theme, distinct from
 * the recruiter admin app's light one — a live-call screen, not a
 * management page — but built with the same care: real layout, icons, and
 * states instead of a bare background with plain text.
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

  const endInterview = async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    if (!window.confirm("End the interview now? You won't be able to resume it afterward.")) {
      return;
    }
    // sendClientMessage is fire-and-forget over the data channel — nothing
    // guarantees it arrives before disconnect() tears the connection down,
    // so give it a moment to actually go out first. Without this, the
    // engine has no way to tell a deliberate end apart from the candidate's
    // connection just dropping (see engine/voice/server.py's
    // on_client_message/on_client_disconnected).
    client.sendClientMessage("end_interview");
    await new Promise((resolve) => setTimeout(resolve, 300));
    await client.disconnect();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-2xl">
        <p className="mb-1 text-xs font-semibold tracking-wide text-neutral-500">
          INTERVIEW PLATFORM
        </p>
        <h1 className="mb-6 text-lg font-semibold text-white">
          Interview Room
        </h1>

        {state === "idle" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-neutral-800">
              <TbMicrophone className="size-7 text-neutral-300" />
            </div>
            <p className="text-sm text-neutral-400">
              Ready to begin? Make sure your mic is working before you join.
            </p>
            <button
              onClick={connect}
              className="w-full rounded-md bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-200"
            >
              Join interview
            </button>
          </div>
        )}

        {state === "connecting" && (
          <div className="flex flex-col items-center gap-4">
            <div className="size-8 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
            <p className="text-sm text-neutral-400">Connecting…</p>
          </div>
        )}

        {state === "connected" && (
          <div className="flex flex-col items-center gap-5">
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1">
              <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">
                Interview in progress
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMic}
                className="flex size-14 items-center justify-center rounded-full border border-neutral-700 text-neutral-200 transition-colors hover:bg-neutral-800"
                aria-label={micEnabled ? "Mute mic" : "Unmute mic"}
              >
                {micEnabled ? (
                  <TbMicrophone className="size-6" />
                ) : (
                  <TbMicrophoneOff className="size-6" />
                )}
              </button>
              <button
                onClick={endInterview}
                className="flex size-14 items-center justify-center rounded-full bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                aria-label="End interview"
              >
                <TbPhoneOff className="size-6" />
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              {micEnabled ? "Mic is on" : "Mic is muted"}
            </p>
          </div>
        )}

        {state === "ended" && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-neutral-800">
              <TbPhoneOff className="size-6 text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-300">
              The interview has ended. You can close this tab.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-red-500/10">
              <TbAlertTriangle className="size-6 text-red-400" />
            </div>
            <p className="text-sm text-red-400">
              Couldn't connect. If your interview time hasn't arrived yet,
              come back a couple of minutes early.
            </p>
          </div>
        )}
      </div>

      <div ref={audioContainerRef} hidden />
    </div>
  );
}
