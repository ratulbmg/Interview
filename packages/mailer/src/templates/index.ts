import { render } from "@react-email/render";
import { EmailJob } from "../types";
import { InviteEmail, inviteEmailSubject } from "./InviteEmail";
import { FollowupEmail, followupEmailSubject } from "./FollowupEmail";
import { MeetingLinkEmail, meetingLinkEmailSubject } from "./MeetingLinkEmail";
import { ReportReadyEmail, reportReadyEmailSubject } from "./ReportReadyEmail";

export { InviteEmail, FollowupEmail, MeetingLinkEmail, ReportReadyEmail };

/** Renders a job's template to a subject + HTML body — the one place that
 * switches on EmailJob.type, so adding another template means adding one
 * case here (and to the EmailJob union in types.ts). */
export async function renderEmailJob(
  job: EmailJob,
): Promise<{ subject: string; html: string }> {
  switch (job.type) {
    case "interview-invite":
      return {
        subject: inviteEmailSubject(job.data),
        html: await render(InviteEmail(job.data)),
      };
    case "interview-followup":
      return {
        subject: followupEmailSubject(job.data),
        html: await render(FollowupEmail(job.data)),
      };
    case "interview-meeting-link":
      return {
        subject: meetingLinkEmailSubject(job.data),
        html: await render(MeetingLinkEmail(job.data)),
      };
    case "report-ready":
      return {
        subject: reportReadyEmailSubject(job.data),
        html: await render(ReportReadyEmail(job.data)),
      };
  }
}
