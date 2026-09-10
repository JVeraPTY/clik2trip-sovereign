import { z } from 'zod';

import { operations } from './operations';
import {
  availabilityInputSchema,
  availabilitySlotSchema,
  bookingHoldInputSchema,
  bookingHoldRevalidationSchema,
  bookingHoldSchema,
  createBookingHoldInputSchema,
  catalogExperienceSchema,
  liveTourSchema,
  searchToursInputSchema,
  tourInputSchema,
  type AvailabilityInput,
  type BookingHoldInput,
  type BookingHoldRevalidation,
  type BookingHold,
  type CreateBookingHoldInput,
  type CatalogExperience,
  type LiveTour,
  type SearchToursInput,
  type TourInput,
} from './schemas';

export * from './operations';
export * from './schemas';

const graphQlErrorSchema = z.object({
  message: z.string(),
  extensions: z.object({ code: z.string().optional() }).optional(),
});

const graphQlResponseSchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(graphQlErrorSchema).optional(),
});

export class Clik2TripGraphQlError extends Error {
  readonly code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = 'Clik2TripGraphQlError';
    this.code = code;
  }
}

export interface GraphQlClientOptions {
  endpoint: string;
  getSessionToken?: () => Promise<string | null>;
  fetchImplementation?: typeof fetch;
}

export class Clik2TripGraphQlClient {
  private readonly endpoint: string;
  private readonly getSessionToken: () => Promise<string | null>;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: GraphQlClientOptions) {
    let endpoint: URL;
    try {
      endpoint = new URL(options.endpoint);
    } catch {
      throw new Clik2TripGraphQlError('CLIK2TRIP_GATEWAY_URL_INVALID');
    }
    if (endpoint.protocol !== 'https:') {
      throw new Clik2TripGraphQlError('CLIK2TRIP_GATEWAY_HTTPS_REQUIRED');
    }
    this.endpoint = endpoint.toString();
    this.getSessionToken = options.getSessionToken ?? (async () => null);
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async request<T>(document: string, variables: Record<string, unknown>, schema: z.ZodType<T>) {
    const token = await this.getSessionToken();
    const response = await this.fetchImplementation(this.endpoint, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query: document, variables }),
    });

    if (!response.ok) {
      throw new Clik2TripGraphQlError(`CLIK2TRIP_HTTP_${response.status}`);
    }
    const envelope = graphQlResponseSchema.parse(await response.json());
    if (envelope.errors?.length) {
      const first = envelope.errors[0];
      throw new Clik2TripGraphQlError(
        first?.extensions?.code ?? 'CLIK2TRIP_GRAPHQL_ERROR',
        first?.message,
      );
    }
    if (envelope.data === undefined) {
      throw new Clik2TripGraphQlError('CLIK2TRIP_GRAPHQL_DATA_MISSING');
    }
    return schema.parse(envelope.data);
  }

  async searchTours(input: SearchToursInput = {}): Promise<LiveTour[]> {
    const variables = searchToursInputSchema.parse(input);
    const data = await this.request(
      operations.searchTours,
      variables,
      z.object({
        searchTours: z.object({
          total: z.number().int().nonnegative(),
          items: z.array(liveTourSchema),
        }),
      }),
    );
    return data.searchTours.items;
  }

  async searchExperiences(input: SearchToursInput = {}): Promise<CatalogExperience[]> {
    const variables = searchToursInputSchema.parse(input);
    const data = await this.request(
      operations.searchExperiences,
      { locale: variables.locale, pageSize: variables.pageSize },
      z.object({
        searchTours: z.object({
          total: z.number().int().nonnegative(),
          items: z.array(catalogExperienceSchema),
        }),
      }),
    );
    return data.searchTours.items;
  }

  async getTour(input: TourInput): Promise<LiveTour | null> {
    const variables = tourInputSchema.parse(input);
    const data = await this.request(
      operations.tour,
      variables,
      z.object({ tour: liveTourSchema.nullable() }),
    );
    return data.tour;
  }

  async getAvailability(input: AvailabilityInput) {
    const variables = availabilityInputSchema.parse(input);
    const data = await this.request(
      operations.availability,
      variables,
      z.object({ availability: z.array(availabilitySlotSchema) }),
    );
    return data.availability;
  }

  async createBookingHold(input: CreateBookingHoldInput): Promise<BookingHold> {
    const variables = { input: createBookingHoldInputSchema.parse(input) };
    const data = await this.request(
      operations.createBookingHold,
      variables,
      z.object({ createBookingHold: bookingHoldSchema }),
    );
    return data.createBookingHold;
  }

  async getBookingHold(input: BookingHoldInput): Promise<BookingHoldRevalidation | null> {
    const variables = bookingHoldInputSchema.parse(input);
    const data = await this.request(
      operations.bookingHold,
      variables,
      z.object({ booking: bookingHoldRevalidationSchema.nullable() }),
    );
    return data.booking;
  }
}
