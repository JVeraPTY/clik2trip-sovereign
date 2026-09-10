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
});

export type LocalTour = z.infer<typeof localTourSchema>;

export const localTourRecommendationSchema = z.object({
  tour: localTourSchema,
  score: z.number().finite(),
});

export type LocalTourRecommendation = z.infer<typeof localTourRecommendationSchema>;

const hexAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

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
