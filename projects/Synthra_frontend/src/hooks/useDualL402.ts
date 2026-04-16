import { useCallback, useRef, useState } from 'react'
import algosdk from 'algosdk'
import type { TerminalLogEntry, L402Challenge, L402Step } from '../types/l402'
import type { AIModel } from '../types/models'
import { useFrictionlessSession } from './useFrictionlessSession'
import { usePeraWallet } from './usePeraWallet'

const BASE_MODELS_API_URL =
  import.meta.env.VITE_BASE_MODELS_API_URL ||
  'https://synthra-x0z1.onrender.com/api/base-models/generate'

const AGENTS_API_URL =
  import.meta.env.VITE_AGENTS_API_URL ||
  import.meta.env.VITE_API_URL ||
  'https://synthra-x0z1.onrender.com/api/generate'

const DEFAULT_SESSION_BLOCKS = 140

let _counter = 0

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function log(
  message: string,
  status: TerminalLogEntry['status'],
  opts?: Partial<TerminalLogEntry>,
): TerminalLogEntry {
  return {
    id: `log-${Date.now()}-${_counter++}`,
    timestamp: Date.now(),
    message,
    status,
    ...opts,
  }
}

async function parseChallenge(res: Response): Promise<L402Challenge> {
  const header = res.headers.get('payment-required')
  if (header) {
    try {
      const parsed = JSON.parse(atob(header))
      return {
        amountMicroAlgos: parsed.amountMicroAlgos ?? Math.round((parsed.price ?? 0) * 1e6),
        amountAlgos: parsed.amountAlgos ?? parsed.price ?? 0,
        creatorAddress: parsed.creatorAddress ?? parsed.payTo ?? '',
        invoiceId: parsed.invoiceId ?? parsed.id ?? '',
        message: parsed.message ?? 'Payment required',
      }
    } catch {
      // fall through
    }
  }

  const body = await res.json()
  const amountAlgos = Number(body.amountAlgos ?? body.requiredAmountAlgo ?? body.price ?? 0)
  return {
    amountMicroAlgos: body.amountMicroAlgos ?? body.requiredAmountMicroAlgos ?? Math.round(amountAlgos * 1e6),
    amountAlgos,
    creatorAddress: body.creatorAddress ?? body.destinationAddress ?? body.payTo ?? '',
    invoiceId: body.invoiceId ?? body.id ?? '',
    message: body.message ?? 'Payment required',
  }
}

export interface DualL402State {
  isProcessing: boolean
  currentStep: L402Step
  txId: string | null
  error: string | null
}

