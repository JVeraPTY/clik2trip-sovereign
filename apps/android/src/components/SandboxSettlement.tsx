import {
  type BookingHold,
  Clik2TripGraphQlClient,
} from '@clik2trip/cliktotrip-client';
import type { WalletCheckout } from '@clik2trip/contracts';
import {
  evaluateTransfer,
  formatBaseUnits,
  type DemoPolicy,
  type TransferIntent,
} from '@clik2trip/policy-engine';
import { verifyUserOperationSettlement } from '@clik2trip/usdt-verifier';
import { sepolia, testUsdtAsset } from '@clik2trip/wdk-wallet';
import { useAccount, useWdkApp } from '@tetherto/wdk-react-native-core';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { expoSha256 } from '../lib/expo-sha256';
import { buildSandboxCheckout } from '../lib/sandbox-checkout';
import { sandboxAttemptKey } from '../lib/secure-store-key';
import { appendSettledTransaction, parseSettledLedger } from '../lib/settled-ledger';
import { useDemoWallet } from '../lib/use-demo-wallet';
import { brand, radius, space, text } from '../theme/brand';
import { ErrorNotice } from './ErrorNotice';

const defaultBundlerUrl = 'https://api.candide.dev/public/v3/11155111';
const defaultRpcUrl = 'https://ethereum-sepolia-rpc.publicnode.com';
const settledLedgerStorageKey = 'sandbox-settled-transactions';

type SettlementState =
  | 'IDLE'
  | 'PREPARING'
  | 'READY_FOR_AUTHORIZATION'
  | 'AUTHENTICATING'
  | 'SUBMITTING'
  | 'VERIFYING'
  | 'VERIFIED_SANDBOX_RECEIPT'
  | 'DENIED'
  | 'UNKNOWN'
  | 'ERROR';

function truncateHex(value: string | null): string {
  if (!value) return '—';
  return value.length > 16 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function errorCode(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'code' in cause) return String(cause.code);
  return cause instanceof Error ? cause.message : 'SANDBOX_SETTLEMENT_FAILED';
}

