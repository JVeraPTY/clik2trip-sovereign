import type { LocalTour } from '@clik2trip/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import { demoBookingSource, gatewayBookingSource } from './booking-source';
import {
  createDemoHold,
  demoAvailability,
  demoHoldMinutes,
  demoLiveTour,
  demoTimeSlots,
  readDemoHold,
  resetDemoHolds,
} from './demo-booking';

const tour: LocalTour = {
  tourRefId: 'demo-isla-otoque-dia-completo',
  slug: 'isla-otoque-dia-completo',
  title: 'Isla Otoque día completo con almuerzo local',
  summary: 'Travesía por el golfo hasta una isla de pescadores.',
  destinationName: 'Isla Otoque',
  categoryName: 'Islas',
  durationMin: 540,
  includes: ['Transporte marítimo'],
  excludes: ['Propinas'],
  searchTerms: ['island'],
  source: 'demo-seed',
  regionId: 'panama-city',
  geo: { lat: 8.6333, lng: -79.6167 },
  priceFrom: 95,
  currency: 'USD',
  providerName: 'Operador demo Pacífico',
};

const now = Date.parse('2026-09-10T12:00:00.000Z');

beforeEach(() => {
  resetDemoHolds();
});

describe('demo availability', () => {
  it('offers departures matched to how long the activity takes', () => {
    expect(demoTimeSlots(720)).toEqual(['06:00']);
    expect(demoTimeSlots(540)).toEqual(['07:00', '08:30']);
    expect(demoTimeSlots(180)).toEqual(['08:00', '13:00']);
    expect(demoTimeSlots(90)).toHaveLength(4);
  });

  it('returns the same slots for the same tour and window on every run', () => {
    const first = demoAvailability(tour, '2026-09-10', '2026-10-10');
    const second = demoAvailability(tour, '2026-09-10', '2026-10-10');

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it('leaves some days without a departure at all', () => {
    const dates = new Set(demoAvailability(tour, '2026-09-10', '2026-10-10').map((s) => s.date));

    expect(dates.size).toBeLessThan(31);
  });

  it('keeps capacity and occupancy consistent on every slot', () => {
    for (const slot of demoAvailability(tour, '2026-09-10', '2026-10-10')) {
      expect(slot.spotsLeft).toBe(slot.capacity - slot.reserved);
      expect(slot.spotsLeft).toBeGreaterThanOrEqual(0);
      expect(slot.isBlocked).toBe(false);
    }
  });

  it('returns nothing for an inverted or unparseable window', () => {
    expect(demoAvailability(tour, '2026-10-10', '2026-09-10')).toEqual([]);
    expect(demoAvailability(tour, 'not-a-date', '2026-09-10')).toEqual([]);
  });

  it('never runs away on an absurdly wide window', () => {
    const dates = new Set(demoAvailability(tour, '2026-09-10', '2030-01-01').map((s) => s.date));

    expect(dates.size).toBeLessThanOrEqual(31);
  });
});

describe('demo hold', () => {
  const input = {
    tourRefId: tour.tourRefId,
    date: '2026-09-12',
    timeSlot: '06:00',
    participants: 2,
    customer: { email: 'viajero@example.com', fullName: 'Viajero de Prueba' },
  };

  it('freezes a total from the reference price and the party size', () => {
    const hold = createDemoHold(tour, input, now);

    expect(hold.priceSnapshot.total).toBe('190.00');
    expect(hold.priceSnapshot.basePrice).toBe('95.00');
    expect(hold.priceSnapshot.participants).toBe(2);
    expect(hold.status).toBe('NUEVA');
  });

  it('expires on the same fifteen-minute clock as a real hold', () => {
    const hold = createDemoHold(tour, input, now);

    expect(Date.parse(hold.holdExpiresAt!) - now).toBe(demoHoldMinutes * 60_000);
  });

  it('says in its own snapshot that it is not bookable', () => {
    expect(createDemoHold(tour, input, now).policySnapshot).toMatchObject({
      source: 'demo-seed',
      bookable: false,
    });
  });

  it('issues a distinct code for each hold', () => {
    const codes = new Set(
      [0, 1, 2, 3].map((offset) => createDemoHold(tour, input, now + offset).code),
    );

    expect(codes.size).toBe(4);
  });

  it('reads back the same snapshot the traveler was shown', () => {
    const hold = createDemoHold(tour, input, now);
    const reread = readDemoHold(hold.code, now + 1000);

    expect(reread).toMatchObject({
      id: hold.id,
      code: hold.code,
      tourRefId: tour.tourRefId,
      date: '2026-09-12',
      timeSlot: '06:00',
      participants: 2,
      status: 'NUEVA',
    });
    expect(reread?.priceSnapshot).toEqual(hold.priceSnapshot);
  });

  it('reports the hold as expired once its clock runs out', () => {
    const hold = createDemoHold(tour, input, now);

    expect(readDemoHold(hold.code, now + demoHoldMinutes * 60_000)?.status).toBe('EXPIRADA');
  });

  it('does not invent a hold it never issued', () => {
    expect(readDemoHold('DEMO-NOPE', now)).toBeNull();
  });
});

describe('booking sources', () => {
  it('reports whether a real reservation exists behind the hold', () => {
    expect(demoBookingSource(tour).bookable).toBe(false);
    expect(demoBookingSource(tour).kind).toBe('demo');
  });

  it('serves the demo tour with its reference price', async () => {
    const live = await demoBookingSource(tour).getTour();

    expect(live).toMatchObject({ tourRefId: tour.tourRefId, priceFrom: 95, currency: 'USD' });
    expect(demoLiveTour(tour).hasAvailabilityNext30Days).toBe(true);
  });

  it('refuses availability for a tour it does not represent', async () => {
    const slots = await demoBookingSource(tour).getAvailability({
      tourRefId: 'demo-something-else',
      from: '2026-09-10',
      to: '2026-09-20',
    });

    expect(slots).toEqual([]);
  });

  it('re-reads a hold through the store rather than returning the caller its own object', async () => {
    const source = demoBookingSource(tour, () => now);
    const created = await source.createBookingHold({
      tourRefId: tour.tourRefId,
      date: '2026-09-12',
      timeSlot: '06:00',
      participants: 1,
      customer: { email: 'viajero@example.com', fullName: 'Viajero de Prueba' },
    });
    const reread = await source.getBookingHold({ code: created.code });

    expect(reread).not.toBeNull();
    expect(reread).not.toBe(created);
    expect(reread?.priceSnapshot.total).toBe('95.00');
  });

  it('marks the Gateway source as the bookable one', () => {
    const source = gatewayBookingSource({} as never, 'caminata-volcan-arenal');

    expect(source.kind).toBe('clik2trip');
    expect(source.bookable).toBe(true);
  });
});
