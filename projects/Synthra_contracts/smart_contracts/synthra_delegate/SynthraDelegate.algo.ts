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
   * LogicSig approval program.
   *
   * Evaluates whether the current transaction satisfies one of two
   * valid paths: a prompt payment or an expiry close-out.
   *
   * @returns true if the transaction is approved
   */
  public program(): boolean {
    const treasuryAddress = TemplateVar<Account>('TREASURY_ADDRESS')
    const ownerAddress = TemplateVar<Account>('OWNER_ADDRESS')
    const expiryRound = TemplateVar<uint64>('EXPIRY_ROUND')
    const costMicroAlgos = TemplateVar<uint64>('COST_MICROALGOS')

    // --- Path 1: Prompt Payment (within expiry window) ---
    const isPromptPayment =
      Txn.receiver === treasuryAddress &&
      Txn.amount === costMicroAlgos &&
      Txn.lastValid <= expiryRound &&
      Txn.closeRemainderTo === Global.zeroAddress

    // --- Path 2: Expiry Close-Out (after expiry, reclaim funds) ---
    const isExpiryCloseOut =
      Txn.firstValid > expiryRound &&
      Txn.receiver === ownerAddress &&
      Txn.amount === Uint64(0) &&
      Txn.closeRemainderTo === ownerAddress

    // --- Common security constraints ---
    assert(Txn.typeEnum === TransactionType.Payment, 'Only payment transactions are allowed')
    assert(Global.groupSize === Uint64(1), 'Grouped transactions are not allowed')

    // Prevent fee draining and account takeover
    assert(Txn.fee <= Uint64(1_000), 'Fee too high')
    assert(Txn.rekeyTo === Global.zeroAddress, 'Rekey is not allowed')

    // Must match one of the two valid paths
    assert(isPromptPayment || isExpiryCloseOut, 'Transaction does not match session policy')

    return true
  }
}
