/**
 * @file lsig-config.ts
 * @purpose Typed configuration constants for the delegated LogicSig system.
 *          All magic numbers are centralized here — no inline constants.
 *
 * @dependencies none
 */

// ---------------------------------------------------------------------------
// Network Configuration
// ---------------------------------------------------------------------------

/** Algorand round timing: ~3.3 seconds per round on mainnet. */
export const SECONDS_PER_ROUND = 3.3;

/** Minimum transaction fee in microALGO. */
export const MIN_FEE_MICROALGO = 1000;

// ---------------------------------------------------------------------------
// Session Configuration
// ---------------------------------------------------------------------------

/**
 * Default round windows by use case.
 *
 * | Use Case       | Rounds  | Approx Duration |
 * |----------------|---------|-----------------|
 * | Chat App       | 100,000 | ~3.85 days      |
 * | Batch API      | 200,000 | ~7.7 days       |
 * | Metered SDK    | 50,000  | ~1.9 days       |
 */
export const ROUND_WINDOWS = {
  CHAT_APP: 100_000,    // ~3.85 days — interactive chat sessions
  BATCH_API: 200_000,   // ~7.7 days  — batch processing, less frequent renewal
  METERED_SDK: 50_000,  // ~1.9 days  — short-lived SDK sessions, higher security
} as const;

/** Default round window for session authorization. */
export const DEFAULT_ROUND_WINDOW = ROUND_WINDOWS.CHAT_APP;

// ---------------------------------------------------------------------------
// Pricing (microALGO per API call)
// ---------------------------------------------------------------------------

/**
 * Per-model pricing in microALGO.
 * Must match the backend's BASE_MODEL_PRICE_MICROALGOS.
 */
export const MODEL_COSTS = {
  'gemini-2.0-flash': 100_000,
  'gemini-1.5-pro': 100_000,
  'gemini-1.5-pro-latest': 100_000,
  'gpt-4o': 500_000,
  'claude-3-opus': 800_000,
} as const;

export type SupportedModel = keyof typeof MODEL_COSTS;

// ---------------------------------------------------------------------------
// Backend API endpoints
// ---------------------------------------------------------------------------

/** Backend base URL — reads from environment or defaults to localhost. */
export const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080';

export const AUTHORIZE_ENDPOINTS = {
  PREPARE: `${API_BASE_URL}/api/authorize/prepare`,
  AUTHORIZE: `${API_BASE_URL}/api/authorize`,
  STATUS: `${API_BASE_URL}/api/authorize/status`,
} as const;

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  EXPIRY_ROUND: 'synthra_lsig_expiry_round',
  SESSION_MODEL: 'synthra_lsig_session_model',
  SESSION_COST: 'synthra_lsig_session_cost',
  USER_ADDRESS: 'synthra_lsig_user_address',
  ESCROW_ADDRESS: 'synthra_lsig_escrow_address',
  FUNDED_AMOUNT: 'synthra_lsig_funded_amount',
} as const;
