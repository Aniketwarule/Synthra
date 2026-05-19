import algosdk from 'algosdk';
import { NextFunction, Request, Response } from 'express';
import {
  finalizeReservedTxProof,
  reserveTxProof,
  TxProofScope,
} from '../repositories/paymentTxProofs';
import { chargeForPrompt } from '../services/charge.service';
import { lsigStore } from '../routes/authorize';

type IndexerTxn = {
  id?: string;
  group?: string | Uint8Array;
  sender?: string;
  logs?: Array<string | Uint8Array>;
  confirmedRound?: number;
  ['confirmed-round']?: number;
  txType?: string;
  ['tx-type']?: string;
  applicationTransaction?: {
    applicationId?: number;
  };
  ['application-transaction']?: {
    ['application-id']?: number;
  };
  paymentTransaction?: {
    receiver?: string;
    amount?: number;
  };
  ['payment-transaction']?: {
    receiver?: string;
    amount?: number;
  };
};

export type VerifiedIgnitionPayment = {
  txId: string;
  groupId: string;
  payer: string;
  amountMicroAlgos: number;
  confirmedRound: number;
};

export type L402VerifiedRequest = Request & {
  ignitionPayment?: VerifiedIgnitionPayment;
  finalizeIgnitionPayment?: (consumed: boolean) => void;
};

const PAYMENT_PROOF_SCOPE: TxProofScope = 'base_models_generate';

const BASE_MODEL_PRICE_MICROALGOS: Record<string, number> = {
  'gemini-2.0-flash': 100_000,
  'gemini-1.5-pro': 100_000,
  'gemini-1.5-pro-latest': 100_000,
  'gpt-4o': 500_000,
  'claude-3-opus': 800_000,
};

const DEFAULT_INDEXER_URL = 'https://testnet-idx.algonode.cloud';

const getRuntimeConfig = () => {
  const indexerUrl = (process.env.ALGORAND_INDEXER_URL || DEFAULT_INDEXER_URL).trim();
  const gatewayAppId = Number(process.env.IGNITION_GATEWAY_APP_ID || '0');
  const treasuryAddress = (process.env.IGNITION_TREASURY_ADDRESS || '').trim();

  return {
    indexerUrl,
    gatewayAppId,
    treasuryAddress,
  };
};

