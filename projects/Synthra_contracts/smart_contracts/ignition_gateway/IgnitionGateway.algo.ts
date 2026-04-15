import {
  Account,
  assert,
  Contract,
  GlobalState,
  gtxn,
  log,
  Txn,
  Uint64,
  uint64,
} from '@algorandfoundation/algorand-typescript'

export class IgnitionGateway extends Contract {
  treasuryAddress = GlobalState<Account>({ key: 'treasury_address' })
  geminiPrice = GlobalState<uint64>({ key: 'gemini_price' })
  gptPrice = GlobalState<uint64>({ key: 'gpt_price' })
  claudePrice = GlobalState<uint64>({ key: 'claude_price' })

  public createApplication(): void {
    this.treasuryAddress.value = Txn.sender
    this.geminiPrice.value = Uint64(100_000)
    this.gptPrice.value = Uint64(500_000)
    this.claudePrice.value = Uint64(800_000)
  }

  private assertTreasuryPayment(payTxn: gtxn.PaymentTxn, expectedAmount: uint64): void {
    assert(payTxn.receiver === this.treasuryAddress.value, 'Invalid treasury receiver')
    assert(payTxn.amount === expectedAmount, 'Payment amount mismatch')
  }

  public payForAi(payTxn: gtxn.PaymentTxn): void {
    this.assertTreasuryPayment(payTxn, this.geminiPrice.value)

    log('PAID_BASE_MODEL')
  }

  public payForGemini(payTxn: gtxn.PaymentTxn): void {
    this.assertTreasuryPayment(payTxn, this.geminiPrice.value)

    log('PAID_BASE_MODEL')
  }

  public payForGpt4o(payTxn: gtxn.PaymentTxn): void {
    this.assertTreasuryPayment(payTxn, this.gptPrice.value)

    log('PAID_BASE_MODEL')
  }

  public payForClaudeOpus(payTxn: gtxn.PaymentTxn): void {
    this.assertTreasuryPayment(payTxn, this.claudePrice.value)

    log('PAID_BASE_MODEL')
  }
}
