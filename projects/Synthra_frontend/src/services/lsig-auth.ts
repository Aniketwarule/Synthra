/**
 * @file lsig-auth.ts
 * @purpose Frontend authorization flow for delegated LogicSig sessions.
 *
 * Architecture:
 *   The backend compiles a TEAL LogicSig program (a stateless contract account)
 *   that only allows payments to the treasury, up to costMicroAlgo, before expiryRound.
 *   The user funds this escrow with a SINGLE signed payment transaction (works with ALL wallets).
 *   The backend then uses the LogicSig to automatically submit per-prompt payments from the escrow.
 *
 * Flow:
 *   1. POST /api/authorize/prepare → get compiled TEAL + escrow address
 *   2. User signs ONE funding tx (via signTransactions) to the escrow address
 *   3. POST /api/authorize → store session metadata
 *   4. Subsequent prompts: backend auto-deducts from escrow using the LogicSig
 *
 * Why not signData/signBytes?
 *   Pera Wallet's signData is for structured data (EIP-712 style), not raw LogicSig delegation.
 *   signTransactions is universally supported by ALL Algorand wallets.
 */
import algosdk from 'algosdk';
import {
  AUTHORIZE_ENDPOINTS,
  DEFAULT_ROUND_WINDOW,
  SECONDS_PER_ROUND,
  STORAGE_KEYS,
} from '../config/lsig-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthorizationResult {
  expiryRound: number;
  expiryTimeApprox: string;
  escrowAddress: string;
  fundedAmount: number;
}

export interface AuthorizeSessionParams {
  userAddress: string;
  algodClient: algosdk.Algodv2;
  /** signTransactions from useWallet — works with ALL wallets */
  signTransactions: <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[],
  ) => Promise<(Uint8Array | null)[]>;
  costPerCall: number;
  serviceAddress: string;
  roundWindow?: number;
  /** Number of calls to pre-fund (default: 10) */
  prefundCalls?: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Authorize a session by funding the escrow LogicSig address.
 * Triggers exactly ONE wallet popup (a standard payment transaction).
 */
