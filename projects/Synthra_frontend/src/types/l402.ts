// ─────────────────────────────────────────────────────
// L402 / x402 Protocol Types — Algorand-Flavored
// ─────────────────────────────────────────────────────

/** Status badge for each terminal log line */
export type TerminalLineStatus = 'PENDING' | 'OK' | 'FAIL' | 'INFO' | 'STREAM' | 'INPUT'

/** A single entry rendered in the terminal window */
export interface TerminalLogEntry {
  /** Unique identifier for React keys */
  id: string
  /** Unix timestamp in ms */
  timestamp: number
  /** The log message text */
  message: string
  /** Status badge type */
  status: TerminalLineStatus
  /** If true, this line is part of the AI-generated response */
  isAiResponse?: boolean
  /** Optional prefix override (default: ">") */
  prefix?: string
}

/**
 * The 402 Payment Required challenge from the server.
 * Supports both body-based and header-based (x402) formats.
 */
export interface L402Challenge {
  /** Payment amount in microAlgos (1 ALGO = 1,000,000 microAlgos) */
  amountMicroAlgos: number
  /** Human-readable ALGO amount */
  amountAlgos: number
  /** Algorand address of the AI endpoint creator / payee */
  creatorAddress: string
  /** Server-side invoice or request identifier */
  invoiceId: string
  /** Human-readable description of the payment request */
  message: string
  /** Optional: the network to transact on */
  network?: string
}

/** Execution steps in the L402 flow */
export type L402Step =
  | 'idle'
  | 'requesting'
  | 'payment_required'
  | 'signing'
  | 'broadcasting'
  | 'verifying'
  | 'streaming'
  | 'complete'
  | 'error'

/** State exposed by the useL402Payment hook */
export interface L402PaymentState {
  /** Whether a prompt execution is in progress */
  isProcessing: boolean
  /** Current step in the L402 flow */
  currentStep: L402Step
  /** Transaction ID after successful broadcast */
  txId: string | null
  /** Error message if the flow failed */
  error: string | null
  /** The last challenge received from the server */
  lastChallenge: L402Challenge | null
}

/** Auto-pay allowance state for LogicSig-based delegation */
export interface AllowanceState {
  /** Whether auto-pay is enabled */
  enabled: boolean
  /** Remaining budget in microAlgos */
  remainingMicroAlgos: number
  /** Total budget in microAlgos */
  totalMicroAlgos: number
  /** LogicSig escrow address (null if not yet created) */
  logicSigAddress: string | null
}

/** Shape of the POST body sent to /api/base-models/generate */
export interface GenerateRequest {
  prompt: string
  model: string
}

/** Shape of a successful /api/base-models/generate response */
export interface GenerateResponse {
  /** The AI-generated text */
  result: string
  /** The model used */
  model?: string
  /** Token usage info */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}
