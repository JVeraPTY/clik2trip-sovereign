import type {
  AvailabilitySlot,
  BookingHold,
  BookingHoldRevalidation,
  CreateBookingHoldInput,
  LiveTour,
} from '@clik2trip/cliktotrip-client';
import type { LocalTour } from '@clik2trip/contracts';

/**
 * The demonstration booking path. It reproduces the shape of a Clik2Trip hold —
 * a code, a frozen price snapshot, an expiry — for catalog entries the Gateway
 * has never heard of, so the settlement path downstream can run unchanged.
 *
 * Nothing here reserves anything. A demo hold lives in this process's memory,
 * disappears when the app closes, and is never sent to Clik2Trip. It exists so
 * a demonstration can be given, and evidence gathered, without inventing
 * inventory on a real booking system.
 */

export const demoHoldMinutes = 15;
const demoCapacity = 12;

/** FNV-1a, so a demo slot's occupancy is stable across runs and devices. */
function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function isoDate(at: Date): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}-${String(
    at.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Departure times, chosen from the length of the day the activity takes. */
export function demoTimeSlots(durationMin: number): string[] {
  if (durationMin >= 600) return ['06:00'];
  if (durationMin >= 360) return ['07:00', '08:30'];
  if (durationMin >= 180) return ['08:00', '13:00'];
  return ['08:00', '11:00', '14:00', '16:30'];
}

/**
 * Availability for a demo entry: deterministic, so the same tour shows the same
 * slots on every run, and sparse enough that some days are genuinely full.
 */
export function demoAvailability(
  tour: LocalTour,
  from: string,
  to: string,
): AvailabilitySlot[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];

  const slots: AvailabilitySlot[] = [];
  const days = Math.min(30, Math.floor((end - start) / 86_400_000));
  for (let offset = 0; offset <= days; offset += 1) {
    const date = isoDate(new Date(start + offset * 86_400_000));
    // One day a week has no departure, so a date chip can genuinely be absent.
    if (hash(`${tour.tourRefId}:${date}`) % 7 === 0) continue;
    for (const timeSlot of demoTimeSlots(tour.durationMin)) {
      const reserved = hash(`${tour.tourRefId}:${date}:${timeSlot}`) % (demoCapacity + 1);
      slots.push({
        date,
        timeSlot,
        capacity: demoCapacity,
        reserved,
        spotsLeft: demoCapacity - reserved,
        isBlocked: false,
      });
    }
  }
  return slots;
}

export function demoLiveTour(tour: LocalTour): LiveTour {
  return {
    tourRefId: tour.tourRefId,
    slug: tour.slug,
    title: tour.title,
    summary: tour.summary,
    destinationName: tour.destinationName,
    categoryName: tour.categoryName,
    durationMin: tour.durationMin,
    priceFrom: tour.priceFrom ?? 0,
    currency: tour.currency ?? 'USD',
    hasAvailabilityNext30Days: true,
  };
}

function money(value: number): string {
  return value.toFixed(2);
}

export interface DemoHoldRecord {
  hold: BookingHold;
  date: string;
  timeSlot: string;
}

/**
 * Holds this process has issued, keyed by code. The settlement step re-reads a
 * hold through this store the same way it re-reads a real one through the
 * Gateway, so the revalidation checks it performs are exercised rather than
 * skipped for demo entries.
 */
const issuedHolds = new Map<string, DemoHoldRecord>();

let holdCounter = 0;

export function demoHoldCode(nowMs: number): string {
  holdCounter += 1;
  const stamp = nowMs.toString(36).toUpperCase().slice(-6);
  return `DEMO-${stamp}${holdCounter.toString(36).toUpperCase()}`;
}

export function createDemoHold(
  tour: LocalTour,
  input: CreateBookingHoldInput,
  nowMs: number,
): BookingHold {
  const unitPrice = tour.priceFrom ?? 0;
  const code = demoHoldCode(nowMs);
  const hold: BookingHold = {
    id: `demo-hold-${code}`,
    code,
    tourRefId: tour.tourRefId,
    participants: input.participants,
    status: 'NUEVA',
    confirmationType: 'INMEDIATA',
    holdExpiresAt: new Date(nowMs + demoHoldMinutes * 60_000).toISOString(),
    priceSnapshot: {
      basePrice: money(unitPrice),
      discount: '0',
      currency: tour.currency ?? 'USD',
      total: money(unitPrice * input.participants),
      participants: input.participants,
    },
    policySnapshot: { source: 'demo-seed', bookable: false },
  };
  issuedHolds.set(code, { hold, date: input.date, timeSlot: input.timeSlot });
  return hold;
}

export function readDemoHold(code: string, nowMs: number): BookingHoldRevalidation | null {
  const record = issuedHolds.get(code);
  if (!record) return null;
  const expired =
    record.hold.holdExpiresAt !== null && Date.parse(record.hold.holdExpiresAt) <= nowMs;
  return {
    id: record.hold.id,
    code: record.hold.code,
    tourRefId: record.hold.tourRefId,
    date: record.date,
    timeSlot: record.timeSlot,
    participants: record.hold.participants,
    status: expired ? 'EXPIRADA' : 'NUEVA',
    confirmationType: record.hold.confirmationType,
    holdExpiresAt: record.hold.holdExpiresAt,
    priceSnapshot: record.hold.priceSnapshot,
  };
}

/** Test seam. Production code never needs to forget a hold. */
export function resetDemoHolds(): void {
  issuedHolds.clear();
  holdCounter = 0;
}
