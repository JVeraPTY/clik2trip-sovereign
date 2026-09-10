import { walletCheckoutSchema, type WalletCheckout } from '@clik2trip/contracts';
import { decimalToBaseUnits } from '@clik2trip/policy-engine';
import { sepolia } from '@clik2trip/wdk-wallet/sepolia';

import type { SandboxTariff } from '../config/sandbox-tariff';

export interface SandboxCheckoutInput {
  bookingId: string;
  paymentId: string;
  /** The booking total frozen by the hold. */
  total: string;
  currency: string;
  recipient: string;
  holdExpiresAt: string;
  nowMs: number;
  tariff: SandboxTariff;
}

export type Sha256Digest = (statement: string) => Promise<string>;

/**
 * The exact bytes the traveler's authorization covers.
 *
 * The booking total and the tariff mode are part of it, not just the transfer
 * amount: what is authorized is "this much test USD₮ against this booking
 * total", and swapping either one behind the traveler's back has to break the
 * hash.
 */
export function canonicalCheckoutStatement(
  checkout: Omit<WalletCheckout, 'statementHash'>,
): string {
  return JSON.stringify([
    checkout.paymentId,
    checkout.bookingId,
    checkout.network,
    checkout.chainId,
    checkout.asset,
    checkout.tokenContract.toLowerCase(),
    checkout.amountBaseUnits,
    checkout.recipient.toLowerCase(),
    checkout.expiresAt,
    checkout.holdExpiresAt,
    checkout.bookingTotal,
    checkout.bookingCurrency,
    checkout.tariffMode,
  ]);
}

/**
 * What the chain will actually move: the sandbox nominal, or the booking total
 * one-for-one when the tariff is turned off.
 */
export function settlementBaseUnits(total: string, tariff: SandboxTariff): string {
  if (tariff.mode === 'BOOKING_TOTAL') {
    return decimalToBaseUnits(total, sepolia.testUsdtDecimals);
  }
  if (!tariff.amountUsdt) throw new Error('TARIFA_SANDBOX_INVALIDA');
  const nominal = decimalToBaseUnits(tariff.amountUsdt, sepolia.testUsdtDecimals);
  if (BigInt(nominal) <= 0n) throw new Error('TARIFA_SANDBOX_INVALIDA');
  return nominal;
}

export async function buildSandboxCheckout(
  input: SandboxCheckoutInput,
  digest: Sha256Digest,
): Promise<WalletCheckout> {
  if (input.currency !== 'USD') throw new Error('SANDBOX_CURRENCY_UNSUPPORTED');
  const holdExpiresAtMs = Date.parse(input.holdExpiresAt);
  if (!Number.isFinite(holdExpiresAtMs) || holdExpiresAtMs <= input.nowMs) {
    throw new Error('CHECKOUT_EXPIRED');
  }
  const expiresAtMs = Math.min(holdExpiresAtMs, input.nowMs + 5 * 60_000);
  const checkoutWithoutHash: Omit<WalletCheckout, 'statementHash'> = {
    paymentId: input.paymentId,
    bookingId: input.bookingId,
    network: 'ethereum-sepolia',
    chainId: sepolia.chainIdString,
    asset: 'USD₮',
    tokenContract: sepolia.testUsdtContract,
    amountBaseUnits: settlementBaseUnits(input.total, input.tariff),
    recipient: input.recipient,
    expiresAt: new Date(expiresAtMs).toISOString(),
    holdExpiresAt: new Date(holdExpiresAtMs).toISOString(),
    bookingTotal: input.total,
    bookingCurrency: input.currency,
    tariffMode: input.tariff.mode,
  };
  const digestHex = await digest(canonicalCheckoutStatement(checkoutWithoutHash));
  return walletCheckoutSchema.parse({
    ...checkoutWithoutHash,
    statementHash: `0x${digestHex}`,
  });
}
