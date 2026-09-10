import { describe, expect, it } from 'vitest';

import type { WalletCheckout } from '@clik2trip/contracts';
import {
  decimalToBaseUnits,
  evaluateTransfer,
  formatBaseUnits,
  type DemoPolicy,
  type TransferIntent,
} from './index.js';

const now = Date.parse('2026-09-09T15:00:00.000Z');
const token = '0xd077a400968890eacc75cdc901f0356c943e4fdb';
const recipient = '0x1111111111111111111111111111111111111111';
const statementHash = `0x${'2'.repeat(64)}`;

const checkout: WalletCheckout = {
  paymentId: 'pay-1',
  bookingId: 'booking-1',
  network: 'ethereum-sepolia',
  chainId: '11155111',
  asset: 'USD₮',
  tokenContract: token,
  amountBaseUnits: '1000000',
  recipient,
  expiresAt: '2026-09-09T15:10:00.000Z',
  holdExpiresAt: '2026-09-09T15:12:00.000Z',
  statementHash,
};

const policy: DemoPolicy = {
  chainId: '11155111',
  tokenContract: token,
  recipient,
  maxAmountBaseUnits: '5000000',
  minHoldRemainingMs: 120_000,
  authorizationTtlMs: 60_000,
};

const intent: TransferIntent = {
  chainId: checkout.chainId,
  tokenContract: checkout.tokenContract,
  recipient: checkout.recipient,
  amountBaseUnits: checkout.amountBaseUnits,
  statementHash: checkout.statementHash,
  humanAuthorizedAt: '2026-09-09T14:59:30.000Z',
};

describe('evaluateTransfer', () => {
  it('converts USD₮ decimal snapshots without floating point arithmetic', () => {
    expect(decimalToBaseUnits('75.50', 6)).toBe('75500000');
    expect(formatBaseUnits('75500000', 6)).toBe('75.5');
    expect(() => decimalToBaseUnits('1.0000001', 6)).toThrow('AMOUNT_PRECISION_EXCEEDED');
  });

  it('allows the exact reviewed testnet checkout', () => {
    expect(evaluateTransfer(checkout, intent, policy, now)).toEqual({
      allowed: true,
      checkout,
      authorizedAt: intent.humanAuthorizedAt,
    });
  });

  it.each([
    ['CHAIN_MISMATCH', { chainId: '1' }],
    ['TOKEN_MISMATCH', { tokenContract: '0x2222222222222222222222222222222222222222' }],
    ['RECIPIENT_MISMATCH', { recipient: '0x2222222222222222222222222222222222222222' }],
    ['AMOUNT_MISMATCH', { amountBaseUnits: '1000001' }],
    ['STATEMENT_HASH_MISMATCH', { statementHash: `0x${'3'.repeat(64)}` }],
    ['HUMAN_AUTHORIZATION_REQUIRED', { humanAuthorizedAt: null }],
  ] as const)('denies %s', (code, change) => {
    expect(evaluateTransfer(checkout, { ...intent, ...change }, policy, now)).toEqual({
      allowed: false,
      code,
    });
  });

  it('denies a nearly expired hold', () => {
    const shortHold = { ...checkout, holdExpiresAt: '2026-09-09T15:01:00.000Z' };
    expect(evaluateTransfer(shortHold, intent, policy, now)).toEqual({
      allowed: false,
      code: 'HOLD_EXPIRING',
    });
  });

  it('denies an amount above the demo ceiling', () => {
    const large = { ...checkout, amountBaseUnits: '5000001' };
    expect(
      evaluateTransfer(large, { ...intent, amountBaseUnits: large.amountBaseUnits }, policy, now),
    ).toEqual({ allowed: false, code: 'BUDGET_EXCEEDED' });
  });

  it('denies stale human authorization', () => {
    const stale = { ...intent, humanAuthorizedAt: '2026-09-09T14:58:00.000Z' };
    expect(evaluateTransfer(checkout, stale, policy, now)).toEqual({
      allowed: false,
      code: 'AUTHORIZATION_EXPIRED',
    });
  });
});