function SettlementButton({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

export function SandboxSettlement({
  client,
  hold,
}: {
  client: Clik2TripGraphQlClient;
  hold: BookingHold;
}) {
  const { state: walletState } = useWdkApp();
  const { exists: walletExists, open: openDemoWallet } = useDemoWallet();
  const payer = useAccount({ network: sepolia.network, accountIndex: 0 });
  const merchant = useAccount({ network: sepolia.network, accountIndex: 1 });
  const [state, setState] = useState<SettlementState>('IDLE');
  const [checkout, setCheckout] = useState<WalletCheckout | null>(null);
  const [feeBaseUnits, setFeeBaseUnits] = useState<string | null>(null);
  const [balanceBaseUnits, setBalanceBaseUnits] = useState<string | null>(null);
  const [userOperationHash, setUserOperationHash] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<number | null>(null);
  const [bookingStatus, setBookingStatus] = useState('NUEVA');
  const [error, setError] = useState<string | null>(null);
  const [addressesOpen, setAddressesOpen] = useState(false);

  const busy = ['PREPARING', 'AUTHENTICATING', 'SUBMITTING', 'VERIFYING'].includes(state);
  const attemptStorageKey = sandboxAttemptKey(hold.id);

  async function openWallet() {
    setError(null);
    try {
      await openDemoWallet();
    } catch (cause) {
      setError(errorCode(cause));
      setState('ERROR');
    }
  }

  async function revalidateServerHold(expected: BookingHold) {
    const current = await client.getBookingHold({ code: expected.code });
    if (!current || current.id !== expected.id || current.tourRefId !== expected.tourRefId) {
      throw new Error('HOLD_IDENTITY_MISMATCH');
    }
    if (current.status !== 'NUEVA') throw new Error('HOLD_NOT_ACTIVE');
    if (
      current.participants !== expected.participants ||
      current.priceSnapshot.currency !== expected.priceSnapshot.currency ||
      current.priceSnapshot.total !== expected.priceSnapshot.total ||
      current.holdExpiresAt !== expected.holdExpiresAt
    ) {
      throw new Error('HOLD_SNAPSHOT_MISMATCH');
    }
    if (!current.holdExpiresAt || Date.parse(current.holdExpiresAt) <= Date.now()) {
      throw new Error('CHECKOUT_EXPIRED');
    }
    const availability = await client.getAvailability({
      tourRefId: current.tourRefId,
      from: current.date,
      to: current.date,
    });
    const exactSlot = availability.find((slot) => slot.timeSlot === current.timeSlot);
    if (!exactSlot || exactSlot.isBlocked) throw new Error('SIN_DISPONIBILIDAD');
    setBookingStatus(current.status);
    return current;
  }

  async function prepareCheckout() {
    if (walletState.status !== 'READY' || !payer.address || !merchant.address || !payer.account) {
      setError('WALLET_NOT_READY');
      return;
    }
    setError(null);
    setState('PREPARING');
    try {
      const previousAttempt = await SecureStore.getItemAsync(attemptStorageKey);
      if (previousAttempt) throw new Error('TRANSFER_ALREADY_ATTEMPTED');
      const current = await revalidateServerHold(hold);
      const prepared = await buildSandboxCheckout({
        bookingId: current.id,
        paymentId: `sandbox-${current.id}`,
        total: current.priceSnapshot.total,
        currency: current.priceSnapshot.currency,
        recipient: merchant.address,
        holdExpiresAt: current.holdExpiresAt ?? '',
        nowMs: Date.now(),
      }, expoSha256);
      // The balance is read before the fee is quoted. The paymaster charges the
      // fee in the same test token, so an unfunded account makes the bundler's
      // gas estimation fail with an opaque error that hides the real cause.
      const balances = await payer.getBalance([testUsdtAsset]);
      const balance = balances[0];
      if (!balance?.success || balance.balance === null) {
        throw new Error(balance?.error ?? 'WDK_BALANCE_FAILED');
      }
      setBalanceBaseUnits(balance.balance);
      if (BigInt(balance.balance) < BigInt(prepared.amountBaseUnits)) {
        throw new Error('SALDO_USDT_PRUEBA_INSUFICIENTE');
      }
      const quote = await payer.estimateFee({
        to: prepared.recipient,
        asset: testUsdtAsset,
        amount: prepared.amountBaseUnits,
      });
      if (!quote.success) throw new Error(quote.error ?? 'WDK_FEE_QUOTE_FAILED');
      setFeeBaseUnits(quote.fee);
      // WDK refuses a transfer whose fee exceeds the configured ceiling, and it
      // refuses it at send time. Checking the quote here keeps that refusal
      // deterministic and, above all, keeps it in front of the human
      // authorization instead of behind it.
      if (BigInt(quote.fee) > BigInt(sepolia.maxFeeBaseUnits)) {
        throw new Error('COMISION_EXCEDE_LIMITE');
      }
      if (BigInt(balance.balance) < BigInt(prepared.amountBaseUnits) + BigInt(quote.fee)) {
        throw new Error('SALDO_USDT_PRUEBA_INSUFICIENTE');
      }
      setCheckout(prepared);
      setState('READY_FOR_AUTHORIZATION');
    } catch (cause) {
      setError(errorCode(cause));
      setState('ERROR');
    }
  }

  async function authorizeAndSend() {
    if (!checkout || !payer.address || !payer.account) return;
    setError(null);
    setState('AUTHENTICATING');
    const authentication = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Autorizar USD₮ de prueba',
      promptSubtitle: `${formatBaseUnits(checkout.amountBaseUnits, sepolia.testUsdtDecimals)} USD₮ · Sepolia`,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    if (!authentication.success) {
      setError('HUMAN_AUTHORIZATION_REQUIRED');
      setState('READY_FOR_AUTHORIZATION');
      return;
    }
    const authorizedAt = new Date().toISOString();
    try {
      await revalidateServerHold(hold);
      const intent: TransferIntent = {
        chainId: checkout.chainId,
        tokenContract: checkout.tokenContract,
        recipient: checkout.recipient,
        amountBaseUnits: checkout.amountBaseUnits,
        statementHash: checkout.statementHash,
        humanAuthorizedAt: authorizedAt,
      };
      const policy: DemoPolicy = {
        chainId: sepolia.chainIdString,
        tokenContract: sepolia.testUsdtContract,
        recipient: checkout.recipient,
        maxAmountBaseUnits: '100000000',
        minHoldRemainingMs: 120_000,
        authorizationTtlMs: 60_000,
      };
      const decision = evaluateTransfer(checkout, intent, policy, Date.now());
      if (!decision.allowed) {
        setError(decision.code);
        setState('DENIED');
        return;
      }
      setState('SUBMITTING');
      await SecureStore.setItemAsync(
        attemptStorageKey,
        JSON.stringify({ authorizedAt, statementHash: checkout.statementHash, state: 'SUBMITTING' }),
      );
      const sent = await payer.send({
        to: checkout.recipient,
        asset: testUsdtAsset,
        amount: checkout.amountBaseUnits,
      });
      if (!sent.success || !sent.hash) throw new Error(sent.error ?? 'WDK_SEND_FAILED');
      setUserOperationHash(sent.hash);
      await SecureStore.setItemAsync(
        attemptStorageKey,
        JSON.stringify({ authorizedAt, userOperationHash: sent.hash, state: 'VERIFYING' }),
      );
      setState('VERIFYING');
      const settledLedger = parseSettledLedger(
        await SecureStore.getItemAsync(settledLedgerStorageKey),
      );
      const verification = await verifyUserOperationSettlement({
        checkout,
        expectedSender: payer.address,
        userOperationHash: sent.hash,
        bundlerUrl: process.env.EXPO_PUBLIC_SEPOLIA_BUNDLER_URL ?? defaultBundlerUrl,
        rpcUrl: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? defaultRpcUrl,
        usedTransactionHashes: new Set(settledLedger),
      });
      if (!verification.verified) {
        setConfirmations(verification.confirmations ?? null);
        setError(verification.code);
        setState('DENIED');
        return;
      }
      setTransactionHash(verification.transactionHash);
      setConfirmations(verification.confirmations);
      await SecureStore.setItemAsync(
        settledLedgerStorageKey,
        JSON.stringify(appendSettledTransaction(settledLedger, verification.transactionHash)),
      );
      await SecureStore.setItemAsync(
        attemptStorageKey,
        JSON.stringify({
          transactionHash: verification.transactionHash,
          confirmations: verification.confirmations,
          state: 'VERIFIED_SANDBOX_RECEIPT',
        }),
      );
      setState('VERIFIED_SANDBOX_RECEIPT');
    } catch (cause) {
      setError(errorCode(cause));
      setState('UNKNOWN');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>2. Autorización y recibo sandbox</Text>
      <Text style={styles.warning}>
        Solo USD₮ de prueba en Sepolia. Este sandbox no cambia el pago ni la reserva de Clik2Trip.
      </Text>
      <Text style={styles.status}>Wallet: {walletState.status}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setAddressesOpen((current) => !current)}
      >
        <Text selectable={addressesOpen} style={styles.address}>
          Cuenta pagadora:{' '}
          {payer.address
            ? addressesOpen
              ? payer.address
              : truncateHex(payer.address)
            : 'se deriva al desbloquear'}
        </Text>
        <Text selectable={addressesOpen} style={styles.address}>
          Merchant sandbox:{' '}
          {merchant.address
            ? addressesOpen
              ? merchant.address
              : truncateHex(merchant.address)
            : 'se deriva al desbloquear'}
        </Text>
        <Text style={styles.addressToggle}>
          {addressesOpen ? 'Ocultar direcciones' : 'Ver direcciones completas'}
        </Text>
      </Pressable>
      {['NO_WALLET', 'LOCKED', 'ERROR'].includes(walletState.status) ? (
        <SettlementButton
          label={walletExists ? 'Desbloquear wallet' : 'Crear wallet de prueba'}
          onPress={() => void openWallet()}
        />
      ) : null}
      {walletState.status === 'READY' ? (
        <SettlementButton
          disabled={busy || state === 'VERIFIED_SANDBOX_RECEIPT' || state === 'UNKNOWN'}
          label={state === 'PREPARING' ? 'Revalidando y cotizando…' : 'Preparar resumen final'}
          onPress={() => void prepareCheckout()}
        />
      ) : null}
      {balanceBaseUnits !== null ? (
        <Text style={styles.meta}>
          Saldo de prueba: {formatBaseUnits(balanceBaseUnits, sepolia.testUsdtDecimals)} USD₮
        </Text>
      ) : null}
      {checkout ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Resumen fijo para autorización</Text>
          <Text style={styles.status}>
            Importe: {formatBaseUnits(checkout.amountBaseUnits, sepolia.testUsdtDecimals)} USD₮
          </Text>
          <Text style={styles.meta}>Red: Ethereum Sepolia · chainId {checkout.chainId}</Text>
          <Text style={styles.meta}>Token: {truncateHex(checkout.tokenContract)}</Text>
          <Text style={styles.meta}>Destino: {truncateHex(checkout.recipient)}</Text>
          <Text style={styles.meta}>Booking: {hold.code} · estado {bookingStatus}</Text>
          <Text style={styles.meta}>Vence: {checkout.expiresAt}</Text>
          <Text style={styles.meta}>
            Comisión estimada: {feeBaseUnits === null ? '—' : `${formatBaseUnits(feeBaseUnits, sepolia.testUsdtDecimals)} USD₮`}
          </Text>
          <Text style={styles.meta}>Integridad: {truncateHex(checkout.statementHash)}</Text>
          {state === 'READY_FOR_AUTHORIZATION' ? (
            <SettlementButton label="Autorizar con biometría o PIN" onPress={() => void authorizeAndSend()} />
          ) : null}
        </View>
      ) : null}
      {userOperationHash ? (
        <Text selectable style={styles.address}>UserOperation: {truncateHex(userOperationHash)}</Text>
      ) : null}
      {state === 'SUBMITTING' ? <Text style={styles.status}>Enviando con WDK…</Text> : null}
      {state === 'VERIFYING' ? (
        <Text style={styles.status}>Verificando en un RPC independiente…</Text>
      ) : null}
      {state === 'VERIFIED_SANDBOX_RECEIPT' ? (
        <View style={styles.verified}>
          <Text style={styles.verifiedTitle}>RECIBO SANDBOX VERIFICADO</Text>
          <Text style={styles.status}>{confirmations} confirmaciones</Text>
          <Text selectable style={styles.address}>Tx: {truncateHex(transactionHash)}</Text>
          <Text style={styles.warning}>
            Payment sandbox: VERIFICADO · Booking Clik2Trip: {bookingStatus}. Son estados independientes.
          </Text>
        </View>
      ) : null}
      {state === 'UNKNOWN' ? (
        <Text style={styles.error}>
          Resultado incierto: no se retransmitirá. Concilia el UserOperation antes de intentar otro pago.
        </Text>
      ) : null}
      {error ? <ErrorNotice code={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: brand.bg,
    borderColor: brand.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space[3],
    padding: space[5],
  },
  title: { color: brand.fg, fontSize: text.xl, fontWeight: '700' },
  status: { color: brand.fg, fontSize: text.base, fontWeight: '600' },
  meta: { color: brand.fgMuted, fontSize: text.sm, lineHeight: 20 },
  addressToggle: {
    color: brand.primaryText,
    fontSize: text.xs,
    fontWeight: '700',
    paddingTop: space[1],
  },
  address: {
    color: brand.fgMuted,
    fontFamily: 'monospace',
    fontSize: text.xs,
    lineHeight: 18,
  },
  warning: {
    backgroundColor: brand.warningSoft,
    borderRadius: radius.sm,
    color: brand.warning,
    fontSize: text.sm,
    lineHeight: 20,
    padding: space[3],
  },
  error: {
    backgroundColor: brand.dangerSoft,
    borderRadius: radius.md,
    color: brand.danger,
    padding: space[4],
  },
  button: {
    alignItems: 'center',
    backgroundColor: brand.primary,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  buttonDisabled: { backgroundColor: brand.disabledBg },
  buttonPressed: { backgroundColor: brand.primaryPressed },
  buttonText: {
    color: brand.onPrimary,
    fontSize: text.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonTextDisabled: { color: brand.disabledFg },
  summary: {
    backgroundColor: brand.primarySoft,
    borderColor: brand.primarySofter,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space[2],
    padding: space[4],
  },
  summaryTitle: { color: brand.primaryText, fontSize: text.lg, fontWeight: '700' },
  verified: {
    backgroundColor: brand.successSoft,
    borderRadius: radius.md,
    gap: space[2],
    padding: space[4],
  },
  verifiedTitle: { color: brand.success, fontSize: text.lg, fontWeight: '800' },
});
