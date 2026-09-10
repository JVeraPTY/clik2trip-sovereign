import type { WalletCheckout } from '@clik2trip/contracts';

export const policyDenialCodes = [
  'DEMO_MAINNET_FORBIDDEN',
  'CHECKOUT_EXPIRED',
  'HOLD_EXPIRING',
  'CHAIN_MISMATCH',
  'TOKEN_MISMATCH',
  'RECIPIENT_MISMATCH',
  'AMOUNT_MISMATCH',
  'STATEMENT_HASH_MISMATCH',
  'HUMAN_AUTHORIZATION_REQUIRED',
  'AUTHORIZATION_EXPIRED',
  'BUDGET_EXCEEDED',
] as const;

export type PolicyDenialCode = (typeof policyDenialCodes)[number];

export interface TransferIntent {
  chainId: string;
  tokenContract: string;
  recipient: string;
  amountBaseUnits: string;
  statementHash: string;
  humanAuthorizedAt: string | null;
}

export interface DemoPolicy {
  chainId: '11155111';
  tokenContract: string;
  recipient: string;
  maxAmountBaseUnits: string;
  minHoldRemainingMs: number;
  authorizationTtlMs: number;
}

export type PolicyDecision =
  | { allowed: true; checkout: WalletCheckout; authorizedAt: string }
  | { allowed: false; code: PolicyDenialCode };

export function decimalToBaseUnits(value: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error('INVALID_TOKEN_DECIMALS');
  }
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new Error('INVALID_DECIMAL_AMOUNT');
  const fraction = match[2] ?? '';
  if (fraction.length > decimals) throw new Error('AMOUNT_PRECISION_EXCEEDED');
  const scale = 10n ** BigInt(decimals);
  const whole = BigInt(match[1] ?? '0') * scale;
  const fractional = fraction.length > 0 ? BigInt(fraction.padEnd(decimals, '0')) : 0n;
  return (whole + fractional).toString();
}

export function formatBaseUnits(value: string, decimals: number): string {
  if (!/^\d+$/.test(value)) throw new Error('INVALID_BASE_UNIT_AMOUNT');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error('INVALID_TOKEN_DECIMALS');
  }
  if (decimals === 0) return BigInt(value).toString();
  const padded = value.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${BigInt(whole).toString()}.${fraction}` : BigInt(whole).toString();
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function deny(code: PolicyDenialCode): PolicyDecision {
  return { allowed: false, code };
}

export function evaluateTransfer(
  checkout: WalletCheckout,
  intent: TransferIntent,
  policy: DemoPolicy,
  nowMs: number,
): PolicyDecision {
  if (checkout.network !== 'ethereum-sepolia' || checkout.chainId !== '11155111') {
    return deny('DEMO_MAINNET_FORBIDDEN');
  }

  if (Date.parse(checkout.expiresAt) <= nowMs) return deny('CHECKOUT_EXPIRED');
  if (Date.parse(checkout.holdExpiresAt) - nowMs < policy.minHoldRemainingMs) {
    return deny('HOLD_EXPIRING');
  }

  if (checkout.chainId !== policy.chainId || intent.chainId !== checkout.chainId) {
    return deny('CHAIN_MISMATCH');
  }

  if (
    !sameHex(checkout.tokenContract, policy.tokenContract) ||
    !sameHex(intent.tokenContract, checkout.tokenContract)
  ) {
    return deny('TOKEN_MISMATCH');
  }

  if (!sameHex(checkout.recipient, policy.recipient) || !sameHex(intent.recipient, checkout.recipient)) {
    return deny('RECIPIENT_MISMATCH');
  }

  if (intent.amountBaseUnits !== checkout.amountBaseUnits) return deny('AMOUNT_MISMATCH');
  if (!sameHex(intent.statementHash, checkout.statementHash)) {
    return deny('STATEMENT_HASH_MISMATCH');
  }

  if (BigInt(checkout.amountBaseUnits) > BigInt(policy.maxAmountBaseUnits)) {
    return deny('BUDGET_EXCEEDED');
  }

  if (!intent.humanAuthorizedAt) return deny('HUMAN_AUTHORIZATION_REQUIRED');
  const authorizedAtMs = Date.parse(intent.humanAuthorizedAt);
  if (
    !Number.isFinite(authorizedAtMs) ||
    authorizedAtMs > nowMs ||
    nowMs - authorizedAtMs > policy.authorizationTtlMs
  ) {
    return deny('AUTHORIZATION_EXPIRED');
  }

  return { allowed: true, checkout, authorizedAt: intent.humanAuthorizedAt };
}
