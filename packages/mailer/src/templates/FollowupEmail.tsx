import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell } from "./shared";
import { BaseEmailData } from "../types";

/** Stage 2 — 2 days before scheduledAt (or immediately if under 2 days
 * out). Nudges the candidate to accept; deliberately does NOT contain the
 * join link yet — that's stage 3. */
export function FollowupEmail({
  candidateName,
  roleName,
  scheduledAt,
}: BaseEmailData) {
  const when = new Date(scheduledAt).toLocaleString();
  return (
    <EmailShell
      previewText={`Reminder: your ${roleName} interview is coming up`}
      heading="Your interview is coming up"
    >
      <Text>Hi {candidateName},</Text>
      <Text>
        Just a reminder — your <strong>{roleName}</strong> interview is
        scheduled for <strong>{when}</strong>.
      </Text>
      <Text>
        Your join link will follow in a separate email the day before your
        interview.
      </Text>
    </EmailShell>
  );
}

export function followupEmailSubject(data: BaseEmailData): string {
  return `Reminder: your ${data.roleName} interview is coming up`;
}
