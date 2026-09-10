import { describe, expect, it } from 'vitest';

import {
  appendSettledTransaction,
  parseSettledLedger,
  settledLedgerLimit,
} from './settled-ledger';

const hash = (nibble: string) => `0x${nibble.repeat(64)}`;

describe('settled transaction ledger', () => {
  it('reads a stored ledger and discards anything that is not a transaction hash', () => {
    expect(parseSettledLedger(null)).toEqual([]);
    expect(parseSettledLedger('not json')).toEqual([]);
    expect(parseSettledLedger('{"a":1}')).toEqual([]);
    expect(
      parseSettledLedger(JSON.stringify([hash('a'), 42, '0xshort', hash('A'), hash('b')])),
    ).toEqual([hash('a'), hash('b')]);
  });

  it('appends a settlement without duplicating a hash that differs only in case', () => {
    const ledger = appendSettledTransaction([hash('a')], hash('B'));

    expect(ledger).toEqual([hash('a'), hash('b')]);
    expect(appendSettledTransaction(ledger, hash('A'))).toEqual([hash('b'), hash('a')]);
    expect(() => appendSettledTransaction(ledger, '0xshort')).toThrow('TRANSACTION_HASH_INVALID');
  });

  it('keeps the most recent settlements inside the SecureStore budget', () => {
    const overflowing = Array.from(
      { length: settledLedgerLimit + 4 },
      (_, index) => `0x${(index + 1).toString(16).padStart(64, '0')}`,
    );
    const ledger = overflowing.reduce(
      (current, transactionHash) => appendSettledTransaction(current, transactionHash),
      [] as string[],
    );

    expect(new Set(overflowing).size).toBe(overflowing.length);
    expect(ledger).toHaveLength(settledLedgerLimit);
    expect(ledger).toEqual(overflowing.slice(-settledLedgerLimit));
  });
});
