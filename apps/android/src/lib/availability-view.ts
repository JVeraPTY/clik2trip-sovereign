import type { AvailabilitySlot } from '@clik2trip/cliktotrip-client';

const weekdays = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;
const months = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sept',
  'oct',
  'nov',
  'dic',
] as const;

/**
 * Formats the date the way the Clik2Trip site does: `jue, 10 sept`. Built by
 * hand rather than with Intl, because Hermes ships without the full locale data
 * and would quietly fall back to English.
 */
export function formatDateLabel(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  const at = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(at.getTime())) return isoDate;
  const weekday = weekdays[at.getUTCDay()];
  const monthName = months[Number(month) - 1];
  if (!weekday || !monthName) return isoDate;
  return `${weekday}, ${Number(day)} ${monthName}`;
}

/** The distinct dates on offer, in the order the gateway returned them. */
export function availableDates(slots: readonly AvailabilitySlot[]): string[] {
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const slot of slots) {
    if (seen.has(slot.date)) continue;
    seen.add(slot.date);
    dates.push(slot.date);
  }
  return dates;
}

export function slotsForDate(
  slots: readonly AvailabilitySlot[],
  date: string,
): AvailabilitySlot[] {
  return slots.filter((slot) => slot.date === date);
}

export function formatTotal(priceFrom: number, participants: number, currency: string): string {
  const total = priceFrom * participants;
  return `${total.toFixed(2)} ${currency}`;
}
