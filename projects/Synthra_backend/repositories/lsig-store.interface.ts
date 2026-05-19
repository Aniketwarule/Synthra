/**
 * @file lsig-store.interface.ts
 * @purpose Storage interface for persisting delegated LogicSig accounts.
 *
 * This is an abstraction layer — implement with your preferred backend
 * (Supabase, Redis, in-memory Map, filesystem, etc.).
 *
 * @dependencies algosdk
 */
import algosdk from 'algosdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata stored alongside each delegated LogicSig. */
export interface StoredLsigRecord {
  /** The compiled LogicSig program (base64 string). */
  programBase64: string;
  /** The escrow address (hash of the program). */
  escrowAddress: string;
  /** The user's Algorand address. */
  userAddress: string;
  /** The service/treasury address this lsig pays to. */
  serviceAddress: string;
  /** Exact cost per call in microALGO (baked into the lsig program). */
  costMicroAlgo: number;
  /** Round after which the lsig expires. */
  expiryRound: number;
  /** ISO 8601 timestamp when the lsig was stored. */
  createdAt: string;
  /** Funding txId (optional but good for tracking) */
  fundingTxId?: string;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Storage abstraction for delegated LogicSig accounts.
 *
 * Implementations must handle serialization, concurrent access,
 * and cleanup of expired entries.
 */
export interface LsigStore {
  /**
   * Retrieve a stored LogicSig record for a user address.
   *
   * @param userAddress - Algorand address of the delegating user
   * @returns The stored record, or null if not found / expired
   */
  get(userAddress: string): Promise<StoredLsigRecord | null>;

  /**
   * Store a delegated LogicSig for a user address.
   * Overwrites any existing entry for the same address.
   *
   * @param userAddress - Algorand address of the delegating user
   * @param record - The lsig record to store
   */
  set(userAddress: string, record: StoredLsigRecord): Promise<void>;

  /**
   * Delete a stored LogicSig for a user address.
   *
   * @param userAddress - Algorand address to remove
   * @returns true if an entry was deleted, false if not found
   */
  delete(userAddress: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (for development / testing)
// ---------------------------------------------------------------------------

/**
 * Simple in-memory LsigStore implementation.
 * Suitable for development and testing. NOT for production.
 */
export class InMemoryLsigStore implements LsigStore {
  private store = new Map<string, StoredLsigRecord>();

  async get(userAddress: string): Promise<StoredLsigRecord | null> {
    return this.store.get(userAddress) ?? null;
  }

  async set(userAddress: string, record: StoredLsigRecord): Promise<void> {
    this.store.set(userAddress, record);
  }

  async delete(userAddress: string): Promise<boolean> {
    return this.store.delete(userAddress);
  }
}
