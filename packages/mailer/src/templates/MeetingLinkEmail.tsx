import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, emailTheme } from "./shared";
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
        className="email-button"
        style={{
          backgroundColor: emailTheme.primary,
          color: emailTheme.primaryForeground,
          fontSize: "14px",
          fontWeight: 500,
          padding: "12px 20px",
          borderRadius: "8px",
          textDecoration: "none",
          marginTop: "8px",
        }}
      >
        Join interview
      </Button>
      <Text
        className="email-muted-text"
        style={{ color: emailTheme.mutedForeground, fontSize: "13px" }}
      >
        This link is only active for 30 minutes after your scheduled start
        time — please join promptly.
      </Text>
    </EmailShell>
  );
}

export function meetingLinkEmailSubject(data: MeetingLinkEmailData): string {
  return `Your interview link: ${data.roleName}`;
}
