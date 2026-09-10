import { describe, expect, it } from 'vitest';

import type { WalletCheckout } from '@clik2trip/contracts';
import { decodeTransferLog, transferTopic, verifySettlement } from './index.js';

const sender = '0x1111111111111111111111111111111111111111';
const recipient = '0x2222222222222222222222222222222222222222';
const token = '0xd077a400968890eacc75cdc901f0356c943e4fdb';
const transactionHash = `0x${'3'.repeat(64)}`;

const checkout: WalletCheckout = {
  paymentId: 'sandbox-payment',
  bookingId: 'sandbox-booking',
  network: 'ethereum-sepolia',
  chainId: '11155111',
  asset: 'USD₮',
  tokenContract: token,
  amountBaseUnits: '75500000',
  recipient,
  expiresAt: '2026-09-09T15:10:00.000Z',
  holdExpiresAt: '2026-09-09T15:15:00.000Z',
  statementHash: `0x${'4'.repeat(64)}`,
  bookingTotal: '75.50',
  bookingCurrency: 'USD',
  tariffMode: 'BOOKING_TOTAL',
};

const transfer = {
  tokenContract: token,
  sender,
  recipient,
  amountBaseUnits: checkout.amountBaseUnits,
};

const observation = {
  chainId: '11155111',
  transactionHash,
  succeeded: true,
  blockNumber: 100,
  latestBlockNumber: 101,
  blockTimestampMs: Date.parse('2026-09-09T15:05:00.000Z'),
  transfers: [transfer],
};

describe('USD₮ settlement verifier', () => {
  it('decodes an exact ERC-20 Transfer event', () => {
    expect(
      decodeTransferLog({
        address: token,
        topics: [
          transferTopic,
          `0x${'0'.repeat(24)}${sender.slice(2)}`,
          `0x${'0'.repeat(24)}${recipient.slice(2)}`,
        ],
        data: `0x${BigInt(checkout.amountBaseUnits).toString(16).padStart(64, '0')}`,
      }),
    ).toEqual(transfer);
  });

  it('verifies the exact finalized transfer', () => {
    expect(verifySettlement(checkout, sender, observation)).toMatchObject({
      verified: true,
      transactionHash,
      confirmations: 2,
    });
  });

  it.each([
    ['CHAIN_MISMATCH', { chainId: '1' }],
    ['TRANSACTION_FAILED', { succeeded: false }],
    ['TOKEN_MISMATCH', { transfers: [{ ...transfer, tokenContract: recipient }] }],
    ['SENDER_MISMATCH', { transfers: [{ ...transfer, sender: recipient }] }],
    ['RECIPIENT_MISMATCH', { transfers: [{ ...transfer, recipient: sender }] }],
    ['AMOUNT_MISMATCH', { transfers: [{ ...transfer, amountBaseUnits: '1' }] }],
  ] as const)('denies %s', (code, change) => {
    expect(verifySettlement(checkout, sender, { ...observation, ...change })).toEqual({
      verified: false,
      code,
    });
  });

  it('waits for finality and rejects transaction reuse', () => {
    expect(
      verifySettlement(checkout, sender, { ...observation, latestBlockNumber: 100 }),
    ).toEqual({ verified: false, code: 'FINALITY_PENDING', confirmations: 1 });
    expect(verifySettlement(checkout, sender, observation, new Set([transactionHash]))).toEqual({
      verified: false,
      code: 'TRANSACTION_ALREADY_USED',
    });
  });
});
