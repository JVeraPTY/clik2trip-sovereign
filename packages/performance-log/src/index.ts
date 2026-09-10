import {
  performanceRecordSchema,
  type PerformanceRecord,
} from '@clik2trip/contracts';

export interface QvacTimingInput {
  recordedAt: string;
  deviceModel: string;
  androidVersion: string;
  loadMs: number;
  promptHash: string;
  promptCategory: string;
  promptTokens?: number;
  generatedTokens?: number;
  emittedTokens?: number;
  timeToFirstToken?: number;
  tokensPerSecond?: number;
  totalMs: number;
  backendDevice?: 'cpu' | 'gpu';
  success: boolean;
  errorCode?: string | null;
  offline: boolean;
}

export function createPerformanceRecord(input: QvacTimingInput): PerformanceRecord {
  return performanceRecordSchema.parse({
    schemaVersion: 1,
    recordedAt: input.recordedAt,
    deviceModel: input.deviceModel,
    androidVersion: input.androidVersion,
    qvacSdkVersion: '0.19.0',
    modelName: 'VisionPsy-Nano-460M-Flash',
    quantization: 'Q4_K_M',
    modelBytes: 411925632,
    loadMs: input.loadMs,
    promptHash: input.promptHash,
    promptCategory: input.promptCategory,
    promptTokens: input.promptTokens ?? 0,
    outputTokens: input.emittedTokens ?? input.generatedTokens ?? 0,
    ttftMs: input.timeToFirstToken ?? 0,
    totalMs: input.totalMs,
    tokensPerSecond: input.tokensPerSecond ?? 0,
    backendDevice: input.backendDevice ?? 'unknown',
    success: input.success,
    errorCode: input.errorCode ?? null,
    offline: input.offline,
  });
}

export function percentile(values: number[], rank: number): number {
  if (!Number.isFinite(rank) || rank <= 0 || rank > 1) {
    throw new Error('PERCENTILE_RANK_OUT_OF_RANGE');
  }
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(rank * sorted.length) - 1);
  return sorted[index] ?? 0;
}

export function summarizePerformance(records: PerformanceRecord[]) {
  const successful = records.filter((record) => record.success);
  return {
    runs: records.length,
    successfulRuns: successful.length,
    medianTtftMs: percentile(
      successful.map((record) => record.ttftMs),
      0.5,
    ),
    p95TtftMs: percentile(
      successful.map((record) => record.ttftMs),
      0.95,
    ),
    medianTokensPerSecond: percentile(
      successful.map((record) => record.tokensPerSecond),
      0.5,
    ),
    p95TokensPerSecond: percentile(
      successful.map((record) => record.tokensPerSecond),
      0.95,
    ),
    medianLoadMs: percentile(
      successful.map((record) => record.loadMs),
      0.5,
    ),
    p95LoadMs: percentile(
      successful.map((record) => record.loadMs),
      0.95,
    ),
  };
}
