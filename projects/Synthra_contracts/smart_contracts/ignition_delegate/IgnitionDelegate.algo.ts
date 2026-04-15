import {
  Account,
  assert,
  Global,
  LogicSig,
  TemplateVar,
  TransactionType,
  Txn,
  logicsig,
  uint64,
} from '@algorandfoundation/algorand-typescript'

@logicsig({ name: 'IgnitionDelegate' })
export class IgnitionDelegate extends LogicSig {
  public program(): boolean {
    const treasuryAddress = TemplateVar<Account>('TREASURY_ADDRESS')
    const expirationRound = TemplateVar<uint64>('EXPIRATION_ROUND')
    const allowedAmountMicroAlgos = TemplateVar<uint64>('ALLOWED_AMOUNT_MICROALGOS')

    assert(Txn.typeEnum === TransactionType.Payment, 'Only payment transactions are allowed')
    assert(Txn.receiver === treasuryAddress, 'Invalid treasury receiver')
    assert(Txn.amount === allowedAmountMicroAlgos, 'Payment amount mismatch')
    assert(Txn.lastValid <= expirationRound, 'Session has expired')

    // Security constraints to prevent transaction mutation attacks.
    assert(Txn.fee <= 1_000, 'Fee too high')
    assert(Txn.rekeyTo === Global.zeroAddress, 'Rekey is not allowed')
    assert(Txn.closeRemainderTo === Global.zeroAddress, 'Close remainder is not allowed')

    return true
  }
}
