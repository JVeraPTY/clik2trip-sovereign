import type { WalletCheckout } from '@clik2trip/contracts';

export const transferTopic =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const hexQuantityPattern = /^0x[0-9a-fA-F]+$/;

export const settlementDenialCodes = [
  'CHAIN_MISMATCH',
  'CHECKOUT_EXPIRED',
  'TRANSACTION_FAILED',
  'TOKEN_MISMATCH',
  'SENDER_MISMATCH',
  'RECIPIENT_MISMATCH',
  'AMOUNT_MISMATCH',
  'FINALITY_PENDING',
  'TRANSACTION_ALREADY_USED',
] as const;

export type SettlementDenialCode = (typeof settlementDenialCodes)[number];

export interface TransferLog {
  tokenContract: string;
  sender: string;
  recipient: string;
  amountBaseUnits: string;
}

export interface SettlementObservation {
  chainId: string;
  transactionHash: string;
  succeeded: boolean;
  blockNumber: number;
  latestBlockNumber: number;
  blockTimestampMs: number;
  transfers: readonly TransferLog[];
}

export type SettlementDecision =
  | {
      verified: true;
      transactionHash: string;
      confirmations: number;
      transfer: TransferLog;
    }
  | { verified: false; code: SettlementDenialCode; confirmations?: number };

interface RpcEnvelope {
  result?: unknown;
  error?: { code?: number; message?: string };
}

interface RawLog {
  address: string;
  topics: string[];
  data: string;
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function assertHttpsEndpoint(endpoint: string): string {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('SETTLEMENT_RPC_URL_INVALID');
  }
  if (url.protocol !== 'https:') throw new Error('SETTLEMENT_RPC_HTTPS_REQUIRED');
  return url.toString();
}

function hexQuantityToBigInt(value: string, code: string): bigint {
  if (!hexQuantityPattern.test(value)) throw new Error(code);
  return BigInt(value);
}

function hexQuantityToSafeNumber(value: string, code: string): number {
  const parsed = hexQuantityToBigInt(value, code);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(code);
  return Number(parsed);
}

function topicToAddress(topic: string): string | null {
  if (!hashPattern.test(topic)) return null;
  const address = `0x${topic.slice(-40)}`;
  return addressPattern.test(address) ? address : null;
}

export function decodeTransferLog(log: RawLog): TransferLog {
  if (!addressPattern.test(log.address)) throw new Error('SETTLEMENT_LOG_TOKEN_INVALID');
  if (log.topics.length !== 3 || !sameHex(log.topics[0] ?? '', transferTopic)) {
    throw new Error('SETTLEMENT_LOG_NOT_ERC20_TRANSFER');
  }
  const sender = topicToAddress(log.topics[1] ?? '');
  const recipient = topicToAddress(log.topics[2] ?? '');
  if (!sender || !recipient) throw new Error('SETTLEMENT_LOG_ADDRESS_INVALID');
  return {
    tokenContract: log.address,
    sender,
    recipient,
    amountBaseUnits: hexQuantityToBigInt(log.data, 'SETTLEMENT_LOG_AMOUNT_INVALID').toString(),
  };
}

