import type { TariffMode } from '@clik2trip/contracts';

/**
 * How much test USD₮ one sandbox settlement moves.
 *
 * A faucet hands out a few tens of test USD₮, and settling a real booking total
 * one-for-one spends the whole balance in a run or two. The nominal decouples
 * the two: the traveler still sees, authorizes and freezes the real total, and
 * the chain still carries a real transfer that a separate RPC verifies — but
 * the amount transferred is a token figure, so the same balance funds hundreds
 * of runs instead of one.
 *
 * The nominal is a testnet artefact. It is never the price of anything, and the
 * interface must always show it beside the booking total rather than instead of
 * it.
 *
 * `EXPO_PUBLIC_SANDBOX_TARIFF_USDT` accepts a decimal amount, or `full` to
 * transfer the booking total as Phase 4 originally recorded it.
 */
export const defaultSandboxTariffUsdt = '0.01';

/** Test USD₮ has six decimals; a finer nominal cannot be expressed on chain. */
const tariffPattern = /^\d+(?:\.\d{1,6})?$/;

export interface SandboxTariff {
  mode: TariffMode;
  /** The nominal as a decimal string, or null when the booking total is used. */
  amountUsdt: string | null;
  /**
   * Set when the configured value could not be used. The default applies and
   * the interface says so, rather than a typo silently changing what is paid.
   */
  configError: string | null;
}

export function parseSandboxTariff(raw: string | undefined): SandboxTariff {
  const value = raw?.trim();
  if (value === undefined || value === '') {
    return { mode: 'SANDBOX_NOMINAL', amountUsdt: defaultSandboxTariffUsdt, configError: null };
  }
  if (value.toLowerCase() === 'full') {
    return { mode: 'BOOKING_TOTAL', amountUsdt: null, configError: null };
  }
  if (!tariffPattern.test(value) || Number(value) <= 0) {
    return {
      mode: 'SANDBOX_NOMINAL',
      amountUsdt: defaultSandboxTariffUsdt,
      configError: 'TARIFA_SANDBOX_INVALIDA',
    };
  }
  return { mode: 'SANDBOX_NOMINAL', amountUsdt: value, configError: null };
}

export const sandboxTariff = parseSandboxTariff(process.env.EXPO_PUBLIC_SANDBOX_TARIFF_USDT);
