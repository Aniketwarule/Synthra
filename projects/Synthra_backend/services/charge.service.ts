/**
 * @file charge.service.ts
 * @purpose Backend service that charges users for AI API calls using
 *          their delegated LogicSig. No wallet popup required — the
 *          lsig was pre-signed during the authorization step.
 *
 * Flow:
 *   1. Load the stored lsig for the user address
 *   2. Validate expiry round against current network round
 *   3. Build a PaymentTxn with exact amount, flatFee = 1000
 *   4. Sign with the delegated lsig (LogicSigTransaction)
 *   5. Submit via algod and wait for confirmation
 *
 * @dependencies algosdk, lsig-store.interface
 */
import algosdk from 'algosdk';
import { LsigStore } from '../repositories/lsig-store.interface';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Discriminated union for charge operation results. */
export type ChargeResult =
  | { ok: true; txId: string }
  | { ok: false; reason: 'expired' | 'insufficient_balance' | 'rejected' | 'network_error'; detail?: string };

/** Parameters for the chargeForPrompt function. */
export interface ChargeParams {
  /** Algorand address of the user to charge. */
  userAddress: string;
  /** Algod v2 client for building and submitting transactions. */
  algodClient: algosdk.Algodv2;
  /** Storage backend for retrieving the user's delegated lsig. */
  lsigStore: LsigStore;
  /** Algorand address of the service/treasury wallet receiving payment. */
  serviceAddress: string;
  /** Exact payment amount in microALGO. Must match the lsig's baked-in cost. */
  costMicroAlgo: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum transaction fee on Algorand (microALGO). */
const MIN_FEE = 1000;

/** Number of rounds to wait for transaction confirmation. */
const CONFIRMATION_ROUNDS = 4;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Charge a user for an AI prompt call using their delegated LogicSig.
 *
 * The lsig was pre-signed by the user during the authorization flow.
 * This function builds a payment transaction that satisfies the lsig's
 * constraints and submits it to the network.
 *
 * @param params - Charge parameters including user address, algod client, etc.
 * @returns ChargeResult — either { ok: true, txId } or { ok: false, reason }
 */
export async function chargeForPrompt(params: ChargeParams): Promise<ChargeResult> {
  const { userAddress, algodClient, lsigStore, serviceAddress, costMicroAlgo } = params;

  // --- Step 1: Load the stored lsig ---
  let lsigRecord;
  try {
    lsigRecord = await lsigStore.get(userAddress);
  } catch (err) {
    return {
      ok: false,
      reason: 'network_error',
      detail: `Failed to load lsig from store: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!lsigRecord) {
    return {
      ok: false,
      reason: 'expired',
      detail: 'No active session found for this address. User must re-authorize.',
    };
  }

  // --- Step 2: Validate expiry round ---
  let currentRound: number;
  try {
    const status = await algodClient.status().do();
    currentRound = Number(status.lastRound);
  } catch (err) {
    return {
      ok: false,
      reason: 'network_error',
      detail: `Failed to fetch network status: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (currentRound > lsigRecord.expiryRound) {
    // Clean up expired lsig
    await lsigStore.delete(userAddress).catch(() => {});
    return {
      ok: false,
      reason: 'expired',
      detail: `Session expired at round ${lsigRecord.expiryRound}, current round is ${currentRound}.`,
    };
  }

  // --- Step 3: Reconstruct the LogicSigAccount ---
  let lsigAccount: algosdk.LogicSigAccount;
  try {
    const programBytes = new Uint8Array(Buffer.from(lsigRecord.programBase64, 'base64'));
    lsigAccount = new algosdk.LogicSigAccount(programBytes);
  } catch (err) {
    return {
      ok: false,
      reason: 'rejected',
      detail: `Failed to reconstruct LogicSig: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // --- Step 4: Build the payment transaction from the escrow account ---
  let suggestedParams: algosdk.SuggestedParams;
  try {
    suggestedParams = await algodClient.getTransactionParams().do();
  } catch (err) {
    return {
      ok: false,
      reason: 'network_error',
      detail: `Failed to get transaction params: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Override fee to flat 1000 microALGO (lsig enforces fee <= 1000)
  suggestedParams.fee = MIN_FEE;
  suggestedParams.flatFee = true;

  // Ensure lastValid is within the lsig's expiry window
  if (suggestedParams.lastValid > lsigRecord.expiryRound) {
    suggestedParams.lastValid = lsigRecord.expiryRound;
  }

  const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: lsigRecord.escrowAddress,
    receiver: serviceAddress,
    amount: BigInt(costMicroAlgo),
    suggestedParams,
    closeRemainderTo: undefined, // ZeroAddress — no close-out
    rekeyTo: undefined,         // ZeroAddress — no rekey
  });

  // --- Step 5: Sign with the escrow lsig ---
  let signedTxnBytes: Uint8Array;
  try {
    const signedTxn = algosdk.signLogicSigTransactionObject(paymentTxn, lsigAccount);
    signedTxnBytes = signedTxn.blob;
  } catch (err) {
    return {
      ok: false,
      reason: 'rejected',
      detail: `LogicSig signing failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // --- Step 6: Submit and wait for confirmation ---
  try {
    const { txid } = await algodClient.sendRawTransaction(signedTxnBytes).do();
    await algosdk.waitForConfirmation(algodClient, txid, CONFIRMATION_ROUNDS);

    return { ok: true, txId: txid };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Detect common failure reasons
    if (message.includes('overspend') || message.includes('balance')) {
      return { ok: false, reason: 'insufficient_balance', detail: message };
    }
    if (message.includes('rejected') || message.includes('logic eval')) {
      return { ok: false, reason: 'rejected', detail: message };
    }

    return { ok: false, reason: 'network_error', detail: message };
  }
}
