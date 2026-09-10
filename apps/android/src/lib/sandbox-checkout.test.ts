import { describe, expect, it } from 'vitest';

import { buildSandboxCheckout, canonicalCheckoutStatement } from './sandbox-checkout';

const input = {
  bookingId: 'booking-1',
  paymentId: 'sandbox-booking-1',
  total: '75.50',
  currency: 'USD',
  recipient: '0x2222222222222222222222222222222222222222',
  holdExpiresAt: '2026-09-09T15:15:00.000Z',
  nowMs: Date.parse('2026-09-09T15:00:00.000Z'),
};

describe('sandbox checkout', () => {
  it('binds the server snapshot to the allowlisted Sepolia settlement', async () => {
    const checkout = await buildSandboxCheckout(input, async () => 'a'.repeat(64));

    expect(checkout).toMatchObject({
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      network: 'ethereum-sepolia',
      chainId: '11155111',
      asset: 'USD₮',
      tokenContract: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
      amountBaseUnits: '75500000',
      recipient: input.recipient,
      expiresAt: '2026-09-09T15:05:00.000Z',
      statementHash: `0x${'a'.repeat(64)}`,
    });
    expect(canonicalCheckoutStatement(checkout)).toContain('75500000');
  });

  it('rejects expired holds and unsupported settlement currency', async () => {
    await expect(
      buildSandboxCheckout(
        { ...input, holdExpiresAt: '2026-09-09T15:00:00.000Z' },
        async () => 'a'.repeat(64),
      ),
    ).rejects.toThrow('CHECKOUT_EXPIRED');
    await expect(
      buildSandboxCheckout({ ...input, currency: 'CRC' }, async () => 'a'.repeat(64)),
    ).rejects.toThrow('SANDBOX_CURRENCY_UNSUPPORTED');
  });
});
