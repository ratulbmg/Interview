import { InterviewSession } from "@repo/db/client";
import { InterviewSessionStatus } from "../enum";
import { apiError } from "../utils/apiError";
import { ScheduleSessionRequest } from "../model/sessionModel";
import { repositoryWrapper } from "../repository/repositoryWrapper";

class SessionService {
  async listSessions(): Promise<InterviewSession[]> {
    return repositoryWrapper.sessionRepository.findAllWithRelations();
  }

  async getSession(id: number): Promise<InterviewSession> {
    const session =
      await repositoryWrapper.sessionRepository.findByIdWithRelations(id);
    if (!session) {
      throw new apiError("Session not found", 404);
    }
    return session;
  }

  /** Scheduling is a second, separate action from adding the candidate —
   * this only creates the session record; nothing is sent to the candidate
   * until sendInvite() below is called. */
  async scheduleSession(
    data: ScheduleSessionRequest,
  ): Promise<InterviewSession> {
    const candidate = await repositoryWrapper.candidateRepository.findById(
      data.candidateId,
    );
    if (!candidate) {
      throw new apiError("Candidate not found", 404);
    }

    const role = await repositoryWrapper.roleRepository.findById(data.roleId);
    if (!role) {
      throw new apiError("Role not found", 404);
    }

    return repositoryWrapper.sessionRepository.create({
      candidate: { connect: { id: candidate.id } },
      role: { connect: { id: role.id } },
      scheduledAt: new Date(data.scheduledAt),
    });
  }

  /**
   * Pressing "Send Invite" is the recruiter's last required action.
   * Scheduling the three candidate emails off `scheduledAt` (Phase 4/5) is
   * a side effect that gets added to this method then — for now it only
   * flips the session's status.
   */
  async sendInvite(id: number): Promise<InterviewSession> {
    const session = await repositoryWrapper.sessionRepository.findById(id);
    if (!session) {
      throw new apiError("Session not found", 404);
    }
    if (session.status !== InterviewSessionStatus.SCHEDULED) {
      throw new apiError("Invite has already been sent for this session", 409);
    }

    return repositoryWrapper.sessionRepository.update(id, {
      status: InterviewSessionStatus.INVITE_SENT,
    });
  }
}

export default SessionService;
