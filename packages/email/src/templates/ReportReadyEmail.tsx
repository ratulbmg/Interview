import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell } from "./shared";
import { ReportReadyEmailData } from "../types";

/** Sent to the recruiter, not the candidate — the recruiter does nothing
 * to trigger this; it's enqueued automatically once apps/interview-agent
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
          backgroundColor: "#2563eb",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: "6px",
          textDecoration: "none",
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