export async function authorizeSession(
  params: AuthorizeSessionParams,
): Promise<AuthorizationResult> {
  const {
    userAddress,
    algodClient,
    signTransactions,
    costPerCall,
    serviceAddress,
    roundWindow = DEFAULT_ROUND_WINDOW,
    prefundCalls = 10,
  } = params;

  // --- Step 1: Request compiled TEAL + escrow address from backend ---
  const prepareResponse = await fetch(AUTHORIZE_ENDPOINTS.PREPARE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress,
      serviceAddress,
      costMicroAlgo: costPerCall,
      roundWindow,
    }),
  });

  if (!prepareResponse.ok) {
    const error = await prepareResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to prepare lsig program: ${(error as { error: string }).error}`);
  }

  const prepareData = (await prepareResponse.json()) as {
    programBase64: string;
    programHash: string;
    expiryRound: number;
    serviceAddress: string;
    costMicroAlgo: number;
  };

  // The escrow address is the hash of the compiled program
  const escrowAddress = prepareData.programHash;

  // --- Step 2: Build and sign a funding transaction group ---
  const usdcAssetId = Number(import.meta.env.VITE_USDC_ASSET_ID || 10458941);
  const usdcFundAmount = costPerCall * prefundCalls;
  // 0.3 ALGO for MBR and fees (buffer for Opt-In fee + 100k MBR + prompt fees)
  const algoFundAmount = 300_000;

  const suggestedParams = await algodClient.getTransactionParams().do();

  // Txn 1: Fund ALGO to escrow
  const algoFundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: userAddress,
    receiver: escrowAddress,
    amount: BigInt(algoFundAmount),
    suggestedParams,
    note: new Uint8Array(Buffer.from(`synthra:session:${prepareData.expiryRound}`)),
  });

  // Txn 2: Escrow opts into USDC
  const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: escrowAddress,
    receiver: escrowAddress,
    amount: BigInt(0),
    assetIndex: usdcAssetId,
    suggestedParams,
  });

  // Txn 3: Fund USDC to escrow
  const usdcFundTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: userAddress,
    receiver: escrowAddress,
    amount: BigInt(usdcFundAmount),
    assetIndex: usdcAssetId,
    suggestedParams,
  });

  const txns = [algoFundTxn, optInTxn, usdcFundTxn];
  const group = algosdk.assignGroupID(txns);

  // Sign via wallet (user signs Txn 0 and Txn 2)
  const signedUserTxns = await signTransactions(group, [0, 2]);
  
  const signedAlgoFund = signedUserTxns[0];
  const signedUsdcFund = signedUserTxns[2] || signedUserTxns[1]; // Depending on if returned array maps to group or indexes

  if (!signedAlgoFund || !signedUsdcFund) {
    throw new Error('Transaction signing was cancelled or returned empty.');
  }

  // Sign Txn 1 manually with the LogicSig
  const programBytes = new Uint8Array(Buffer.from(prepareData.programBase64, 'base64'));
  const lsigAccount = new algosdk.LogicSigAccount(programBytes);
  const signedOptInTxn = algosdk.signLogicSigTransactionObject(group[1], lsigAccount).blob;

  const finalGroup = [signedAlgoFund, signedOptInTxn, signedUsdcFund];

  // Submit the grouped funding transaction
  const submitRes = await algodClient.sendRawTransaction(finalGroup).do() as any;
  const txId = submitRes.txId || submitRes.txid;
  await algosdk.waitForConfirmation(algodClient, txId, 4);

  // --- Step 3: Notify backend about the authorized session ---
  const authorizeResponse = await fetch(AUTHORIZE_ENDPOINTS.AUTHORIZE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress,
      programBase64: prepareData.programBase64,
      escrowAddress,
      serviceAddress,
      fundingTxId: txId,
      expiryRound: prepareData.expiryRound,
      costMicroAlgo: prepareData.costMicroAlgo,
      fundedAmount: usdcFundAmount,
    }),
  });

  if (!authorizeResponse.ok) {
    const error = await authorizeResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to store authorization: ${(error as { error: string }).error}`);
  }

  // --- Step 4: Store session in localStorage ---
  try {
    localStorage.setItem(STORAGE_KEYS.EXPIRY_ROUND, String(prepareData.expiryRound));
    localStorage.setItem(STORAGE_KEYS.SESSION_COST, String(prepareData.costMicroAlgo));
    localStorage.setItem(STORAGE_KEYS.USER_ADDRESS, userAddress);
    localStorage.setItem(STORAGE_KEYS.ESCROW_ADDRESS, escrowAddress);
    localStorage.setItem(STORAGE_KEYS.FUNDED_AMOUNT, String(usdcFundAmount));
  } catch {
    console.warn('[lsig-auth] Could not persist session to localStorage');
  }

  const expiryTimeApprox = roundsToTime(roundWindow);

  return {
    expiryRound: prepareData.expiryRound,
    expiryTimeApprox,
    escrowAddress,
    fundedAmount: usdcFundAmount,
  };
}

export function isSessionExpired(expiryRound: number, currentRound: number): boolean {
  return currentRound > expiryRound;
}

export function roundsToTime(rounds: number): string {
  if (rounds <= 0) return 'expired';

  const totalSeconds = rounds * SECONDS_PER_ROUND;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);

  return parts.length > 0 ? `~${parts.join(' ')}` : '< 1 min';
}

export function loadStoredSession(): {
  expiryRound: number;
  costMicroAlgo: number;
  userAddress: string;
  escrowAddress?: string;
  fundedAmount?: number;
} | null {
  try {
    const expiryStr = localStorage.getItem(STORAGE_KEYS.EXPIRY_ROUND);
    const costStr = localStorage.getItem(STORAGE_KEYS.SESSION_COST);
    const address = localStorage.getItem(STORAGE_KEYS.USER_ADDRESS);

    if (!expiryStr || !costStr || !address) return null;

    return {
      expiryRound: Number(expiryStr),
      costMicroAlgo: Number(costStr),
      userAddress: address,
      escrowAddress: localStorage.getItem(STORAGE_KEYS.ESCROW_ADDRESS) ?? undefined,
      fundedAmount: Number(localStorage.getItem(STORAGE_KEYS.FUNDED_AMOUNT) || 0) || undefined,
    };
  } catch {
    return null;
  }
}

export function clearStoredSession(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // Non-fatal
  }
}
