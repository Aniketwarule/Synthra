/**
 * @file SynthraDelegate.algo.ts
 * @purpose Delegated LogicSig for pay-per-use AI API automatic payments.
 *
 * The user signs this program once with their wallet, granting the backend
 * a time-bounded delegation to submit payment transactions on their behalf.
 *
 * Template variables (injected at compile time per user session):
 *   - TREASURY_ADDRESS: Operator wallet receiving payments
 *   - OWNER_ADDRESS: User's wallet address (for expiry close-out)
 *   - EXPIRY_ROUND: Round after which the delegation expires
 *   - COST_MICROALGOS: Exact payment amount per API call
 *
 * Two valid transaction paths:
 *   1. Prompt Payment — within expiry window, exact cost to treasury
 *   2. Expiry Close-Out — after expiry, user reclaims remaining funds
 *
 * @dependencies @algorandfoundation/algorand-typescript
 */
import {
  Account,
  Asset,
  assert,
  Global,
  LogicSig,
  TemplateVar,
  TransactionType,
  Txn,
  Uint64,
  logicsig,
  uint64,
} from '@algorandfoundation/algorand-typescript'

@logicsig({ name: 'SynthraDelegate' })
export class SynthraDelegate extends LogicSig {
  /**
   * LogicSig approval program for USDC Escrow.
   */
  public program(): boolean {
    const treasuryAddress = TemplateVar<Account>('TREASURY_ADDRESS')
    const ownerAddress = TemplateVar<Account>('OWNER_ADDRESS')
    const usdcAsset = TemplateVar<Asset>('USDC_ASSET_ID')
    const expiryRound = TemplateVar<uint64>('EXPIRY_ROUND')
    const costUSDC = TemplateVar<uint64>('COST_MICROALGOS') // Kept name for compatibility, but represents USDC micro-units

    // --- Path 1: Prompt Payment (USDC to Treasury) ---
    const isPromptPayment =
      Txn.typeEnum === TransactionType.AssetTransfer &&
      Txn.xferAsset === usdcAsset &&
      Txn.assetReceiver === treasuryAddress &&
      Txn.assetAmount === costUSDC &&
      Txn.lastValid <= expiryRound &&
      Txn.assetCloseTo === Global.zeroAddress

    // --- Path 2: USDC Opt-In (Escrow receives USDC) ---
    // The Escrow account must opt-in to USDC before it can receive it.
    // The frontend groups this with the ALGO funding transaction.
    const isUSDCOptIn =
      Txn.typeEnum === TransactionType.AssetTransfer &&
      Txn.xferAsset === usdcAsset &&
      Txn.assetReceiver === Txn.sender &&
      Txn.assetAmount === Uint64(0) &&
      Txn.assetCloseTo === Global.zeroAddress

    // --- Path 3: USDC Expiry Close-Out (Reclaim USDC) ---
    const isUSDCCloseOut =
      Txn.typeEnum === TransactionType.AssetTransfer &&
      Txn.xferAsset === usdcAsset &&
      Txn.firstValid > expiryRound &&
      Txn.assetReceiver === ownerAddress &&
      Txn.assetAmount === Uint64(0) &&
      Txn.assetCloseTo === ownerAddress

    // --- Path 4: ALGO Expiry Close-Out (Reclaim ALGO) ---
    const isAlgoCloseOut =
      Txn.typeEnum === TransactionType.Payment &&
      Txn.firstValid > expiryRound &&
      Txn.receiver === ownerAddress &&
      Txn.amount === Uint64(0) &&
      Txn.closeRemainderTo === ownerAddress

    // --- Common security constraints ---
    // Prevent fee draining and account takeover
    assert(Txn.fee <= Uint64(2_000), 'Fee too high')
    assert(Txn.rekeyTo === Global.zeroAddress, 'Rekey is not allowed')

    // Restrict group size
    if (isPromptPayment || isUSDCCloseOut || isAlgoCloseOut) {
      assert(Global.groupSize <= Uint64(2), 'Invalid group size for action')
    } else if (isUSDCOptIn) {
      assert(Global.groupSize <= Uint64(3), 'OptIn must be part of a funding group')
    }

    // Must match one of the valid paths
    assert(isPromptPayment || isUSDCOptIn || isUSDCCloseOut || isAlgoCloseOut, 'Transaction does not match session policy')

    return true
  }
}
