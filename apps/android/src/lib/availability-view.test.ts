import type { AvailabilitySlot } from '@clik2trip/cliktotrip-client';
import { describe, expect, it } from 'vitest';

import {
  availableDates,
  formatDateLabel,
  formatTotal,
  slotsForDate,
} from './availability-view';

function slot(date: string, timeSlot: string, spotsLeft = 5): AvailabilitySlot {
  return { date, timeSlot, capacity: 12, reserved: 12 - spotsLeft, spotsLeft, isBlocked: false };
}

describe('date labels', () => {
  it('reads like the site: weekday, day and short month', () => {
    expect(formatDateLabel('2026-09-10')).toBe('jue, 10 sept');
    expect(formatDateLabel('2026-09-12')).toBe('sáb, 12 sept');
    expect(formatDateLabel('2026-01-01')).toBe('jue, 1 ene');
  });

  it('does not shift the day across timezones', () => {
    // Parsed as UTC on purpose: a local-time parse turns this into the 9th
    // anywhere west of Greenwich.
    expect(formatDateLabel('2026-09-10')).toContain('10');
  });

  it('returns anything it cannot parse untouched', () => {
    expect(formatDateLabel('mañana')).toBe('mañana');
    expect(formatDateLabel('2026-13-45')).toBe('2026-13-45');
  });
});

describe('grouping availability', () => {
  const slots = [
    slot('2026-09-10', '08:00', 5),
    slot('2026-09-10', '13:00', 12),
    slot('2026-09-12', '08:00', 3),
  ];

  it('lists each date once, in the order received', () => {
    expect(availableDates(slots)).toEqual(['2026-09-10', '2026-09-12']);
  });

  it('picks out the times offered on one date', () => {
    expect(slotsForDate(slots, '2026-09-10').map((s) => s.timeSlot)).toEqual(['08:00', '13:00']);
    expect(slotsForDate(slots, '2026-09-11')).toEqual([]);
  });

  it('has nothing to group when there is no availability', () => {
    expect(availableDates([])).toEqual([]);
  });
});

describe('total', () => {
  it('multiplies the per-person price by the travellers', () => {
    expect(formatTotal(95, 1, 'USD')).toBe('95.00 USD');
    expect(formatTotal(95, 2, 'USD')).toBe('190.00 USD');
    expect(formatTotal(75.5, 3, 'USD')).toBe('226.50 USD');
  });
});
