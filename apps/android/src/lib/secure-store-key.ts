/**
 * SecureStore rejects any key outside `[A-Za-z0-9._-]`, so a server identifier
 * cannot be interpolated into one as-is. Two different holds can only ever
 * collapse onto the same key by both containing characters SecureStore forbids;
 * that collision would reuse an existing attempt lock and refuse a transfer, so
 * it fails closed.
 */
const forbiddenInKey = /[^A-Za-z0-9._-]/g;

export function sandboxAttemptKey(holdId: string): string {
  const normalized = holdId.replace(forbiddenInKey, '_');
  if (normalized.length === 0) throw new Error('HOLD_ID_INVALID');
  return `sandbox-payment-attempt-${normalized}`;
}
