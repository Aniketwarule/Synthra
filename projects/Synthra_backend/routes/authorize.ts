/**
 * @file authorize.ts
 * @purpose Express routes for delegated LogicSig session authorization.
 *
 * Endpoints:
 *   POST /api/authorize       — Store a user's signed delegated LogicSig
 *   GET  /api/authorize/status — Check session expiry for a user address
 *   POST /api/authorize/prepare — Compile TEAL with user-specific params, return program bytes
 *
 * @dependencies algosdk, express, synthra-delegate-builder, lsig-store.interface
 */
import algosdk from 'algosdk';
import { Router, Request, Response } from 'express';
import {
  buildDelegatedLsigProgram,
  calculateExpiryRound,
} from '../services/synthra-delegate-builder';
import {
  InMemoryLsigStore,
  LsigStore,
  StoredLsigRecord,
} from '../repositories/lsig-store.interface';

// ---------------------------------------------------------------------------
// Configuration (lazy — read at request time so dotenv has loaded)
// ---------------------------------------------------------------------------

const getAlgodUrl = () => process.env.ALGOD_URL || 'http://localhost:4001';
const getAlgodToken = () => process.env.ALGOD_TOKEN !== undefined ? process.env.ALGOD_TOKEN : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const getServiceAddress = () => (process.env.SYNTHRA_SERVICE_ADDRESS || process.env.IGNITION_TREASURY_ADDRESS || '').trim();
const DEFAULT_ROUND_WINDOW = 100_000; // ~3.85 days on mainnet

/** Algod client instance — created lazily so env vars are loaded. */
let _algodClient: algosdk.Algodv2 | null = null;
const getAlgodClient = () => {
  if (!_algodClient) {
    _algodClient = new algosdk.Algodv2(getAlgodToken(), getAlgodUrl(), '');
  }
  return _algodClient;
};

/**
 * LsigStore instance. Replace InMemoryLsigStore with a persistent
 * implementation (Supabase, Redis, etc.) for production.
 */
const lsigStore: LsigStore = new InMemoryLsigStore();

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/authorize/prepare
// ---------------------------------------------------------------------------

interface PrepareBody {
  userAddress?: string;
  serviceAddress?: string;
  costMicroAlgo?: number;
  roundWindow?: number;
}

/**
 * Compile the SynthraDelegate TEAL with user-specific template variables.
 * Returns the compiled program bytes so the frontend can have the user sign them.
 */
