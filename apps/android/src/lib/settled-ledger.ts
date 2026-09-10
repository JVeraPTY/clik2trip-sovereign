const transactionHashPattern = /^0x[0-9a-fA-F]{64}$/;

/**
 * SecureStore warns above 2048 bytes per value. Each entry costs about 69
 * bytes, so the ledger keeps the most recent hashes well inside that budget.
 */
export const settledLedgerLimit = 16;

export function parseSettledLedger(raw: string | null): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const ledger: string[] = [];
  for (const value of parsed) {
    if (typeof value !== 'string' || !transactionHashPattern.test(value)) continue;
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    ledger.push(normalized);
  }
  return ledger.slice(-settledLedgerLimit);
}

export function appendSettledTransaction(
  ledger: readonly string[],
  transactionHash: string,
): string[] {
  if (!transactionHashPattern.test(transactionHash)) {
    throw new Error('TRANSACTION_HASH_INVALID');
  }
  const normalized = transactionHash.toLowerCase();
  const withoutDuplicate = ledger.filter((hash) => hash.toLowerCase() !== normalized);
  return [...withoutDuplicate, normalized].slice(-settledLedgerLimit);
}
