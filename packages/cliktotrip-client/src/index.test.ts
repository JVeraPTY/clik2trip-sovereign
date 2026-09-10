import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Clik2TripGraphQlClient } from './index.js';

describe('Clik2TripGraphQlClient', () => {
  it('refuses a non HTTPS Gateway', () => {
    expect(() => new Clik2TripGraphQlClient({ endpoint: 'http://example.test/graphql' })).toThrow(
      'CLIK2TRIP_GATEWAY_HTTPS_REQUIRED',
    );
  });

  it('sends a session token only to the configured Gateway', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new Clik2TripGraphQlClient({
      endpoint: 'https://www.clik2trip.com/graphql',
      getSessionToken: async () => 'short-lived-session',
      fetchImplementation,
    });

    await expect(client.request('query Test { ok }', {}, z.object({ ok: z.boolean() }))).resolves.toEqual({
      ok: true,
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe('https://www.clik2trip.com/graphql');
    expect(fetchImplementation.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer short-lived-session',
    });
    expect(fetchImplementation.mock.calls[0]?.[1]).toMatchObject({
      cache: 'no-store',
      redirect: 'error',
    });
  });

  it('parses a live tour through the typed operation', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          data: {
            tour: {
              tourRefId: 'tour-surf-tamarindo',
              slug: 'clase-surf-tamarindo',
              title: 'Clase de surf en Tamarindo',
              summary: null,
              destinationName: 'Guanacaste',
              categoryName: 'Playa y mar',
              durationMin: 120,
              priceFrom: 75.5,
              currency: 'USD',
              hasAvailabilityNext30Days: true,
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new Clik2TripGraphQlClient({
      endpoint: 'https://www.clik2trip.com/graphql',
      fetchImplementation,
    });

    await expect(client.getTour({ slug: 'clase-surf-tamarindo' })).resolves.toMatchObject({
      tourRefId: 'tour-surf-tamarindo',
      priceFrom: 75.5,
    });
  });

  it('preserves stable GraphQL business error codes', async () => {
    const client = new Clik2TripGraphQlClient({
      endpoint: 'https://www.clik2trip.com/graphql',
      fetchImplementation: async () =>
        new Response(
          JSON.stringify({
            errors: [{ message: 'No availability', extensions: { code: 'SIN_DISPONIBILIDAD' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });

    await expect(client.searchTours()).rejects.toMatchObject({
      code: 'SIN_DISPONIBILIDAD',
    });
  });

  it('revalidates an active hold using only its booking code', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          data: {
            booking: {
              id: 'booking-1',
              code: 'BK-DEMO',
              tourRefId: 'tour-surf-tamarindo',
              date: '2026-09-11',
              timeSlot: '08:00',
              participants: 1,
              status: 'NUEVA',
              confirmationType: 'INMEDIATA',
              holdExpiresAt: '2026-09-10T03:10:00.000Z',
              priceSnapshot: {
                basePrice: '75.50',
                discount: '0.00',
                currency: 'USD',
                total: '75.50',
                participants: 1,
              },
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new Clik2TripGraphQlClient({
      endpoint: 'https://www.clik2trip.com/graphql',
      fetchImplementation,
    });

    await expect(client.getBookingHold({ code: 'BK-DEMO' })).resolves.toMatchObject({
      status: 'NUEVA',
      priceSnapshot: { total: '75.50' },
    });
    expect(fetchImplementation.mock.calls[0]?.[1]?.body).toContain('MobileBookingHold');
  });
});
