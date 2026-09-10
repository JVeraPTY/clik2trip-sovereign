import { z } from 'zod';

export const inferenceStateSchema = z.enum([
  'NOT_READY',
  'DOWNLOADING',
  'LOADING',
  'READY',
  'RUNNING',
  'ERROR',
  'CANCELLED',
]);

export type InferenceState = z.infer<typeof inferenceStateSchema>;

export const visionAnalysisSchema = z.object({
  category: z.string().min(1),
  destination: z.string().min(1).nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  accessibilitySignals: z.array(z.string()),
  restrictions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
});

export type VisionAnalysis = z.infer<typeof visionAnalysisSchema>;

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type GeoPoint = z.infer<typeof geoPointSchema>;

/**
 * Where a local catalog entry comes from, and therefore what may be done with
 * it. `clik2trip` entries mirror a tour the Gateway can price, hold and book;
 * `demo-seed` entries are authored sample data for demonstrations and
 * measurement runs, and are never presented as bookable inventory.
 */
export const tourSourceSchema = z.enum(['clik2trip', 'demo-seed']);

export type TourSource = z.infer<typeof tourSourceSchema>;

export const localTourSchema = z.object({
  tourRefId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  destinationName: z.string().min(1),
  categoryName: z.string().min(1),
  durationMin: z.number().int().positive(),
  includes: z.array(z.string()),
  excludes: z.array(z.string()),
  searchTerms: z.array(z.string()),
  /** Absent in the original four-tour snapshot, which predates this field. */
  source: tourSourceSchema.default('clik2trip'),
  /** The region whose snapshot carries this entry. */
  regionId: z.string().min(1).optional(),
  /** Where the activity happens, used to pick a region near the traveler. */
  geo: geoPointSchema.optional(),
  /**
   * Reference price. A `clik2trip` entry leaves this out on purpose — the
   * Gateway is the only source of a price that may be charged. A `demo-seed`
   * entry carries one so the demonstration path can run without a Gateway.
   */
  priceFrom: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  providerName: z.string().min(1).optional(),
});

export type LocalTour = z.infer<typeof localTourSchema>;

export const localTourRecommendationSchema = z.object({
  tour: localTourSchema,
  score: z.number().finite(),
});

export type LocalTourRecommendation = z.infer<typeof localTourRecommendationSchema>;

const hexAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const moneyStringSchema = z.string().regex(/^\d+(?:\.\d{1,2})?$/);

/**
 * What `amountBaseUnits` represents.
 *
 * `BOOKING_TOTAL` transfers the frozen booking total one-for-one in test USD₮.
 * `SANDBOX_NOMINAL` transfers a small fixed test amount instead, so a faucet
 * balance funds many settlement runs rather than one. The booking total is
 * carried alongside either way, is shown next to the transferred amount, and is
 * covered by the statement hash — the nominal is a testnet artefact, never a
 * claim that the experience costs that.
 */
export const tariffModeSchema = z.enum(['BOOKING_TOTAL', 'SANDBOX_NOMINAL']);

export type TariffMode = z.infer<typeof tariffModeSchema>;

export const walletCheckoutSchema = z.object({
  paymentId: z.string().min(1),
  bookingId: z.string().min(1),
  network: z.literal('ethereum-sepolia'),
  chainId: z.literal('11155111'),
  asset: z.literal('USD₮'),
  tokenContract: hexAddressSchema,
  amountBaseUnits: z.string().regex(/^\d+$/),
  recipient: hexAddressSchema,
  expiresAt: z.iso.datetime({ offset: true }),
  statementHash: hashSchema,
  holdExpiresAt: z.iso.datetime({ offset: true }),
  /** The commercial total the traveler agreed to, kept verbatim from the hold. */
  bookingTotal: moneyStringSchema,
  bookingCurrency: z.string().length(3),
  tariffMode: tariffModeSchema,
});

export type WalletCheckout = z.infer<typeof walletCheckoutSchema>;

export const paymentStatusSchema = z.enum([
  'CREATED',
  'AWAITING_AUTHORIZATION',
  'SUBMITTED',
  'VERIFYING',
  'APROBADO',
  'FAILED',
  'MISMATCHED',
  'EXPIRED',
]);

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const performanceRecordSchema = z.object({
  schemaVersion: z.literal(1),
  recordedAt: z.iso.datetime({ offset: true }),
  deviceModel: z.string().min(1),
  androidVersion: z.string().min(1),
  qvacSdkVersion: z.literal('0.19.0'),
  modelName: z.literal('VisionPsy-Nano-460M-Flash'),
  quantization: z.literal('Q4_K_M'),
  modelBytes: z.literal(411925632),
  loadMs: z.number().nonnegative(),
  promptHash: z.string().regex(/^[0-9a-f]{64}$/),
  promptCategory: z.string().min(1),
  promptTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  ttftMs: z.number().nonnegative(),
  totalMs: z.number().nonnegative(),
  tokensPerSecond: z.number().nonnegative(),
  backendDevice: z.enum(['cpu', 'gpu', 'unknown']),
  success: z.boolean(),
  errorCode: z.string().min(1).nullable(),
  offline: z.boolean(),
});

export type PerformanceRecord = z.infer<typeof performanceRecordSchema>;
