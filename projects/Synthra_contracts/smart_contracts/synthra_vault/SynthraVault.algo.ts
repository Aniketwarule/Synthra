/**
 * @file SynthraVault.algo.ts
 * @purpose Stateful contract for deposit-based pay-per-use AI API.
 *
 * Migration from stateless conditional payment gatekeeper to stateful contract.
 * Users opt in, deposit ALGO, and the operator deducts per API call.
 *
 * Global State:
 *   - owner (Address): Contract operator who can call deduct()
 *   - totalCalls (uint64): Cumulative count of deductions across all users
 *
 * Local State (per opted-in user):
 *   - userBalance (uint64): User's deposited balance in microALGO
 *
 * State Schema:
 *   globalInts: 1 (totalCalls)
 *   globalBytes: 1 (owner)
 *   localInts: 1 (userBalance)
 *   localBytes: 0
 *
 * @dependencies @algorandfoundation/algorand-typescript
 */
import {
  Account,
  abimethod,
  assert,
  Contract,
  Global,
  GlobalState,
  gtxn,
  itxn,
  LocalState,
  Txn,
  Uint64,
  uint64,
} from '@algorandfoundation/algorand-typescript'

export class SynthraVault extends Contract {
  // --- Global State ---

  /** Contract operator address. Only this address can call deduct(). */
  owner = GlobalState<Account>({ key: 'owner' })

  /** Cumulative count of all deduction calls across all users. */
  totalCalls = GlobalState<uint64>({ key: 'total_calls' })

  // --- Local State (per opted-in user) ---

  /** User's deposited balance in microALGO. */
  userBalance = LocalState<uint64>({ key: 'user_balance' })

  // --- Lifecycle Methods ---

  /**
   * Initialize the contract. Sets the deployer as the owner.
   * Called once when the application is created.
   */
  public createApplication(): void {
    this.owner.value = Txn.sender
    this.totalCalls.value = Uint64(0)
  }

  /**
   * Opt-in handler. Initializes the user's local balance to zero.
   * The user must call this before depositing.
   */
  @abimethod({ allowActions: ['OptIn'] })
  public optIn(): void {
    this.userBalance(Txn.sender).value = Uint64(0)
  }

  // --- User Methods ---

  /**
   * Deposit ALGO into the vault. The user sends a grouped payment
   * transaction to the contract address, and this method credits
   * their local balance.
   *
   * @param payTxn - The grouped payment transaction funding the deposit
   */
  public deposit(payTxn: gtxn.PaymentTxn): void {
    // Payment must go to the contract's own address
    assert(payTxn.receiver === Global.currentApplicationAddress, 'Payment must be sent to the vault')
    assert(payTxn.sender === Txn.sender, 'Payment sender must match caller')
    assert(payTxn.amount > Uint64(0), 'Deposit amount must be greater than zero')

    // Credit the user's local balance
    this.userBalance(Txn.sender).value =
      this.userBalance(Txn.sender).value + payTxn.amount
  }

  /**
   * Withdraw remaining balance from the vault. Sends the user's full
   * local balance back to them via an inner transaction.
   * Resets their balance to zero.
   */
  public withdraw(): void {
    const balance = this.userBalance(Txn.sender).value
    assert(balance > Uint64(0), 'No balance to withdraw')

    // Send funds back to the user via inner transaction
    itxn
      .payment({
        receiver: Txn.sender,
        amount: balance,
        fee: Uint64(0),
      })
      .submit()

    this.userBalance(Txn.sender).value = Uint64(0)
  }

  // --- Operator Methods ---

  /**
   * Deduct from a user's balance. Only callable by the contract owner.
   * Used by the backend to charge for each API call.
   *
   * @param user - The account to deduct from
   * @param amount - Amount in microALGO to deduct
   */
  public deduct(user: Account, amount: uint64): void {
    assert(Txn.sender === this.owner.value, 'Only the owner can deduct')
    assert(amount > Uint64(0), 'Deduction amount must be greater than zero')

    const currentBalance = this.userBalance(user).value
    assert(currentBalance >= amount, 'Insufficient user balance')

    this.userBalance(user).value = currentBalance - amount
    this.totalCalls.value = this.totalCalls.value + Uint64(1)
  }

  // --- View Methods ---

  /**
   * Get a user's current deposited balance.
   *
   * @param user - The account to query
   * @returns The user's balance in microALGO
   */
  public getBalance(user: Account): uint64 {
    return this.userBalance(user).value
  }
}
