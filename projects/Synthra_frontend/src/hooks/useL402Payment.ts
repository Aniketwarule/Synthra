import { useState, useCallback, useRef } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import type {
  TerminalLogEntry,
  L402PaymentState,
  L402Challenge,
  L402Step,
} from '../types/l402'

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || '/api/generate'

let logCounter = 0

function createLog(
  message: string,
  status: TerminalLogEntry['status'],
  opts?: Partial<TerminalLogEntry>,
): TerminalLogEntry {
  return {
    id: `log-${Date.now()}-${logCounter++}`,
    timestamp: Date.now(),
    message,
    status,
    ...opts,
  }
}

/**
 * Parse the L402/x402 challenge from a 402 response.
 * Supports:
 *  1. JSON body with challenge fields
 *  2. x402 PAYMENT-REQUIRED header (base64-encoded JSON)
 */
async function parseChallenge(response: Response): Promise<L402Challenge> {
  // Try x402 header first
  const paymentHeader = response.headers.get('payment-required')
  if (paymentHeader) {
    try {
      const decoded = atob(paymentHeader)
      const parsed = JSON.parse(decoded)
      return {
        amountMicroAlgos: parsed.amountMicroAlgos ?? Math.round((parsed.price ?? 0) * 1_000_000),
        amountAlgos: parsed.amountAlgos ?? parsed.price ?? 0,
        creatorAddress: parsed.creatorAddress ?? parsed.payTo ?? '',
        invoiceId: parsed.invoiceId ?? parsed.id ?? '',
        message: parsed.message ?? parsed.description ?? 'Payment required',
        network: parsed.network,
      }
    } catch {
      // Fall through to body parsing
    }
  }

  // Fallback: parse from response body JSON
  const body = await response.json()
  return {
    amountMicroAlgos: body.amountMicroAlgos ?? Math.round((body.amountAlgos ?? body.price ?? 0) * 1_000_000),
    amountAlgos: body.amountAlgos ?? body.price ?? 0,
    creatorAddress: body.creatorAddress ?? body.payTo ?? '',
    invoiceId: body.invoiceId ?? body.id ?? '',
    message: body.message ?? body.description ?? 'Payment required',
    network: body.network,
  }
}

// ─────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────

