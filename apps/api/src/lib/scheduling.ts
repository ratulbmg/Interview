/** Milliseconds from now until `scheduledAt` minus `offsetMs` — clamped to
 * 0 (BullMQ delays can't be negative, and the domain rule for the
 * follow-up email is explicitly "send immediately if under 2 days out";
 * the same clamp is the only sane behavior for the meeting-link and
 * engine-start jobs too). */
export function delayUntil(scheduledAt: Date, offsetMs: number): number {
  const target = scheduledAt.getTime() - offsetMs;
  return Math.max(0, target - Date.now());
}

export const MINUTES = 60 * 1000;
export const DAYS = 24 * 60 * MINUTES;
