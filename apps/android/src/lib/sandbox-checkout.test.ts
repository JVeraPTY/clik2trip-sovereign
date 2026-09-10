import { describe, expect, it } from 'vitest';

import { parseSandboxTariff, type SandboxTariff } from '../config/sandbox-tariff';
import {
  buildSandboxCheckout,
  canonicalCheckoutStatement,
  settlementBaseUnits,
} from './sandbox-checkout';

const nominal: SandboxTariff = {
  mode: 'SANDBOX_NOMINAL',
  amountUsdt: '0.01',
  configError: null,
};

const fullTotal: SandboxTariff = { mode: 'BOOKING_TOTAL', amountUsdt: null, configError: null };

const input = {
  bookingId: 'booking-1',
  paymentId: 'sandbox-booking-1',
  total: '75.50',
  currency: 'USD',
  recipient: '0x2222222222222222222222222222222222222222',
  holdExpiresAt: '2026-09-09T15:15:00.000Z',
  nowMs: Date.parse('2026-09-09T15:00:00.000Z'),
  tariff: fullTotal,
};

const digest = async () => 'a'.repeat(64);

describe('sandbox checkout', () => {
  it('binds the server snapshot to the allowlisted Sepolia settlement', async () => {
    const checkout = await buildSandboxCheckout(input, digest);

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
      buildSandboxCheckout({ ...input, holdExpiresAt: '2026-09-09T15:00:00.000Z' }, digest),
    ).rejects.toThrow('CHECKOUT_EXPIRED');
    await expect(
      buildSandboxCheckout({ ...input, currency: 'CRC' }, digest),
    ).rejects.toThrow('SANDBOX_CURRENCY_UNSUPPORTED');
  });
});

describe('sandbox tariff', () => {
  it('transfers the nominal while keeping the booking total on the statement', async () => {
    const checkout = await buildSandboxCheckout({ ...input, tariff: nominal }, digest);

    expect(checkout.amountBaseUnits).toBe('10000');
    expect(checkout.bookingTotal).toBe('75.50');
    expect(checkout.bookingCurrency).toBe('USD');
    expect(checkout.tariffMode).toBe('SANDBOX_NOMINAL');
  });

  it('covers the booking total and the mode with the authorized statement', async () => {
    const statement = canonicalCheckoutStatement(
      await buildSandboxCheckout({ ...input, tariff: nominal }, digest),
    );

    expect(statement).toContain('75.50');
    expect(statement).toContain('SANDBOX_NOMINAL');
  });

  it('produces a different statement for the same transfer against a different total', async () => {
    const first = canonicalCheckoutStatement(
      await buildSandboxCheckout({ ...input, tariff: nominal }, digest),
    );
    const second = canonicalCheckoutStatement(
      await buildSandboxCheckout({ ...input, total: '12.00', tariff: nominal }, digest),
    );

    // Both move 0.01 USD₮. Swapping the booking total behind the traveler must
    // still break the hash their authorization covered.
    expect(first).not.toBe(second);
  });

  it('converts the nominal at the token decimals, not the fiat ones', () => {
    expect(settlementBaseUnits('75.50', nominal)).toBe('10000');
    expect(settlementBaseUnits('75.50', { ...nominal, amountUsdt: '1' })).toBe('1000000');
    expect(settlementBaseUnits('75.50', { ...nominal, amountUsdt: '0.000001' })).toBe('1');
  });

  it('refuses a nominal that would transfer nothing', () => {
    expect(() => settlementBaseUnits('75.50', { ...nominal, amountUsdt: '0' })).toThrow(
      'TARIFA_SANDBOX_INVALIDA',
    );
    expect(() => settlementBaseUnits('75.50', { ...nominal, amountUsdt: null })).toThrow(
      'TARIFA_SANDBOX_INVALIDA',
    );
  });
});

describe('tariff configuration', () => {
  it('defaults to the small nominal so a faucet balance funds many runs', () => {
    expect(parseSandboxTariff(undefined)).toEqual({
      mode: 'SANDBOX_NOMINAL',
      amountUsdt: '0.01',
      configError: null,
    });
    expect(parseSandboxTariff('')).toMatchObject({ amountUsdt: '0.01' });
  });

  it('accepts an explicit nominal', () => {
    expect(parseSandboxTariff('0.05')).toEqual({
      mode: 'SANDBOX_NOMINAL',
      amountUsdt: '0.05',
      configError: null,
    });
  });

  it('turns the tariff off on request', () => {
    expect(parseSandboxTariff('full')).toEqual({
      mode: 'BOOKING_TOTAL',
      amountUsdt: null,
      configError: null,
    });
    expect(parseSandboxTariff('FULL').mode).toBe('BOOKING_TOTAL');
  });

  it('falls back to the default and says so rather than paying a typo', () => {
    for (const bad of ['abc', '-1', '0', '0.0000001', '1,5']) {
      const parsed = parseSandboxTariff(bad);
      expect(parsed.amountUsdt).toBe('0.01');
      expect(parsed.configError).toBe('TARIFA_SANDBOX_INVALIDA');
    }
  });
});