export function useDualL402(selectedModel: AIModel | null) {
  const { address } = usePeraWallet()
  const { state: sessionState, startSession, checkSessionUsable, executePromptPayment } = useFrictionlessSession()

  const [state, setState] = useState<DualL402State>({
    isProcessing: false,
    currentStep: 'idle',
    txId: null,
    error: null,
  })
  const [logs, setLogs] = useState<TerminalLogEntry[]>([])
  const logsRef = useRef(logs)
  logsRef.current = logs

  const push = useCallback((msg: string, status: TerminalLogEntry['status'], opts?: Partial<TerminalLogEntry>) => {
    const entry = log(msg, status, opts)
    setLogs((prev) => [...prev, entry])
    return entry.id
  }, [])

  const patch = useCallback((id: string, updates: Partial<TerminalLogEntry>) => {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }, [])

  const setStep = useCallback((step: L402Step) => {
    setState((s) => ({ ...s, currentStep: step }))
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    setState({ isProcessing: false, currentStep: 'idle', txId: null, error: null })
  }, [])

  const executePrompt = useCallback(
    async (prompt: string) => {
      if (!address) {
        push('ERROR: Connect a wallet first.', 'FAIL')
        return
      }
      if (!selectedModel) {
        push('ERROR: Select a model first.', 'FAIL')
        return
      }

      const isBaseModel = selectedModel.category === 'base'
      const endpoint = isBaseModel ? BASE_MODELS_API_URL : AGENTS_API_URL
      const requestBody = isBaseModel
        ? { prompt, model: selectedModel.id }
        : { prompt, agentId: selectedModel.id }

      setState({ isProcessing: true, currentStep: 'requesting', txId: null, error: null })

      push(prompt, 'INPUT', { prefix: '$' })

      const modeTag = selectedModel.destinationType === 'treasury' ? 'PREMIUM' : 'CREATOR'
      const destLabel = selectedModel.destinationType === 'treasury' ? 'Platform Treasury' : selectedModel.creator ?? 'Creator'
      push(`[${modeTag}] ${selectedModel.name} | ${selectedModel.cost} ALGO -> ${destLabel}`, 'INFO')

      const reqId = push(`POST ${endpoint} - awaiting...`, 'PENDING')

      let res: Response
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
      } catch {
        patch(reqId, { status: 'FAIL', message: `POST ${endpoint} - network error` })
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: 'Network error' }))
        return
      }

      if (res.status !== 402) {
        if (res.ok) {
          patch(reqId, { status: 'OK', message: `POST - HTTP ${res.status}` })
          try {
            const data = await res.json()
            push(data.result || JSON.stringify(data), 'STREAM', { isAiResponse: true })
          } catch {
            push(await res.text(), 'STREAM', { isAiResponse: true })
          }
          setState((s) => ({ ...s, isProcessing: false, currentStep: 'complete' }))
          return
        }
        patch(reqId, { status: 'FAIL', message: `POST - HTTP ${res.status} ${res.statusText}` })
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: res.statusText }))
        return
      }

      patch(reqId, { status: 'OK', message: 'HTTP 402 - Payment Required' })
      setStep('payment_required')

      let challenge: L402Challenge
      try {
        challenge = await parseChallenge(res)
      } catch {
        push('Failed to parse payment challenge.', 'FAIL')
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: 'Bad 402' }))
        return
      }

      const challengeAmount = Number(challenge.amountMicroAlgos)
      const challengeHasAmount = isPositiveInteger(challengeAmount)
      if (isBaseModel && !challengeHasAmount) {
        const message = 'Invalid payment challenge: missing exact amount for base model.'
        push(message, 'FAIL')
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: message }))
        return
      }

      const amount = isBaseModel
        ? challengeAmount
        : (challengeHasAmount ? challengeAmount : selectedModel.costMicroAlgos)

      if (!isPositiveInteger(amount)) {
        const message = 'Invalid payment amount in challenge.'
        push(message, 'FAIL')
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: message }))
        return
      }

      const amountAlgo = (amount / 1e6).toFixed(2)
      push(`Invoice: ${challenge.invoiceId} | ${amountAlgo} ALGO`, 'INFO')

      const challengeReceiver = (challenge.creatorAddress || '').trim()
      const modelReceiver = (selectedModel.destinationAddress || '').trim()
      if (isBaseModel && !challengeReceiver) {
        const message = 'Invalid payment challenge: missing treasury receiver for base model.'
        push(message, 'FAIL')
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: message }))
        return
      }

      const receiverAddress = isBaseModel ? challengeReceiver : (challengeReceiver || modelReceiver)
      if (!algosdk.isValidAddress(receiverAddress)) {
        const configHint = selectedModel.destinationType === 'treasury'
          ? 'Set VITE_IGNITION_TREASURY_ADDRESS in frontend and IGNITION_TREASURY_ADDRESS in backend. Then restart backend so 402 includes creatorAddress.'
          : 'Selected agent is missing a valid creator wallet address.'

        push(`Invalid payment receiver in challenge. ${configHint}`, 'FAIL')
        setState((s) => ({
          ...s,
          isProcessing: false,
          currentStep: 'error',
          error: `Invalid payee address. ${configHint}`,
        }))
        return
      }

      let sessionUsable = false
      if (sessionState.isActive) {
        try {
          const usability = await checkSessionUsable(receiverAddress, amount)
          sessionUsable = usability.usable
          if (!usability.usable && usability.reason) {
            push(`Session refresh required: ${usability.reason}`, 'INFO')
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Session check failed'
          push(`Session check failed: ${message}`, 'INFO')
        }
      }

      if (!sessionUsable) {
        const startId = push('Starting payment session (one-time wallet approval)...', 'PENDING')
        try {
          const started = await startSession({
            receiverAddress,
            amountMicroAlgos: amount,
            durationInBlocks: DEFAULT_SESSION_BLOCKS,
          })

          const modeLabel = started.mode === 'escrow-lsig'
            ? `Escrow bucket session active (${(started.fundedAmountMicroAlgos / 1_000_000).toFixed(2)} ALGO funded)`
            : 'Delegated LogicSig session active'

          patch(startId, {
            status: 'OK',
            message: `${modeLabel} until round ${started.expirationRound}`,
          })
          push(`Session escrow address: ${started.logicSigAddress}`, 'INFO')
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to start payment session'
          patch(startId, { status: 'FAIL', message })
          setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: message }))
          return
        }
      }

      setStep('broadcasting')
      const payId = push('Sending session payment (no wallet popup)...', 'PENDING')

      let txId = ''
      try {
        const paymentResult = await executePromptPayment(amount)
        txId = paymentResult.txId
        patch(payId, { status: 'OK', message: 'Session payment confirmed on-chain' })
        push(`Payment TxID: ${txId}`, 'INFO')
        setState((s) => ({ ...s, txId }))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Session payment failed'
        patch(payId, { status: 'FAIL', message })
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: message }))
        return
      }

      setStep('verifying')
      const retryId = push('Retrying with payment proof...', 'PENDING')

      let retry: Response | undefined
      let retryReason = ''
      let fetchFailed = false

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          retry = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${txId}`,
            },
            body: JSON.stringify(requestBody),
          })
        } catch {
          fetchFailed = true
          break
        }

        if (retry.ok) {
          break
        }

        let reason = ''
        try {
          const text = await retry.text()
          if (text) {
            try {
              const parsed = JSON.parse(text)
              reason = parsed.error || parsed.message || text
            } catch {
              reason = text
            }
          }
        } catch {
          // ignore parse failures
        }

        retryReason = reason || `HTTP ${retry.status}`

        if (retry.status === 401 && attempt < 5) {
          patch(retryId, {
            status: 'PENDING',
            message: `Retry attempt ${attempt}/5 - waiting for indexer confirmation...`,
          })
          await delay(1400)
          continue
        }

        break
      }

      if (fetchFailed || !retry) {
        patch(retryId, { status: 'FAIL', message: 'Retry failed - network error' })
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: 'Retry failed' }))
        return
      }

      if (!retry.ok) {
        const reason = retryReason || 'Verification failed'
        patch(retryId, { status: 'FAIL', message: `Retry - HTTP ${retry.status}: ${reason}` })
        push(`Backend verification failed: ${reason}`, 'FAIL')
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: reason }))
        return
      }

      patch(retryId, { status: 'OK', message: 'Payment verified - streaming response' })

      setStep('streaming')
      const reader = retry.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let full = ''
        const streamId = push('', 'STREAM', { isAiResponse: true })
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          full += decoder.decode(value, { stream: true })
          patch(streamId, { message: full })
        }
        if (!full) patch(streamId, { message: '[Empty response]', status: 'INFO' })
      } else {
        try {
          const data = await retry.json()
          push(data.result || JSON.stringify(data), 'STREAM', { isAiResponse: true })
        } catch {
          push(await retry.text(), 'STREAM', { isAiResponse: true })
        }
      }

      push('Generation complete.', 'OK')
      setState((s) => ({ ...s, isProcessing: false, currentStep: 'complete' }))
    },
    [address, checkSessionUsable, executePromptPayment, patch, push, selectedModel, sessionState.isActive, setStep, startSession],
  )

  return { state, logs, executePrompt, clearLogs }
}
