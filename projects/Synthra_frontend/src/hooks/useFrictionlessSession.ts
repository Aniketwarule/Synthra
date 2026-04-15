import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import algosdk from 'algosdk'
import { usePeraWallet } from './usePeraWallet'

const MAX_TX_FEE_MICROALGOS = 1_000
const MIN_ACCOUNT_BALANCE_MICROALGOS = 100_000
const DEFAULT_SESSION_BLOCKS = 140
const DEFAULT_BUCKET_FUNDING_MICROALGOS = Number(import.meta.env.VITE_SESSION_BUCKET_MICROALGOS || 3_000_000)

type CompileResponse = {
  result: string
  hash: string
}

type SuggestedParamsWithRoundFlex = algosdk.SuggestedParams & {
  firstValid: number | bigint
  lastValid: number | bigint
}

type AccountInformationResponse = {
  amount?: number | bigint
}

export interface DelegatedSessionState {
  isActive: boolean
  isStarting: boolean
  isPaying: boolean
  signerAddress: string | null
  logicSigAddress: string | null
  treasuryAddress: string | null
  allowedAmountMicroAlgos: number | null
  fundedAmountMicroAlgos: number | null
  remainingBalanceMicroAlgos: number | null
  expirationRound: number | null
  currentRound: number | null
  sessionProgramHash: string | null
  sessionMode: 'escrow-lsig' | 'delegated-lsig' | null
  lastTxId: string | null
  lastRefundTxId: string | null
  error: string | null
}

export interface StartSessionParams {
  receiverAddress: string
  amountMicroAlgos: number
  durationInBlocks?: number
  fundingAmountMicroAlgos?: number
}

export interface StartSessionResult {
  mode: 'escrow-lsig' | 'delegated-lsig'
  logicSigAddress: string
  expirationRound: number
  receiverAddress: string
  amountMicroAlgos: number
  fundedAmountMicroAlgos: number
}

export interface ExecutePromptPaymentResult {
  txId: string
  amountMicroAlgos: number
  expirationRound: number
}

export interface SessionUsabilityResult {
  usable: boolean
  reason?: string
}

type EscrowBucketSession = {
  mode: 'escrow-lsig'
  logicSigAccount: algosdk.LogicSigAccount
  logicSigAddress: string
  expirationRound: number
  receiverAddress: string
  ownerAddress: string
  amountMicroAlgos: number
  fundedAmountMicroAlgos: number
}

const EMPTY_SESSION_STATE: DelegatedSessionState = {
  isActive: false,
  isStarting: false,
  isPaying: false,
  signerAddress: null,
  logicSigAddress: null,
  treasuryAddress: null,
  allowedAmountMicroAlgos: null,
  fundedAmountMicroAlgos: null,
  remainingBalanceMicroAlgos: null,
  expirationRound: null,
  currentRound: null,
  sessionProgramHash: null,
  sessionMode: null,
  lastTxId: null,
  lastRefundTxId: null,
  error: null,
}

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const toRoundNumber = (value: number | bigint | undefined): number => {
  return Number(value ?? 0n)
}

const withAdjustedValidity = (
  suggestedParams: SuggestedParamsWithRoundFlex,
  firstValid: number,
  lastValid: number,
): SuggestedParamsWithRoundFlex => {
  return {
    ...suggestedParams,
    firstValid: typeof suggestedParams.firstValid === 'bigint' ? BigInt(firstValid) : firstValid,
    lastValid: typeof suggestedParams.lastValid === 'bigint' ? BigInt(lastValid) : lastValid,
  }
}

const buildEscrowBucketTeal = (
  ownerAddress: string,
  receiverAddress: string,
  amountMicroAlgos: number,
  expirationRound: number,
): string => {
  return `#pragma version 8

// Path A: exact per-prompt payment from escrow to receiver before expiry.
txn TypeEnum
int pay
==
global GroupSize
int 1
==
&&
txn Receiver
addr ${receiverAddress}
==
&&
txn Amount
int ${amountMicroAlgos}
==
&&
txn LastValid
int ${expirationRound}
<=
&&
txn Fee
int ${MAX_TX_FEE_MICROALGOS}
<=
&&
txn RekeyTo
global ZeroAddress
==
&&
txn CloseRemainderTo
global ZeroAddress
==
&&

// Path B: after expiry, close remaining escrow balance back to signer.
txn TypeEnum
int pay
==
global GroupSize
int 1
==
&&
txn FirstValid
int ${expirationRound}
>
&&
txn Receiver
addr ${ownerAddress}
==
&&
txn Amount
int 0
==
&&
txn CloseRemainderTo
addr ${ownerAddress}
==
&&
txn Fee
int ${MAX_TX_FEE_MICROALGOS}
<=
&&
txn RekeyTo
global ZeroAddress
==
&&
||`
}

