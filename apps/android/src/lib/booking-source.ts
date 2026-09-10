import type {
  AvailabilitySlot,
  BookingHold,
  BookingHoldRevalidation,
  Clik2TripGraphQlClient,
  CreateBookingHoldInput,
  LiveTour,
} from '@clik2trip/cliktotrip-client';
import type { LocalTour } from '@clik2trip/contracts';

import { createDemoHold, demoAvailability, demoLiveTour, readDemoHold } from './demo-booking';

export interface AvailabilityRange {
  tourRefId: string;
  from: string;
  to: string;
}

/**
 * Where a booking comes from. Both implementations answer the same four
 * questions, so the detail screen and the settlement step never branch on which
 * one they hold — only on `bookable`, and only to say so on screen.
 */
export interface BookingSource {
  readonly kind: 'clik2trip' | 'demo';
  /**
   * Whether a real reservation exists behind this hold. False for the
   * demonstration path, which must never be presented as a booking.
   */
  readonly bookable: boolean;
  getTour(): Promise<LiveTour | null>;
  getAvailability(input: AvailabilityRange): Promise<AvailabilitySlot[]>;
  createBookingHold(input: CreateBookingHoldInput): Promise<BookingHold>;
  getBookingHold(input: { code: string }): Promise<BookingHoldRevalidation | null>;
}

export function gatewayBookingSource(
  client: Clik2TripGraphQlClient,
  slug: string,
): BookingSource {
  return {
    kind: 'clik2trip',
    bookable: true,
    getTour: () => client.getTour({ slug, locale: 'es' }),
    getAvailability: (input) => client.getAvailability(input),
    createBookingHold: (input) => client.createBookingHold(input),
    getBookingHold: (input) => client.getBookingHold(input),
  };
}

/**
 * The demonstration source. Every method is async and every read goes back
 * through the store rather than returning the caller's own object, so the
 * revalidation the settlement step performs is a real re-read, not a tautology.
 */
export function demoBookingSource(
  tour: LocalTour,
  now: () => number = Date.now,
): BookingSource {
  return {
    kind: 'demo',
    bookable: false,
    getTour: () => Promise.resolve(demoLiveTour(tour)),
    getAvailability: (input) =>
      Promise.resolve(
        input.tourRefId === tour.tourRefId ? demoAvailability(tour, input.from, input.to) : [],
      ),
    createBookingHold: (input) => Promise.resolve(createDemoHold(tour, input, now())),
    getBookingHold: (input) => Promise.resolve(readDemoHold(input.code, now())),
  };
}
