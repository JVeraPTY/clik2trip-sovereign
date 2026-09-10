import { describe, expect, it } from 'vitest';

import {
  buildAvailabilityWindow,
  eligibleAvailability,
  remainingHoldSeconds,
} from './commerce.js';

const slot = {
  date: '2026-09-10',
  timeSlot: '08:00',
  capacity: 5,
  reserved: 0,
  spotsLeft: 5,
  isBlocked: false,
};

describe('connected commerce rules', () => {
  it('builds the bounded 30-day availability window in device-local dates', () => {
    expect(buildAvailabilityWindow(new Date(2026, 8, 9, 12))).toEqual({
      from: '2026-09-09',
      to: '2026-10-09',
    });
  });

  it('excludes blocked or insufficient slots', () => {
    expect(
      eligibleAvailability(
        [slot, { ...slot, timeSlot: '09:00', isBlocked: true }, { ...slot, timeSlot: '10:00', spotsLeft: 1 }],
        2,
      ),
    ).toEqual([slot]);
  });

  it('rounds the visible hold clock up and never returns a negative value', () => {
    const now = Date.parse('2026-09-10T02:00:00.000Z');
    expect(remainingHoldSeconds('2026-09-10T02:15:00.000Z', now)).toBe(900);
    expect(remainingHoldSeconds('2026-09-10T01:59:00.000Z', now)).toBe(0);
  });
});
