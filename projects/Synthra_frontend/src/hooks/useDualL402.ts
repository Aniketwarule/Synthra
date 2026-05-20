import { useCallback, useRef, useState } from 'react'
import algosdk from 'algosdk'
import type { TerminalLogEntry, L402Challenge, L402Step } from '../types/l402'
import type { AIModel } from '../types/models'
import { authorizeSession, loadStoredSession, isSessionExpired, clearStoredSession } from '../services/lsig-auth'
import { usePeraWallet } from './usePeraWallet'
import { DEFAULT_ROUND_WINDOW } from '../config/lsig-config'

const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'

const resolveApiUrl = (configuredUrl: string | undefined, fallbackPath: string): string => {
  const fallbackAbsolute = `${BACKEND_ORIGIN}${fallbackPath}`
  return configuredUrl || fallbackAbsolute
}

const BASE_MODELS_API_URL = resolveApiUrl(
  import.meta.env.VITE_BASE_MODELS_API_URL,
  '/api/base-models/generate',
)

const AGENTS_API_URL = resolveApiUrl(
  import.meta.env.VITE_AGENTS_API_URL || import.meta.env.VITE_API_URL,
  '/api/generate',
)

let _counter = 0

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0

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

export interface DualL402State {
  isProcessing: boolean
  currentStep: L402Step
  txId: string | null
  error: string | null
}

export function useDualL402(selectedModel: AIModel | null) {
  const { address, getAlgodClient, signTransactions } = usePeraWallet()

  const [state, setState] = useState<DualL402State>({
    isProcessing: false,
    currentStep: 'idle',
    txId: null,
    error: null,
  })
  const [logs, setLogs] = useState<TerminalLogEntry[]>([])

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
    async (prompt: string, isAutoRetry = false) => {
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

      if (!isAutoRetry) {
        setState({ isProcessing: true, currentStep: 'requesting', txId: null, error: null })
        push(prompt, 'INPUT', { prefix: '$' })
      }

      const destLabel = selectedModel.destinationType === 'treasury' ? 'Platform Treasury' : selectedModel.creator ?? 'Creator'
      if (!isAutoRetry) {
        push(`Model: ${selectedModel.name} | $${selectedModel.cost} USDC -> ${destLabel}`, 'INFO')
      }

      // --- 1. Check Session ---
      let session = loadStoredSession()
      const algodClient = getAlgodClient()
      
      let needsAuth = false
      if (!session || session.userAddress !== address || session.costMicroAlgo !== selectedModel.costMicroUSDC) {
         needsAuth = true
      } else {
         try {
           const status = await algodClient.status().do() as any
           const currentRound = Number(status.lastRound ?? status['last-round'])
           if (isSessionExpired(session.expiryRound, currentRound)) {
              needsAuth = true
              clearStoredSession()
              push('Previous session expired.', 'INFO')
           }
         } catch {
           // Proceed anyway if we can't check round, backend will reject if expired
         }
      }

      if (needsAuth) {
         const authId = push('Creating escrow LogicSig and funding session (requires 0.3 ALGO: 0.2 ALGO for MBR + 0.1 for fees)...', 'PENDING')
         try {
            const authResult = await authorizeSession({
               userAddress: address,
               algodClient,
               signTransactions,
               costPerCall: selectedModel.costMicroUSDC,
               serviceAddress: selectedModel.destinationAddress,
               roundWindow: DEFAULT_ROUND_WINDOW,
               prefundCalls: 10 // Pre-fund 10 calls for a smooth experience
            })
            patch(authId, { status: 'OK', message: `Funded ${(authResult.fundedAmount / 1_000_000).toFixed(2)} USDC to escrow until round ${authResult.expiryRound}` })
            push(`Session authorized. You will be charged automatically per prompt from escrow.`, 'INFO')
         } catch (error) {
            const message = error instanceof Error ? error.message : 'Authorization failed'
            patch(authId, { status: 'FAIL', message })
            setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: message }))
            return
         }
      }

      // --- 2. Call API with Delegated Header ---
      const reqId = push(`POST ${endpoint} (Delegated Auth) - awaiting...`, 'PENDING')
      
      let res: Response
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 
             'Content-Type': 'application/json',
             'Authorization': `Delegated ${address}`
          },
          body: JSON.stringify(requestBody),
        })
      } catch {
        patch(reqId, { status: 'FAIL', message: `POST ${endpoint} - network error` })
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: 'Network error' }))
        return
      }

      if (!res.ok) {
         if (res.status === 402) {
            clearStoredSession()
            if (!isAutoRetry) {
               patch(reqId, { status: 'INFO', message: `Escrow empty or expired. Automatically requesting top-up...` })
               return executePrompt(prompt, true)
            } else {
               patch(reqId, { status: 'FAIL', message: `Payment failed (Escrow empty or session invalid)` })
               setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: 'Payment required' }))
            }
         } else {
            let errorMsg = res.statusText
            try { const errBody = await res.json(); if (errBody.error) errorMsg = errBody.error } catch {}
            patch(reqId, { status: 'FAIL', message: `HTTP ${res.status}: ${errorMsg}` })
            setState((s) => ({ ...s, isProcessing: false, currentStep: 'error', error: errorMsg }))
         }
         return
      }

      // --- 3. Stream Response ---
      patch(reqId, { status: 'OK', message: 'Payment auto-deducted & verified' })
      setStep('streaming')

      const reader = res.body?.getReader()
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
          const data = await res.json()
          push(data.result || JSON.stringify(data), 'STREAM', { isAiResponse: true })
        } catch {
          push(await res.text(), 'STREAM', { isAiResponse: true })
        }
      }

      push('Generation complete.', 'OK')
      setState((s) => ({ ...s, isProcessing: false, currentStep: 'complete' }))
    },
    [address, getAlgodClient, patch, push, selectedModel, setStep, signTransactions],
  )

  return { state, logs, executePrompt, clearLogs }
}