async function rpcRequest(
  endpoint: string,
  method: string,
  params: unknown[],
  fetchImplementation: typeof fetch,
): Promise<unknown> {
  const response = await fetchImplementation(assertHttpsEndpoint(endpoint), {
    method: 'POST',
    redirect: 'error',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`SETTLEMENT_RPC_HTTP_${response.status}`);
  const envelope = (await response.json()) as RpcEnvelope;
  if (envelope.error) throw new Error(envelope.error.message ?? 'SETTLEMENT_RPC_ERROR');
  if (!Object.prototype.hasOwnProperty.call(envelope, 'result')) {
    throw new Error('SETTLEMENT_RPC_RESULT_MISSING');
  }
  return envelope.result;
}

export async function resolveUserOperationTransactionHash(
  bundlerUrl: string,
  userOperationHash: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<string | null> {
  if (!hashPattern.test(userOperationHash)) throw new Error('USER_OPERATION_HASH_INVALID');
  const result = await rpcRequest(
    bundlerUrl,
    'eth_getUserOperationReceipt',
    [userOperationHash],
    fetchImplementation,
  );
  if (result === null) return null;
  if (!result || typeof result !== 'object' || !('receipt' in result)) {
    throw new Error('USER_OPERATION_RECEIPT_INVALID');
  }
  const receipt = (result as { receipt: unknown }).receipt;
  if (!receipt || typeof receipt !== 'object' || !('transactionHash' in receipt)) {
    throw new Error('USER_OPERATION_RECEIPT_INVALID');
  }
  const transactionHash = (receipt as { transactionHash: unknown }).transactionHash;
  if (typeof transactionHash !== 'string' || !hashPattern.test(transactionHash)) {
    throw new Error('TRANSACTION_HASH_INVALID');
  }
  return transactionHash;
}

export async function readSettlementObservation(
  rpcUrl: string,
  transactionHash: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<SettlementObservation | null> {
  if (!hashPattern.test(transactionHash)) throw new Error('TRANSACTION_HASH_INVALID');
  const [chainIdRaw, receiptRaw, latestBlockRaw] = await Promise.all([
    rpcRequest(rpcUrl, 'eth_chainId', [], fetchImplementation),
    rpcRequest(rpcUrl, 'eth_getTransactionReceipt', [transactionHash], fetchImplementation),
    rpcRequest(rpcUrl, 'eth_blockNumber', [], fetchImplementation),
  ]);
  if (receiptRaw === null) return null;
  if (typeof chainIdRaw !== 'string' || !hexQuantityPattern.test(chainIdRaw)) {
    throw new Error('SETTLEMENT_CHAIN_ID_INVALID');
  }
  if (!receiptRaw || typeof receiptRaw !== 'object') throw new Error('SETTLEMENT_RECEIPT_INVALID');
  const receipt = receiptRaw as Record<string, unknown>;
  const receiptHash = receipt.transactionHash;
  const blockNumberRaw = receipt.blockNumber;
  const statusRaw = receipt.status;
  const logsRaw = receipt.logs;
  if (typeof receiptHash !== 'string' || !hashPattern.test(receiptHash)) {
    throw new Error('SETTLEMENT_RECEIPT_INVALID');
  }
  if (typeof blockNumberRaw !== 'string' || typeof statusRaw !== 'string' || !Array.isArray(logsRaw)) {
    throw new Error('SETTLEMENT_RECEIPT_INVALID');
  }
  if (typeof latestBlockRaw !== 'string') throw new Error('SETTLEMENT_LATEST_BLOCK_INVALID');
  const blockRaw = await rpcRequest(
    rpcUrl,
    'eth_getBlockByNumber',
    [blockNumberRaw, false],
    fetchImplementation,
  );
  if (!blockRaw || typeof blockRaw !== 'object' || !('timestamp' in blockRaw)) {
    throw new Error('SETTLEMENT_BLOCK_INVALID');
  }
  const timestampRaw = (blockRaw as { timestamp: unknown }).timestamp;
  if (typeof timestampRaw !== 'string') throw new Error('SETTLEMENT_BLOCK_INVALID');
  const transfers = logsRaw.flatMap((value): TransferLog[] => {
    if (!value || typeof value !== 'object') return [];
    const raw = value as Record<string, unknown>;
    if (
      typeof raw.address !== 'string' ||
      typeof raw.data !== 'string' ||
      !Array.isArray(raw.topics) ||
      raw.topics.some((topic) => typeof topic !== 'string')
    ) {
      return [];
    }
    try {
      return [
        decodeTransferLog({
          address: raw.address,
          data: raw.data,
          topics: raw.topics as string[],
        }),
      ];
    } catch {
      return [];
    }
  });
  return {
    chainId: hexQuantityToBigInt(chainIdRaw, 'SETTLEMENT_CHAIN_ID_INVALID').toString(),
    transactionHash: receiptHash,
    succeeded: hexQuantityToBigInt(statusRaw, 'SETTLEMENT_STATUS_INVALID') === 1n,
    blockNumber: hexQuantityToSafeNumber(blockNumberRaw, 'SETTLEMENT_BLOCK_NUMBER_INVALID'),
    latestBlockNumber: hexQuantityToSafeNumber(
      latestBlockRaw,
      'SETTLEMENT_LATEST_BLOCK_INVALID',
    ),
    blockTimestampMs:
      hexQuantityToSafeNumber(timestampRaw, 'SETTLEMENT_BLOCK_TIMESTAMP_INVALID') * 1000,
    transfers,
  };
}

export function verifySettlement(
  checkout: WalletCheckout,
  expectedSender: string,
  observation: SettlementObservation,
  usedTransactionHashes: ReadonlySet<string> = new Set(),
  requiredConfirmations = 2,
): SettlementDecision {
  if (!addressPattern.test(expectedSender)) return { verified: false, code: 'SENDER_MISMATCH' };
  if (observation.chainId !== checkout.chainId) return { verified: false, code: 'CHAIN_MISMATCH' };
  if (
    observation.blockTimestampMs > Date.parse(checkout.expiresAt) ||
    observation.blockTimestampMs > Date.parse(checkout.holdExpiresAt)
  ) {
    return { verified: false, code: 'CHECKOUT_EXPIRED' };
  }
  if (!observation.succeeded) return { verified: false, code: 'TRANSACTION_FAILED' };
  if ([...usedTransactionHashes].some((hash) => sameHex(hash, observation.transactionHash))) {
    return { verified: false, code: 'TRANSACTION_ALREADY_USED' };
  }
  const confirmations = Math.max(0, observation.latestBlockNumber - observation.blockNumber + 1);
  if (confirmations < requiredConfirmations) {
    return { verified: false, code: 'FINALITY_PENDING', confirmations };
  }
  const tokenTransfers = observation.transfers.filter((transfer) =>
    sameHex(transfer.tokenContract, checkout.tokenContract),
  );
  if (tokenTransfers.length === 0) return { verified: false, code: 'TOKEN_MISMATCH' };
  const senderTransfers = tokenTransfers.filter((transfer) =>
    sameHex(transfer.sender, expectedSender),
  );
  if (senderTransfers.length === 0) return { verified: false, code: 'SENDER_MISMATCH' };
  const recipientTransfers = senderTransfers.filter((transfer) =>
    sameHex(transfer.recipient, checkout.recipient),
  );
  if (recipientTransfers.length === 0) return { verified: false, code: 'RECIPIENT_MISMATCH' };
  const matching = recipientTransfers.find(
    (transfer) => transfer.amountBaseUnits === checkout.amountBaseUnits,
  );
  if (!matching) return { verified: false, code: 'AMOUNT_MISMATCH' };
  return {
    verified: true,
    transactionHash: observation.transactionHash,
    confirmations,
    transfer: matching,
  };
}

export interface VerifyUserOperationInput {
  checkout: WalletCheckout;
  expectedSender: string;
  userOperationHash: string;
  bundlerUrl: string;
  rpcUrl: string;
  usedTransactionHashes?: ReadonlySet<string>;
  requiredConfirmations?: number;
  attempts?: number;
  intervalMs?: number;
  fetchImplementation?: typeof fetch;
}

export async function verifyUserOperationSettlement(
  input: VerifyUserOperationInput,
): Promise<SettlementDecision> {
  const attempts = input.attempts ?? 60;
  const intervalMs = input.intervalMs ?? 2_500;
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 120) {
    throw new Error('SETTLEMENT_ATTEMPTS_INVALID');
  }
  if (!Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 10_000) {
    throw new Error('SETTLEMENT_INTERVAL_INVALID');
  }
  const fetchImplementation = input.fetchImplementation ?? fetch;
  let transactionHash: string | null = null;
  let lastPending: SettlementDecision | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    transactionHash ??= await resolveUserOperationTransactionHash(
      input.bundlerUrl,
      input.userOperationHash,
      fetchImplementation,
    );
    if (transactionHash) {
      const observation = await readSettlementObservation(
        input.rpcUrl,
        transactionHash,
        fetchImplementation,
      );
      if (observation) {
        const decision = verifySettlement(
          input.checkout,
          input.expectedSender,
          observation,
          input.usedTransactionHashes,
          input.requiredConfirmations,
        );
        if (decision.verified || decision.code !== 'FINALITY_PENDING') return decision;
        lastPending = decision;
      }
    }
    if (attempt + 1 < attempts && intervalMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  if (lastPending) return lastPending;
  throw new Error('SETTLEMENT_VERIFICATION_TIMEOUT');
}
