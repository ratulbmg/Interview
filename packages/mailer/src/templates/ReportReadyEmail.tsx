import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, emailTheme } from "./shared";
import { ReportReadyEmailData } from "../types";

/** Sent to the recruiter, not the candidate — the recruiter does nothing
 * to trigger this; it's enqueued automatically once apps/interview-engine
 * posts a finished interview's transcript and score report (see
 * apps/api's sessionService.receiveTranscript, Phase 7). */
export function ReportReadyEmail({
  candidateName,
  roleName,
  sessionUrl,
}: ReportReadyEmailData) {
  return (
    <EmailShell
      previewText={`${candidateName}'s ${roleName} interview report is ready`}
      heading="Interview report ready"
    >
      <Text>
        <strong>{candidateName}</strong>&apos;s interview for the{" "}
        <strong>{roleName}</strong> role is complete, and the scored report is
        ready to review.
      </Text>
      <Button
        href={sessionUrl}
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
        View report
      </Button>
    </EmailShell>
  );
}

export function reportReadyEmailSubject(data: ReportReadyEmailData): string {
  return `Interview report ready: ${data.candidateName} — ${data.roleName}`;
}
