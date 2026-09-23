import { randomUUID } from "crypto";

export interface MeetingSessionInfo {
  id: number;
  scheduledAt: Date;
}

/**
 * Behind an interface so the v2 swap (Microsoft Teams, via a meeting-bot
 * API like Recall.ai/Vexa — Phase 7) is a new implementation, not a
 * rewrite of sessionService's sendInvite.
 */
export interface MeetingProvider {
  createMeeting(session: MeetingSessionInfo): Promise<{ meetingUrl: string }>;
}

/** v1 — a browser-based interview room hosted by this system. The room
 * itself (the page the candidate lands on, and the bot joining it) is
 * built in Phase 6; this only mints the URL that goes out in the
 * meeting-link email. */
class BrowserRoomMeetingProvider implements MeetingProvider {
  async createMeeting(
    _session: MeetingSessionInfo,
  ): Promise<{ meetingUrl: string }> {
    const roomToken = randomUUID();
    const dashboardUrl =
      process.env.DASHBOARD_PUBLIC_URL ??
      `http://localhost:${process.env.DASHBOARD_PORT ?? 3002}`;
    return { meetingUrl: `${dashboardUrl}/room/${roomToken}` };
  }
}

/** v2 — stubbed until Phase 7 wires up the Teams meeting-bot swap. */
class TeamsMeetingProvider implements MeetingProvider {
  async createMeeting(
    _session: MeetingSessionInfo,
  ): Promise<{ meetingUrl: string }> {
    throw new Error(
      "TeamsMeetingProvider is not implemented yet — see Phase 7.",
    );
  }
}

export const meetingProvider: MeetingProvider =
  new BrowserRoomMeetingProvider();

export { TeamsMeetingProvider };
