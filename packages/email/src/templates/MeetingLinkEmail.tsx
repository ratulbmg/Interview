import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell } from "./shared";
import { MeetingLinkEmailData } from "../types";

/** Stage 3 — 1 day before scheduledAt. Carries the actual join link: a
 * browser-based room URL in v1 (see the API's meetingProvider interface,
 * Phase 5), a Teams invite in v2 (Phase 7). */
export function MeetingLinkEmail({
  candidateName,
  roleName,
  scheduledAt,
  meetingUrl,
}: MeetingLinkEmailData) {
  const when = new Date(scheduledAt).toLocaleString();
  return (
    <EmailShell
      previewText={`Your interview link for ${roleName}`}
      heading="Your interview link is ready"
    >
      <Text>Hi {candidateName},</Text>
      <Text>
        Your <strong>{roleName}</strong> interview is tomorrow,{" "}
        <strong>{when}</strong>. Join using the link below at the scheduled
        time.
      </Text>
      <Button
        href={meetingUrl}
        style={{
          backgroundColor: "#2563eb",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: "6px",
          textDecoration: "none",
        }}
      >
        Join interview
      </Button>
    </EmailShell>
  );
}

export function meetingLinkEmailSubject(data: MeetingLinkEmailData): string {
  return `Your interview link: ${data.roleName}`;
}