router.post('/prepare', async (req: Request, res: Response): Promise<void> => {
  const { userAddress, serviceAddress, costMicroAlgo, roundWindow } = req.body as PrepareBody;

  if (!userAddress || !costMicroAlgo) {
    res.status(400).json({ error: 'userAddress and costMicroAlgo are required' });
    return;
  }

  const resolvedServiceAddress = serviceAddress || getServiceAddress();
  if (!resolvedServiceAddress) {
    res.status(500).json({ error: 'Server misconfigured: SYNTHRA_SERVICE_ADDRESS not set and no serviceAddress provided' });
    return;
  }

  if (!algosdk.isValidAddress(userAddress)) {
    res.status(400).json({ error: 'Invalid userAddress' });
    return;
  }

  try {
    const expiryRound = await calculateExpiryRound(
      getAlgodClient(),
      roundWindow ?? DEFAULT_ROUND_WINDOW,
    );

    const compiled = await buildDelegatedLsigProgram(getAlgodClient(), {
      serviceAddress: resolvedServiceAddress,
      ownerAddress: userAddress,
      costMicroAlgo,
      expiryRound,
    });

    res.status(200).json({
      programBase64: compiled.programBase64,
      programHash: compiled.hash,
      expiryRound,
      serviceAddress: resolvedServiceAddress,
      costMicroAlgo,
    });
  } catch (err) {
    console.error('[Authorize] Failed to prepare lsig program:', err);
    res.status(500).json({
      error: 'Failed to compile delegated program',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/authorize
// ---------------------------------------------------------------------------

interface AuthorizeBody {
  userAddress?: string;
  programBase64?: string;
  escrowAddress?: string;
  serviceAddress?: string;
  fundingTxId?: string;
  expiryRound?: number;
  costMicroAlgo?: number;
  fundedAmount?: number;
}

/**
 * Store a user's funded escrow LogicSig session for automatic charging.
 * The frontend compiles the program, funds the escrow address, and sends the details here.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { userAddress, programBase64, escrowAddress, serviceAddress, fundingTxId, expiryRound, costMicroAlgo, fundedAmount } = req.body as AuthorizeBody;

  if (!userAddress || !programBase64 || !escrowAddress || !expiryRound || !costMicroAlgo) {
    res.status(400).json({
      error: 'userAddress, programBase64, escrowAddress, expiryRound, and costMicroAlgo are required',
    });
    return;
  }

  const resolvedServiceAddress = serviceAddress || getServiceAddress();
  if (!resolvedServiceAddress) {
    res.status(500).json({ error: 'Server misconfigured: SYNTHRA_SERVICE_ADDRESS not set and no serviceAddress provided' });
    return;
  }

  if (!algosdk.isValidAddress(userAddress)) {
    res.status(400).json({ error: 'Invalid userAddress' });
    return;
  }

  // Store the lsig
  const record: StoredLsigRecord = {
    programBase64,
    escrowAddress,
    fundingTxId,
    userAddress,
    serviceAddress: resolvedServiceAddress,
    costMicroAlgo,
    expiryRound,
    createdAt: new Date().toISOString(),
  };

  try {
    await lsigStore.set(userAddress, record);
    console.log(`[Authorize] Stored escrow lsig for ${userAddress}, funded with ${fundedAmount}, expires round ${expiryRound}`);

    res.status(200).json({
      ok: true,
      expiryRound,
      message: 'Session authorized. Automatic payments from escrow are now active.',
    });
  } catch (err) {
    console.error('[Authorize] Failed to store lsig:', err);
    res.status(500).json({ error: 'Failed to store authorization.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/authorize/status
// ---------------------------------------------------------------------------

/**
 * Check the authorization status for a user address.
 * Returns session expiry info and whether re-authorization is needed.
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  const userAddress = req.query.address as string | undefined;

  if (!userAddress) {
    res.status(400).json({ error: 'Query parameter "address" is required' });
    return;
  }

  const record = await lsigStore.get(userAddress);

  if (!record) {
    res.status(200).json({
      authorized: false,
      message: 'No active session. User must authorize.',
    });
    return;
  }

  try {
    const status = await getAlgodClient().status().do();
    const currentRound = Number(status.lastRound);
    const isExpired = currentRound > record.expiryRound;
    const roundsRemaining = isExpired ? 0 : record.expiryRound - currentRound;

    res.status(200).json({
      authorized: !isExpired,
      expiryRound: record.expiryRound,
      currentRound,
      roundsRemaining,
      approximateTimeRemaining: roundsToTimeString(roundsRemaining),
      costMicroAlgo: record.costMicroAlgo,
      createdAt: record.createdAt,
    });
  } catch (err) {
    // Can't fetch round, return partial info
    res.status(200).json({
      authorized: true, // assume valid if can't check
      expiryRound: record.expiryRound,
      costMicroAlgo: record.costMicroAlgo,
      createdAt: record.createdAt,
      warning: 'Could not verify current round against expiry.',
    });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a round count to a human-readable time string.
 * Algorand mainnet: ~3.3 seconds per round.
 *
 * @param rounds - Number of rounds
 * @returns Human-readable time string (e.g., "~3 days 4 hours")
 */
function roundsToTimeString(rounds: number): string {
  if (rounds <= 0) return 'expired';

  const totalSeconds = rounds * 3.3;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);

  return `~${parts.join(' ')}` || '< 1 min';
}

export { lsigStore };
export default router;
