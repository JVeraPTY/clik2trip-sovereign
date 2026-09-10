import { z } from 'zod';

const dateSchema = z.iso.date();
const timeSlotSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const moneyStringSchema = z.string().regex(/^\d+(?:\.\d{1,2})?$/);

export const liveTourSchema = z.object({
  tourRefId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable(),
  destinationName: z.string().nullable(),
  categoryName: z.string().nullable(),
  durationMin: z.number().int().positive().nullable(),
  priceFrom: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
  hasAvailabilityNext30Days: z.boolean(),
});

export type LiveTour = z.infer<typeof liveTourSchema>;

/**
 * The catalogue card the Clik2Trip site shows. Kept separate from
 * `liveTourSchema` on purpose: that one backs the price-and-hold flow, whose
 * contract is already covered by recorded evidence, and this one only feeds a
 * display surface.
 */
export const catalogExperienceSchema = z.object({
  tourRefId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable(),
  destinationName: z.string().nullable(),
  providerName: z.string().min(1),
  confirmationType: z.enum(['INMEDIATA', 'PENDIENTE']),
  durationMin: z.number().int().positive().nullable(),
  priceFrom: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
  thumbnailUrl: z.url().nullable(),
  hasAvailabilityNext30Days: z.boolean(),
});

export type CatalogExperience = z.infer<typeof catalogExperienceSchema>;

export const searchToursInputSchema = z.object({
  filters: z
    .object({
      q: z.string().trim().min(1).optional(),
      category: z.string().trim().min(1).optional(),
      destination: z.string().trim().min(1).optional(),
    })
    .optional(),
  locale: z.enum(['es', 'en']).default('es'),
  pageSize: z.number().int().min(1).max(20).default(20),
});

export type SearchToursInput = z.input<typeof searchToursInputSchema>;

export const tourInputSchema = z.object({
  slug: z.string().trim().min(1),
  locale: z.enum(['es', 'en']).default('es'),
});

export type TourInput = z.input<typeof tourInputSchema>;

export const availabilitySlotSchema = z.object({
  date: dateSchema,
  timeSlot: timeSlotSchema,
  capacity: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  spotsLeft: z.number().int().nonnegative(),
  isBlocked: z.boolean(),
});

export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

export const availabilityInputSchema = z
  .object({
    tourRefId: z.string().min(1),
    from: dateSchema,
    to: dateSchema,
  })
  .refine((value) => value.from <= value.to, { message: 'CLIK2TRIP_INVALID_DATE_RANGE' });

export type AvailabilityInput = z.infer<typeof availabilityInputSchema>;

export const createBookingHoldInputSchema = z.object({
  tourRefId: z.string().min(1),
  date: dateSchema,
  timeSlot: timeSlotSchema,
  participants: z.number().int().min(1).max(20),
  customer: z.object({
    email: z.email(),
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(30).optional(),
  }),
});

export type CreateBookingHoldInput = z.infer<typeof createBookingHoldInputSchema>;

export const priceSnapshotSchema = z.object({
  basePrice: moneyStringSchema,
  discount: moneyStringSchema,
  currency: z.string().min(3).max(3),
  total: moneyStringSchema,
  participants: z.number().int().positive(),
});

export const bookingHoldSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  tourRefId: z.string().min(1),
  participants: z.number().int().positive(),
  status: z.literal('NUEVA'),
  confirmationType: z.enum(['INMEDIATA', 'PENDIENTE']),
  holdExpiresAt: z.iso.datetime({ offset: true }).nullable(),
  priceSnapshot: priceSnapshotSchema,
  policySnapshot: z.record(z.string(), z.unknown()),
});

export type BookingHold = z.infer<typeof bookingHoldSchema>;

export const bookingHoldInputSchema = z.object({
  code: z.string().trim().min(1),
});

export type BookingHoldInput = z.infer<typeof bookingHoldInputSchema>;

export const bookingHoldRevalidationSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  tourRefId: z.string().min(1),
  date: dateSchema,
  timeSlot: timeSlotSchema,
  participants: z.number().int().positive(),
  status: z.enum([
    'NUEVA',
    'PAGO_RECIBIDO',
    'CONFIRMADA',
    'PENDIENTE_CONFIRMACION',
    'RECHAZADA_PROVEEDOR',
    'ALTERNATIVA_OFRECIDA',
    'CANCELADA_CLIENTE',
    'CANCELADA_PROVEEDOR',
    'REEMBOLSO_PENDIENTE',
    'REEMBOLSO_PROCESADO',
    'CREDITO_EMITIDO',
    'EN_DISPUTA',
    'COMPLETADA',
    'CERRADA',
    'EXPIRADA',
  ]),
  confirmationType: z.enum(['INMEDIATA', 'PENDIENTE']),
  holdExpiresAt: z.iso.datetime({ offset: true }).nullable(),
  priceSnapshot: priceSnapshotSchema,
});

export type BookingHoldRevalidation = z.infer<typeof bookingHoldRevalidationSchema>;