const getBearerToken = (headerValue?: string): string | null => {
  if (!headerValue) return null;
  if (!headerValue.startsWith('Bearer ')) return null;
  const token = headerValue.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const resolveExpectedAmountMicroAlgos = (model: unknown): number | null => {
  if (typeof model !== 'string') {
    return null;
  }

  return BASE_MODEL_PRICE_MICROALGOS[model] ?? null;
};

const decodeLogEntry = (entry: string | Uint8Array): string => {
  if (entry instanceof Uint8Array) {
    return Buffer.from(entry).toString('utf-8');
  }

  try {
    return Buffer.from(entry, 'base64').toString('utf-8');
  } catch {
    return '';
  }
};

const getConfirmedRound = (txn: IndexerTxn): number => {
  return Number(txn.confirmedRound ?? txn['confirmed-round'] ?? 0);
};

const getTxType = (txn: IndexerTxn): string => {
  return String(txn.txType ?? txn['tx-type'] ?? '');
};

const getApplicationId = (txn: IndexerTxn): number => {
  return Number(txn.applicationTransaction?.applicationId ?? txn['application-transaction']?.['application-id'] ?? 0);
};

const getPaymentReceiver = (txn: IndexerTxn): string => {
  return String(txn.paymentTransaction?.receiver ?? txn['payment-transaction']?.receiver ?? '');
};

const getPaymentAmount = (txn: IndexerTxn): number => {
  return Number(txn.paymentTransaction?.amount ?? txn['payment-transaction']?.amount ?? 0);
};

const normalizeGroupId = (group: IndexerTxn['group']): string => {
  if (!group) return '';
  if (typeof group === 'string') return group;
  return Buffer.from(group).toString('base64');
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(operation: () => Promise<T>, attempts = 6, delayMs = 800): Promise<T> => {
  let lastError: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
};

const respondPaymentRequired = (res: Response, amountMicroAlgos: number, treasuryAddress: string): void => {
  const amountAlgos = amountMicroAlgos / 1_000_000;

  res.status(402).json({
    status: 402,
    amountMicroAlgos,
    amountAlgos,
    requiredAmountAlgo: amountAlgos,
    creatorAddress: treasuryAddress,
    destinationAddress: treasuryAddress,
    message: 'Payment required via Ignition payment flow',
  });
};

const respondUnauthorized = (res: Response, txId: string, reason: string): void => {
  console.warn(`[L402] Reject txId=${txId}: ${reason}`);
  res.status(401).json({ error: reason });
};

// L402 verification middleware.
//
// What this middleware guarantees before your AI route executes:
// 1) A txId exists in Authorization: Bearer <txId>.
// 2) The txId is confirmed on Algorand Testnet.
// 3) The transaction is either:
//    a) an app call to your IgnitionGateway app ID with grouped treasury payment, OR
//    b) a direct treasury payment (delegated LogicSig mode).
// 4) The payment amount is the exact per-model amount to your treasury.
// 5) The txId has not been used before (simple replay / double-spend defense).
export const verifyIgnitionL402Payment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { indexerUrl, gatewayAppId, treasuryAddress } = getRuntimeConfig();
  const indexer = new algosdk.Indexer('', indexerUrl, '');
  const model = (req.body as { model?: unknown } | undefined)?.model;
  const expectedAmountMicroAlgos = resolveExpectedAmountMicroAlgos(model);

  if (expectedAmountMicroAlgos === null) {
    res.status(400).json({
      error: 'Unsupported model for base-model payment flow',
      supportedModels: Object.keys(BASE_MODEL_PRICE_MICROALGOS),
    });
    return;
  }

  // Validate required server-side configuration.
  if (!treasuryAddress) {
    res.status(500).json({
      error: 'Server misconfigured. Set IGNITION_TREASURY_ADDRESS.',
    });
    return;
  }

  // The L402 intercept: missing bearer token means client has not paid yet.
  const authHeader = req.headers.authorization;

  // --- Support Escrow LogicSig (Delegated) Flow ---
  if (authHeader && authHeader.startsWith('Delegated ')) {
    const userAddress = authHeader.split(' ')[1];
    
    const algodClient = new algosdk.Algodv2(
      process.env.ALGOD_TOKEN !== undefined ? process.env.ALGOD_TOKEN : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      process.env.ALGOD_URL || 'http://localhost:4001',
      ''
    );

    const chargeResult = await chargeForPrompt({
      userAddress,
      algodClient,
      lsigStore,
      serviceAddress: treasuryAddress,
      costMicroAlgo: expectedAmountMicroAlgos
    });

    if (!chargeResult.ok) {
      if (chargeResult.reason === 'insufficient_balance' || chargeResult.reason === 'expired') {
        console.warn(`[L402] Escrow LogicSig charge failed (${chargeResult.reason}): ${chargeResult.detail}`);
        respondPaymentRequired(res, expectedAmountMicroAlgos, treasuryAddress);
      } else {
        respondUnauthorized(res, 'DelegatedPayment', `Escrow LogicSig charge failed: ${chargeResult.reason} - ${chargeResult.detail}`);
      }
      return;
    }

    const verifiedRequest = req as L402VerifiedRequest;
    verifiedRequest.ignitionPayment = {
      txId: chargeResult.txId,
      groupId: 'DELEGATED_LSIG',
      payer: userAddress,
      amountMicroAlgos: expectedAmountMicroAlgos,
      confirmedRound: 0 // Approximate, or we can fetch status
    };

    verifiedRequest.finalizeIgnitionPayment = (consumed: boolean) => {
      // For escrow lsig, we actually submitted the transaction and it's confirmed.
      // There's no reserved tx proof to finalize. So we do nothing.
    };

    next();
    return;
  }

  // --- Support Standard L402 Bearer Flow ---
  const txId = getBearerToken(authHeader);
  if (!txId) {
    respondPaymentRequired(res, expectedAmountMicroAlgos, treasuryAddress);
    return;
  }

  let onChainTxn: IndexerTxn;
  let confirmedRound = 0;

  try {
    // Indexer can lag right after confirmation, so allow a short retry window.
    const lookup = await withRetry(
      async () => {
        const result = await indexer.lookupTransactionByID(txId).do();
        const txn = result?.transaction as IndexerTxn | undefined;
        if (!txn) {
          throw new Error('Transaction not indexed yet');
        }
        const round = getConfirmedRound(txn);
        if (round <= 0) {
          throw new Error('Transaction not confirmed in indexer yet');
        }
        return result;
      },
      12,
      1000,
    );
    onChainTxn = lookup.transaction as IndexerTxn;
    confirmedRound = getConfirmedRound(onChainTxn);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Invalid txId or indexer lookup failed';
    if (reason.includes('not confirmed')) {
      respondUnauthorized(res, txId, 'Transaction is not confirmed');
      return;
    }

    respondUnauthorized(res, txId, 'Invalid txId or indexer lookup failed');
    return;
  }

  // 1) Transaction must be confirmed. Failed app calls never become confirmed transactions.
  if (confirmedRound <= 0) {
    respondUnauthorized(res, txId, 'Transaction is not confirmed');
    return;
  }

  const txType = getTxType(onChainTxn);
  let verifiedPayment: VerifiedIgnitionPayment | null = null;

  if (txType === 'appl') {
    if (!gatewayAppId) {
      res.status(500).json({
        error: 'Server misconfigured. Set IGNITION_GATEWAY_APP_ID for app-call verification mode.',
      });
      return;
    }

    const appId = getApplicationId(onChainTxn);
    if (appId !== gatewayAppId) {
      respondUnauthorized(res, txId, 'Application ID mismatch for IgnitionGateway');
      return;
    }

    // Optional but strong signal: your contract logs PAID_BASE_MODEL on successful verification.
    const logs = onChainTxn.logs || [];
    const containsSuccessLog = logs.some((entry) => decodeLogEntry(entry).includes('PAID_BASE_MODEL'));
    if (!containsSuccessLog) {
      console.warn(`[L402] txId=${txId}: Missing expected IgnitionGateway success log (continuing)`);
    }

    // Payment guarantee comes from atomic group inspection.
    const groupId = normalizeGroupId(onChainTxn.group);
    if (!groupId) {
      respondUnauthorized(res, txId, 'Expected grouped transaction but group ID is missing');
      return;
    }

    let groupTxns: IndexerTxn[] = [];
    try {
      const groupLookup = await withRetry(
        async () => {
          const result = await indexer.searchForTransactions().groupid(groupId).do();
          const txns = (result.transactions || []) as IndexerTxn[];
          if (txns.length === 0) {
            throw new Error('Grouped transactions not indexed yet');
          }
          return result;
        },
        6,
        900,
      );
      groupTxns = (groupLookup.transactions || []) as IndexerTxn[];
    } catch {
      respondUnauthorized(res, txId, 'Failed to load grouped transactions for verification');
      return;
    }

    const qualifyingPayment = groupTxns.find((txn) => {
      if (getTxType(txn) !== 'pay') return false;
      if (getConfirmedRound(txn) <= 0) return false;
      const receiver = getPaymentReceiver(txn);
      const amount = getPaymentAmount(txn);
      return receiver === treasuryAddress && amount === expectedAmountMicroAlgos;
    });

    if (!qualifyingPayment) {
      respondUnauthorized(res, txId, `No qualifying treasury payment found for expected amount ${expectedAmountMicroAlgos}`);
      return;
    }

    verifiedPayment = {
      txId,
      groupId,
      payer: qualifyingPayment.sender || 'unknown',
      amountMicroAlgos: getPaymentAmount(qualifyingPayment),
      confirmedRound,
    };
  } else if (txType === 'pay') {
    const receiver = getPaymentReceiver(onChainTxn);
    const amount = getPaymentAmount(onChainTxn);

    if (receiver !== treasuryAddress) {
      respondUnauthorized(res, txId, 'Direct payment receiver does not match treasury');
      return;
    }

    if (amount !== expectedAmountMicroAlgos) {
      respondUnauthorized(res, txId, `Direct payment amount mismatch; expected ${expectedAmountMicroAlgos}`);
      return;
    }

    verifiedPayment = {
      txId,
      groupId: normalizeGroupId(onChainTxn.group) || 'DIRECT_PAYMENT',
      payer: onChainTxn.sender || 'unknown',
      amountMicroAlgos: amount,
      confirmedRound,
    };
  } else {
    respondUnauthorized(res, txId, 'txId must reference either a payment or application call transaction');
    return;
  }

  const reservation = await reserveTxProof(txId, PAYMENT_PROOF_SCOPE);
  if (reservation === 'already_used') {
    res.status(409).json({ error: 'txId already used' });
    return;
  }

  if (reservation === 'in_flight') {
    res.status(409).json({ error: 'txId is currently being processed' });
    return;
  }

  const verifiedRequest = req as L402VerifiedRequest;

  verifiedRequest.ignitionPayment = verifiedPayment;

  verifiedRequest.finalizeIgnitionPayment = (consumed: boolean) => {
    void finalizeReservedTxProof(txId, PAYMENT_PROOF_SCOPE, consumed).catch((error) => {
      console.error(`[L402] Failed to finalize tx proof txId=${txId}:`, error);
    });
  };

  next();
};
