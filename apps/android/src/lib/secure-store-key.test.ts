import { describe, expect, it } from 'vitest';

import { sandboxAttemptKey } from './secure-store-key';

const secureStoreKeyPattern = /^[A-Za-z0-9._-]+$/;

describe('sandbox attempt storage key', () => {
  it('keeps identifiers that SecureStore already accepts', () => {
    expect(sandboxAttemptKey('BK-YBZMSU')).toBe('sandbox-payment-attempt-BK-YBZMSU');
    expect(sandboxAttemptKey('9f3b2c1e-5a44-4d0e-8f21-6b7c8d9e0a1b')).toBe(
      'sandbox-payment-attempt-9f3b2c1e-5a44-4d0e-8f21-6b7c8d9e0a1b',
    );
  });

  it('replaces every character SecureStore rejects', () => {
    for (const holdId of ['a:b', 'a/b', 'a b', 'gid://Booking/12', 'ñ']) {
      expect(sandboxAttemptKey(holdId)).toMatch(secureStoreKeyPattern);
    }
    expect(sandboxAttemptKey('gid://Booking/12')).toBe(
      'sandbox-payment-attempt-gid___Booking_12',
    );
  });

  it('refuses an identifier that leaves nothing to key on', () => {
    expect(() => sandboxAttemptKey('')).toThrow('HOLD_ID_INVALID');
  });
});
