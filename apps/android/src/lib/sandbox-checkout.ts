import { walletCheckoutSchema, type WalletCheckout } from '@clik2trip/contracts';
import { decimalToBaseUnits } from '@clik2trip/policy-engine';
import { sepolia } from '@clik2trip/wdk-wallet/sepolia';

export interface SandboxCheckoutInput {
  bookingId: string;
  paymentId: string;
  total: string;
  currency: string;
  recipient: string;
  holdExpiresAt: string;
  nowMs: number;
}

export type Sha256Digest = (statement: string) => Promise<string>;

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
  ]);
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
    amountBaseUnits: decimalToBaseUnits(input.total, sepolia.testUsdtDecimals),
    recipient: input.recipient,
    expiresAt: new Date(expiresAtMs).toISOString(),
    holdExpiresAt: new Date(holdExpiresAtMs).toISOString(),
  };
  const digestHex = await digest(canonicalCheckoutStatement(checkoutWithoutHash));
  return walletCheckoutSchema.parse({
    ...checkoutWithoutHash,
    statementHash: `0x${digestHex}`,
  });
}
