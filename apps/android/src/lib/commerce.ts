import type { AvailabilitySlot } from '@clik2trip/cliktotrip-client';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildAvailabilityWindow(now: Date, days = 30) {
  const to = new Date(now);
  to.setDate(to.getDate() + days);
  return { from: formatDate(now), to: formatDate(to) };
}

export function eligibleAvailability(slots: AvailabilitySlot[], participants: number) {
  return slots.filter(
    (slot) => !slot.isBlocked && Number.isInteger(participants) && participants > 0 && slot.spotsLeft >= participants,
  );
}

export function remainingHoldSeconds(holdExpiresAt: string | null, nowMs: number): number {
  if (!holdExpiresAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(holdExpiresAt) - nowMs) / 1000));
}