export function useL402Payment() {
  const { activeAddress, transactionSigner } = useWallet()

  const [state, setState] = useState<L402PaymentState>({
    isProcessing: false,
    currentStep: 'idle',
    txId: null,
    error: null,
    lastChallenge: null,
  })

  const [logs, setLogs] = useState<TerminalLogEntry[]>([])

  // Ref to always have latest logs for appending
  const logsRef = useRef(logs)
  logsRef.current = logs

  const pushLog = useCallback(
    (message: string, status: TerminalLogEntry['status'], opts?: Partial<TerminalLogEntry>) => {
      const entry = createLog(message, status, opts)
      setLogs((prev) => [...prev, entry])
      return entry.id
    },
    [],
  )

  const updateLog = useCallback((id: string, updates: Partial<TerminalLogEntry>) => {
    setLogs((prev) =>
      prev.map((log) => (log.id === id ? { ...log, ...updates } : log)),
    )
  }, [])

  const setStep = useCallback((step: L402Step) => {
    setState((prev) => ({ ...prev, currentStep: step }))
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    setState({
      isProcessing: false,
      currentStep: 'idle',
      txId: null,
      error: null,
      lastChallenge: null,
    })
  }, [])

  // ─── The L402 Execution Loop ───

  const executePrompt = useCallback(
    async (prompt: string) => {
      if (!activeAddress || !transactionSigner) {
        pushLog('ERROR: Wallet not connected. Connect wallet first.', 'FAIL')
        return
      }

      setState((prev) => ({
        ...prev,
        isProcessing: true,
        currentStep: 'requesting',
        error: null,
        txId: null,
      }))

      // Log the user input
      pushLog(prompt, 'INPUT', { prefix: '$' })

      // ─── Step 1: Initial request ───
      const reqLogId = pushLog(`POST ${API_URL} — awaiting response...`, 'PENDING')

      let initialResponse: Response
      try {
        initialResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        })
      } catch (err) {
        updateLog(reqLogId, { status: 'FAIL', message: `POST ${API_URL} — network error` })
        pushLog(`Error: ${err instanceof Error ? err.message : 'Network request failed'}`, 'FAIL')
        setState((prev) => ({ ...prev, isProcessing: false, currentStep: 'error', error: 'Network error' }))
        return
      }

      // ─── Step 2: If NOT 402, handle normally ───
      if (initialResponse.status !== 402) {
        if (initialResponse.ok) {
          updateLog(reqLogId, { status: 'OK', message: `POST ${API_URL} — HTTP ${initialResponse.status}` })
          // Read response
          try {
            const data = await initialResponse.json()
            pushLog(data.result || JSON.stringify(data), 'STREAM', { isAiResponse: true })
          } catch {
            pushLog(await initialResponse.text(), 'STREAM', { isAiResponse: true })
          }
          setState((prev) => ({ ...prev, isProcessing: false, currentStep: 'complete' }))
          return
        } else {
          updateLog(reqLogId, { status: 'FAIL', message: `POST ${API_URL} — HTTP ${initialResponse.status}` })
          pushLog(`Server error: ${initialResponse.statusText}`, 'FAIL')
          setState((prev) => ({ ...prev, isProcessing: false, currentStep: 'error', error: initialResponse.statusText }))
          return
        }
      }

      // ─── Step 3: 402 Payment Required — parse challenge ───
      updateLog(reqLogId, { status: 'OK', message: `POST ${API_URL} — HTTP 402 Payment Required` })
      setStep('payment_required')

      let challenge: L402Challenge
      try {
        challenge = await parseChallenge(initialResponse)
      } catch (err) {
        pushLog('Failed to parse payment challenge from server response.', 'FAIL')
        setState((prev) => ({ ...prev, isProcessing: false, currentStep: 'error', error: 'Bad 402 response' }))
        return
      }

      setState((prev) => ({ ...prev, lastChallenge: challenge }))
      pushLog(`Payment required: ${challenge.amountAlgos} ALGO → ${challenge.creatorAddress.slice(0, 8)}...${challenge.creatorAddress.slice(-4)}`, 'INFO')
      pushLog(`Invoice: ${challenge.invoiceId}`, 'INFO')

      // ─── Step 4: Build & sign the Algorand payment txn ───
      setStep('signing')
      const signLogId = pushLog('Awaiting wallet signature...', 'PENDING')

      try {
        const algodConfig = getAlgodConfigFromViteEnvironment()
        const algodClient = new algosdk.Algodv2(
          algodConfig.token as string,
          algodConfig.server,
          algodConfig.port,
        )

        const suggestedParams = await algodClient.getTransactionParams().do()

        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: activeAddress,
          receiver: challenge.creatorAddress,
          amount: challenge.amountMicroAlgos,
          suggestedParams,
          note: new TextEncoder().encode(`ignition:${challenge.invoiceId}`),
        })

        // Sign via wallet (Pera / Defly / KMD)
        const atc = new algosdk.AtomicTransactionComposer()
        atc.addTransaction({ txn, signer: transactionSigner })

        updateLog(signLogId, { status: 'OK', message: 'Wallet signature received' })

        // ─── Step 5: Broadcast ───
        setStep('broadcasting')
        const broadcastLogId = pushLog('Broadcasting to Algorand...', 'PENDING')

        const result = await atc.execute(algodClient, 4)
        const txId = result.txIDs[0]

        updateLog(broadcastLogId, { status: 'OK', message: 'Transaction confirmed on-chain' })
        pushLog(`TxID: ${txId}`, 'INFO')

        setState((prev) => ({ ...prev, txId }))

        // ─── Step 6: Retry with payment proof ───
        setStep('verifying')
        const retryLogId = pushLog('Retrying with payment proof...', 'PENDING')

        let retryResponse: Response
        try {
          retryResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${txId}`,
            },
            body: JSON.stringify({ prompt }),
          })
        } catch (err) {
          updateLog(retryLogId, { status: 'FAIL', message: 'Retry request failed — network error' })
          pushLog(`${err instanceof Error ? err.message : 'Network error on retry'}`, 'FAIL')
          setState((prev) => ({ ...prev, isProcessing: false, currentStep: 'error', error: 'Retry network error' }))
          return
        }

        if (!retryResponse.ok) {
          updateLog(retryLogId, { status: 'FAIL', message: `Retry failed — HTTP ${retryResponse.status}` })
          const errText = await retryResponse.text()
          pushLog(`Server rejected payment proof: ${errText}`, 'FAIL')
          setState((prev) => ({ ...prev, isProcessing: false, currentStep: 'error', error: 'Payment verification failed' }))
          return
        }

        updateLog(retryLogId, { status: 'OK', message: 'Payment verified — streaming response' })

        // ─── Step 7: Stream the AI response ───
        setStep('streaming')

        const contentType = retryResponse.headers.get('content-type') || ''

        if (contentType.includes('text/event-stream') || retryResponse.body) {
          // Try streaming via ReadableStream
          const reader = retryResponse.body?.getReader()
          const decoder = new TextDecoder()

          if (reader) {
            let fullText = ''
            const streamLogId = pushLog('', 'STREAM', { isAiResponse: true })

            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value, { stream: true })
              fullText += chunk
              updateLog(streamLogId, { message: fullText })
            }

            if (!fullText) {
              updateLog(streamLogId, { message: '[Empty response]', status: 'INFO' })
            }
          }
        } else {
          // Fallback: JSON response
          try {
            const data = await retryResponse.json()
            pushLog(data.result || JSON.stringify(data), 'STREAM', { isAiResponse: true })
          } catch {
            pushLog(await retryResponse.text(), 'STREAM', { isAiResponse: true })
          }
        }

        pushLog('Generation complete.', 'OK')
        setState((prev) => ({ ...prev, isProcessing: false, currentStep: 'complete' }))
      } catch (err) {
        updateLog(signLogId, { status: 'FAIL', message: 'Transaction failed' })
        const errorMsg = err instanceof Error ? err.message : 'Transaction error'
        pushLog(`Error: ${errorMsg}`, 'FAIL')
        setState((prev) => ({ ...prev, isProcessing: false, currentStep: 'error', error: errorMsg }))
      }
    },
    [activeAddress, transactionSigner, pushLog, updateLog, setStep],
  )

  return {
    state,
    logs,
    executePrompt,
    clearLogs,
  }
}
