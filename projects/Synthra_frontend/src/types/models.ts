// ─────────────────────────────────────────────────────
// Ignition — Dual-Mode AI Model Definitions
// ─────────────────────────────────────────────────────

/** Payment destination: Platform Treasury or Creator Wallet */
export type ModelDestination = 'treasury' | 'creator'

/** Model category for UI grouping */
export type ModelCategory = 'base' | 'community'

/** A single AI model/agent available on the platform */
export interface AIModel {
  id: string
  name: string
  description: string
  /** Cost in USDC per request (legacy) */
  cost: number
  /** Cost in USDC per 1000 tokens */
  tokenPrice: number
  /** Cost in micro-units of USDC (1 USDC = 1,000,000 microUSDC) */
  costMicroUSDC: number
  /** Where the payment goes */
  destinationType: ModelDestination
  /** Algorand address to receive payment */
  destinationAddress: string
  /** Creator handle (for community agents) */
  creator?: string
  /** Category for UI grouping */
  category: ModelCategory
}

// Platform treasury address
export const TREASURY_ADDRESS =
  import.meta.env.VITE_IGNITION_TREASURY_ADDRESS ||
  import.meta.env.VITE_TREASURY_ADDRESS ||
  ''

// ─── Premium Base Models (Aggregator) ───

export const BASE_MODELS: AIModel[] = [
  {
    cost: 0.005,
    tokenPrice: 0.005, // 0.005 USDC per prompt
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: "Google's fast multimodal model",
    costMicroUSDC: 5_000,
    destinationType: 'treasury',
    destinationAddress: TREASURY_ADDRESS,
    category: 'base',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: "OpenAI's flagship model",
    cost: 0.01,
    tokenPrice: 0.01, // 0.01 USDC per prompt
    costMicroUSDC: 10_000,
    destinationType: 'treasury',
    destinationAddress: TREASURY_ADDRESS,
    category: 'base',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    description: "Anthropic's most capable model",
    cost: 0.02,
    tokenPrice: 0.02, // 0.02 USDC per prompt
    costMicroUSDC: 20_000,
    destinationType: 'treasury',
    destinationAddress: TREASURY_ADDRESS,
    category: 'base',
  },
]

// ─── Community Creator Agents (Marketplace) ───

export const COMMUNITY_AGENTS: AIModel[] = [
  {
    id: 'agent_storyweaver',
    name: 'Story Weaver',
    description: 'Expert creative writer and world builder.',
    cost: 0.002,
    tokenPrice: 0.002,
    costMicroUSDC: 2_000,
    destinationType: 'creator',
    destinationAddress: TREASURY_ADDRESS, // Use treasury address so payments resolve successfully
    creator: '@writer_pro',
    category: 'community',
  },
  {
    id: 'agent_code_ninja',
    name: 'Code Ninja',
    description: 'Advanced Python & Rust developer assistant.',
    cost: 0.005,
    tokenPrice: 0.005,
    costMicroUSDC: 5_000,
    destinationType: 'creator',
    destinationAddress: TREASURY_ADDRESS,
    creator: '@algo_dev',
    category: 'community',
  },
  {
    id: 'agent_defi_analyst',
    name: 'DeFi Analyst',
    description: 'Analyzes charts and tokenomics for Web3 projects.',
    cost: 0.001,
    tokenPrice: 0.001,
    costMicroUSDC: 1_000,
    destinationType: 'creator',
    destinationAddress: TREASURY_ADDRESS,
    creator: '@bullish_bob',
    category: 'community',
  },
  {
    id: 'agent_translator_bot',
    name: 'Polyglot Translator',
    description: 'Real-time contextual translations for 50+ languages.',
    cost: 0.001,
    tokenPrice: 0.001,
    costMicroUSDC: 1_000,
    destinationType: 'creator',
    destinationAddress: TREASURY_ADDRESS,
    creator: '@global_reach',
    category: 'community',
  }
]

export const ALL_MODELS: AIModel[] = [...BASE_MODELS, ...COMMUNITY_AGENTS]