const makeLogicSigAccount = (program: Uint8Array): algosdk.LogicSigAccount => {
  return new algosdk.LogicSigAccount(program)
}

export function useFrictionlessSession() {
  const {
    address,
    signTransactions,
    getAlgodClient,
    refreshBalance,
  } = usePeraWallet()

  const [state, setState] = useState<DelegatedSessionState>(EMPTY_SESSION_STATE)

  const activeSessionRef = useRef<EscrowBucketSession | null>(null)
  const refundInFlightRef = useRef(false)

  const clearSession = useCallback((refundTxId: string | null = null, error: string | null = null) => {
    activeSessionRef.current = null
    setState({
      ...EMPTY_SESSION_STATE,
      lastRefundTxId: refundTxId,
      error,
    })
  }, [])

  const getEscrowBalance = useCallback(async (escrowAddress: string): Promise<number> => {
    const algod = getAlgodClient()
    const accountInfo = await algod.accountInformation(escrowAddress).do() as AccountInformationResponse
    return Number(accountInfo.amount ?? 0)
  }, [getAlgodClient])

  const closeExpiredEscrowSession = useCallback(async (session: EscrowBucketSession): Promise<string | null> => {
    if (refundInFlightRef.current) {
      return null
    }

    refundInFlightRef.current = true

    try {
      const algod = getAlgodClient()
      const status = await algod.status().do() as { lastRound?: number | bigint; ['last-round']?: number | bigint }
      const currentRound = toRoundNumber(status.lastRound ?? status['last-round'])
      if (currentRound <= session.expirationRound) {
        return null
      }

      const escrowBalance = await getEscrowBalance(session.logicSigAddress)
      if (escrowBalance <= 0) {
        return null
      }

      const suggestedParams = await algod.getTransactionParams().do() as SuggestedParamsWithRoundFlex
      const firstValid = Math.max(toRoundNumber(suggestedParams.firstValid), session.expirationRound + 1)
      const lastValid = firstValid + 100
      const adjustedParams = withAdjustedValidity(suggestedParams, firstValid, lastValid)

      const closeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: session.logicSigAddress,
        receiver: session.ownerAddress,
        amount: 0,
        closeRemainderTo: session.ownerAddress,
        suggestedParams: adjustedParams,
      })

      const signedClose = algosdk.signLogicSigTransactionObject(closeTxn, session.logicSigAccount)
      const submission = await algod.sendRawTransaction(signedClose.blob).do() as { txId?: string }
      const txId = submission.txId || closeTxn.txID()

      await algosdk.waitForConfirmation(algod, txId, 4)
      await refreshBalance()
      return txId
    } finally {
      refundInFlightRef.current = false
    }
  }, [getAlgodClient, getEscrowBalance, refreshBalance])

  const startSession = useCallback(async ({
    receiverAddress,
    amountMicroAlgos,
    durationInBlocks = DEFAULT_SESSION_BLOCKS,
    fundingAmountMicroAlgos,
  }: StartSessionParams): Promise<StartSessionResult> => {
    if (!address) {
      throw new Error('Connect wallet before starting a payment session')
    }

    if (!algosdk.isValidAddress(receiverAddress)) {
      throw new Error('Invalid payment receiver address')
    }

    if (!Number.isInteger(amountMicroAlgos) || amountMicroAlgos <= 0) {
      throw new Error('amountMicroAlgos must be a positive integer')
    }

    if (!Number.isFinite(durationInBlocks) || durationInBlocks <= 0) {
      throw new Error('durationInBlocks must be a positive number')
    }

    setState((prev) => ({ ...prev, isStarting: true, error: null }))

    try {
      const algod = getAlgodClient()
      const suggestedParams = await algod.getTransactionParams().do() as SuggestedParamsWithRoundFlex
      const currentRound = toRoundNumber(suggestedParams.firstValid)
      const expirationRound = currentRound + Math.floor(durationInBlocks)

      const tealSource = buildEscrowBucketTeal(address, receiverAddress, amountMicroAlgos, expirationRound)
      const compiled = await algod.compile(tealSource).do() as CompileResponse
      const programBytes = fromBase64(compiled.result)

      const logicSigAccount = makeLogicSigAccount(programBytes)
      const logicSigAddress = logicSigAccount.address().toString()

      const minimumFunding =
        amountMicroAlgos +
        MIN_ACCOUNT_BALANCE_MICROALGOS +
        (MAX_TX_FEE_MICROALGOS * 3)

      const requestedFunding = Number.isFinite(fundingAmountMicroAlgos)
        ? Math.floor(Number(fundingAmountMicroAlgos))
        : Math.floor(DEFAULT_BUCKET_FUNDING_MICROALGOS)

      const bucketFundingMicroAlgos = Math.max(requestedFunding, minimumFunding)

      const fundingTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: address,
        receiver: logicSigAddress,
        amount: bucketFundingMicroAlgos,
        suggestedParams,
      })

      const signedFunding = await signTransactions([fundingTxn], [0])
      const fundingBlob = signedFunding[0]

      if (!(fundingBlob instanceof Uint8Array)) {
        throw new Error('Wallet did not sign initial bucket-funding transaction')
      }

      const fundingSubmission = await algod.sendRawTransaction(fundingBlob).do() as { txId?: string }
      const fundingTxId = fundingSubmission.txId || fundingTxn.txID()

      await algosdk.waitForConfirmation(algod, fundingTxId, 4)
      await refreshBalance()

      const remainingBalanceMicroAlgos = await getEscrowBalance(logicSigAddress)

      activeSessionRef.current = {
        mode: 'escrow-lsig',
        logicSigAccount,
        logicSigAddress,
        expirationRound,
        receiverAddress,
        ownerAddress: address,
        amountMicroAlgos,
        fundedAmountMicroAlgos: bucketFundingMicroAlgos,
      }

      setState({
        isActive: true,
        isStarting: false,
        isPaying: false,
        signerAddress: address,
        logicSigAddress,
        treasuryAddress: receiverAddress,
        allowedAmountMicroAlgos: amountMicroAlgos,
        fundedAmountMicroAlgos: bucketFundingMicroAlgos,
        remainingBalanceMicroAlgos,
        expirationRound,
        currentRound,
        sessionProgramHash: compiled.hash,
        sessionMode: 'escrow-lsig',
        lastTxId: fundingTxId,
        lastRefundTxId: null,
        error: null,
      })

      return {
        mode: 'escrow-lsig',
        logicSigAddress,
        expirationRound,
        receiverAddress,
        amountMicroAlgos,
        fundedAmountMicroAlgos: bucketFundingMicroAlgos,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start payment session'
      setState((prev) => ({ ...prev, isStarting: false, error: message, isActive: false }))
      throw error
    }
  }, [address, getAlgodClient, getEscrowBalance, refreshBalance, signTransactions])

  const checkSessionUsable = useCallback(async (
    receiverAddress: string,
    amountMicroAlgos: number,
  ): Promise<SessionUsabilityResult> => {
    const session = activeSessionRef.current

    if (!session) {
      return { usable: false, reason: 'No active payment session' }
    }

    if (!address || session.ownerAddress !== address) {
      return { usable: false, reason: 'Connected wallet does not match session signer' }
    }

    if (session.receiverAddress !== receiverAddress) {
      return { usable: false, reason: 'Session receiver differs from current payment receiver' }
    }

    if (session.amountMicroAlgos !== amountMicroAlgos) {
      return { usable: false, reason: 'Session amount differs from current model price' }
    }

    const algod = getAlgodClient()
    const status = await algod.status().do() as { lastRound?: bigint | number; ['last-round']?: bigint | number }
    const currentRound = toRoundNumber(status.lastRound ?? status['last-round'])

    if (currentRound > session.expirationRound) {
      let refundTxId: string | null = null
      let refundError: string | null = null
      try {
        refundTxId = await closeExpiredEscrowSession(session)
      } catch (error) {
        refundError = error instanceof Error ? error.message : 'Failed to submit automatic close-out'
      }

      clearSession(refundTxId, refundError)
      if (refundError) {
        return { usable: false, reason: refundError }
      }

      if (refundTxId) {
        return { usable: false, reason: `Session expired; remaining funds returned (${refundTxId})` }
      }

      return { usable: false, reason: 'Session expired; remaining funds already cleared' }
    }

    const remainingBalanceMicroAlgos = await getEscrowBalance(session.logicSigAddress)
    const minimumSpendable = amountMicroAlgos + MAX_TX_FEE_MICROALGOS

    if (remainingBalanceMicroAlgos < minimumSpendable) {
      return { usable: false, reason: 'Escrow bucket depleted; start a new session' }
    }

    setState((prev) => ({ ...prev, currentRound, remainingBalanceMicroAlgos }))

    return { usable: true }
  }, [address, clearSession, closeExpiredEscrowSession, getAlgodClient, getEscrowBalance])

  const executePromptPayment = useCallback(async (amountMicroAlgos: number): Promise<ExecutePromptPaymentResult> => {
    const session = activeSessionRef.current
    if (!session) {
      throw new Error('No active payment session. Call startSession() first.')
    }

    if (!address || session.ownerAddress !== address) {
      throw new Error('Connected wallet does not match payment session signer')
    }

    if (session.amountMicroAlgos !== amountMicroAlgos) {
      throw new Error('Session amount mismatch. Start a new session for this price tier.')
    }

    setState((prev) => ({ ...prev, isPaying: true, error: null }))

    try {
      const algod = getAlgodClient()
      const suggestedParams = await algod.getTransactionParams().do() as SuggestedParamsWithRoundFlex

      const txFirstValid = toRoundNumber(suggestedParams.firstValid)
      const txLastValid = Math.min(toRoundNumber(suggestedParams.lastValid), session.expirationRound)

      if (txFirstValid > session.expirationRound || txLastValid < txFirstValid) {
        const refundTxId = await closeExpiredEscrowSession(session)
        clearSession(refundTxId)
        throw new Error('Session expired; start a new payment session')
      }

      const remainingBalanceMicroAlgos = await getEscrowBalance(session.logicSigAddress)
      const minimumSpendable = amountMicroAlgos + MAX_TX_FEE_MICROALGOS
      if (remainingBalanceMicroAlgos < minimumSpendable) {
        throw new Error('Escrow bucket depleted; start a new payment session')
      }

      const adjustedParams = withAdjustedValidity(suggestedParams, txFirstValid, txLastValid)

      const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: session.logicSigAddress,
        receiver: session.receiverAddress,
        amount: amountMicroAlgos,
        suggestedParams: adjustedParams,
      })

      const signed = algosdk.signLogicSigTransactionObject(paymentTxn, session.logicSigAccount)

      const submission = await algod.sendRawTransaction(signed.blob).do() as { txId?: string }
      const txId = submission.txId || paymentTxn.txID()

      await algosdk.waitForConfirmation(algod, txId, 4)
      await refreshBalance()

      const updatedRemainingBalance = await getEscrowBalance(session.logicSigAddress)

      setState((prev) => ({
        ...prev,
        isPaying: false,
        lastTxId: txId,
        currentRound: txFirstValid,
        remainingBalanceMicroAlgos: updatedRemainingBalance,
        error: null,
      }))

      return {
        txId,
        amountMicroAlgos,
        expirationRound: session.expirationRound,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Escrow payment failed'
      setState((prev) => ({ ...prev, isPaying: false, error: message }))
      throw error
    }
  }, [address, clearSession, closeExpiredEscrowSession, getAlgodClient, getEscrowBalance, refreshBalance])

  useEffect(() => {
    if (!state.isActive) {
      return
    }

    const timer = window.setInterval(() => {
      const session = activeSessionRef.current
      if (!session || refundInFlightRef.current) {
        return
      }

      void (async () => {
        try {
          const algod = getAlgodClient()
          const status = await algod.status().do() as { lastRound?: bigint | number; ['last-round']?: bigint | number }
          const currentRound = toRoundNumber(status.lastRound ?? status['last-round'])

          setState((prev) => (prev.isActive ? { ...prev, currentRound } : prev))

          if (currentRound > session.expirationRound) {
            const refundTxId = await closeExpiredEscrowSession(session)
            clearSession(refundTxId)
          }
        } catch {
          // Best-effort background close-out; failures are retried on next interaction.
        }
      })()
    }, 15_000)

    return () => window.clearInterval(timer)
  }, [clearSession, closeExpiredEscrowSession, getAlgodClient, state.isActive])

  const isSessionExpired = useMemo(() => {
    if (!state.isActive || !state.expirationRound || !state.currentRound) return false
    return state.currentRound > state.expirationRound
  }, [state.currentRound, state.expirationRound, state.isActive])

  return {
    state,
    isSessionExpired,
    startSession,
    checkSessionUsable,
    executePromptPayment,
    clearSession,
  }
}
