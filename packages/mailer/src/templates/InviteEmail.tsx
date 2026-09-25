import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell } from "./shared";
import { BaseEmailData } from "../types";

/** Stage 1 — enqueued immediately on "Send Invite". Just notifies the
 * candidate an interview has been set up; no link yet. */
export function InviteEmail({
  candidateName,
  roleName,
  scheduledAt,
}: BaseEmailData) {
  const when = new Date(scheduledAt).toLocaleString();
  return (
    <EmailShell
      previewText={`Your ${roleName} interview is scheduled`}
      heading="Your interview is scheduled"
    >
      <Text>Hi {candidateName},</Text>
      <Text>
        An interview has been set up for the <strong>{roleName}</strong> role,
        scheduled for <strong>{when}</strong>.
      </Text>
      <Text>
        You'll receive a follow-up email closer to the date, and the join link
        the day before your interview.
      </Text>
    </EmailShell>
  );
}

export function inviteEmailSubject(data: BaseEmailData): string {
  return `Interview scheduled: ${data.roleName}`;
}
