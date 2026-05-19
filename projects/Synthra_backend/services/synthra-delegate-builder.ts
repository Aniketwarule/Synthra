/**
 * @file synthra-delegate-builder.ts
 * @purpose Compiles the SynthraDelegate LogicSig TEAL with per-session
 *          template variables injected at compile time.
 *
 * The compiled TEAL template uses TMPL_ prefixed placeholders that are
 * substituted with concrete values before compilation via algod.
 *
 * @dependencies algosdk
 */
import algosdk from 'algosdk';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for building a per-session delegated LogicSig program. */
export interface DelegatedLsigParams {
  /** Algorand address of the service/treasury wallet receiving payments. */
  serviceAddress: string;
  /** Algorand address of the user delegating the LogicSig. */
  ownerAddress: string;
  /** Exact payment amount per API call in microALGO. */
  costMicroAlgo: number;
  /** Round number after which the delegation expires. */
  expiryRound: number;
}

/** Result of compiling a TEAL program with template variables. */
export interface CompiledProgram {
  /** Compiled program bytes ready for LogicSigAccount. */
  programBytes: Uint8Array;
  /** Base64-encoded compiled program. */
  programBase64: string;
  /** SHA-256 hash of the compiled program (contract address). */
  hash: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Path to the compiled SynthraDelegate TEAL template.
 * The Puya compiler outputs this with TMPL_ placeholders.
 */
const TEAL_TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../Synthra_contracts/smart_contracts/artifacts/synthra_delegate/SynthraDelegate.teal',
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a delegated LogicSig program with per-session parameters injected.
 *
 * Reads the compiled TEAL template, replaces TMPL_ placeholders with
 * concrete values, and compiles the result via algod.
 *
 * @param algodClient - Algod v2 client for TEAL compilation
 * @param params - Session-specific parameters to inject
 * @returns Compiled program bytes, base64, and hash
 * @throws If the TEAL template file is not found or compilation fails
 */
export async function buildDelegatedLsigProgram(
  algodClient: algosdk.Algodv2,
  params: DelegatedLsigParams,
): Promise<CompiledProgram> {
  // Validate inputs
  if (!algosdk.isValidAddress(params.serviceAddress)) {
    throw new Error(`Invalid service address: ${params.serviceAddress}`);
  }
  if (!algosdk.isValidAddress(params.ownerAddress)) {
    throw new Error(`Invalid owner address: ${params.ownerAddress}`);
  }
  if (params.costMicroAlgo <= 0 || !Number.isInteger(params.costMicroAlgo)) {
    throw new Error(`costMicroAlgo must be a positive integer, got: ${params.costMicroAlgo}`);
  }
  if (params.expiryRound <= 0 || !Number.isInteger(params.expiryRound)) {
    throw new Error(`expiryRound must be a positive integer, got: ${params.expiryRound}`);
  }

  const tealTemplate = loadTealTemplate();
  const tealSource = substituteTealTemplateVars(tealTemplate, params);
  const compiled = await compileTeal(algodClient, tealSource);

  return compiled;
}

/**
 * Calculate the expiry round given a round window from the current round.
 *
 * @param algodClient - Algod v2 client to fetch current round
 * @param roundWindow - Number of rounds until expiry (default: 100,000 ≈ 3.85 days)
 * @returns The expiry round number
 */
export async function calculateExpiryRound(
  algodClient: algosdk.Algodv2,
  roundWindow: number = 100_000,
): Promise<number> {
  const status = await algodClient.status().do();
  const currentRound = Number(status.lastRound);
  return currentRound + roundWindow;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load the TEAL template file from disk.
 *
 * @returns Raw TEAL source with TMPL_ placeholders
 * @throws If the template file does not exist
 */
function loadTealTemplate(): string {
  if (!fs.existsSync(TEAL_TEMPLATE_PATH)) {
    throw new Error(
      `TEAL template not found at ${TEAL_TEMPLATE_PATH}. ` +
        'Run `npm run build` in Synthra_contracts to compile contracts first.',
    );
  }
  return fs.readFileSync(TEAL_TEMPLATE_PATH, 'utf-8');
}

/**
 * Replace TMPL_ placeholders in TEAL source with concrete values.
 *
 * For `bytecblock` entries, addresses must be encoded as raw hex bytes
 * (0x...) because `bytecblock` does not accept `addr` syntax.
 * For `addr` opcode operands, we use the base32 address directly.
 *
 * @param tealSource - TEAL source with TMPL_ placeholders
 * @param params - Values to inject
 * @returns TEAL source with placeholders replaced
 */
function substituteTealTemplateVars(
  tealSource: string,
  params: DelegatedLsigParams,
): string {
  // Decode Algorand addresses to raw 32-byte public keys in hex
  const serviceAddrHex = '0x' + Buffer.from(algosdk.decodeAddress(params.serviceAddress).publicKey).toString('hex');
  const ownerAddrHex = '0x' + Buffer.from(algosdk.decodeAddress(params.ownerAddress).publicKey).toString('hex');

  let result = tealSource;

  // Replace address template vars (bytecblock entries need raw hex)
  result = result.replace(/TMPL_TREASURY_ADDRESS/g, serviceAddrHex);
  result = result.replace(/TMPL_OWNER_ADDRESS/g, ownerAddrHex);

  // Replace integer template vars (intcblock entries)
  result = result.replace(/TMPL_EXPIRY_ROUND/g, String(params.expiryRound));
  result = result.replace(/TMPL_COST_MICROALGOS/g, String(params.costMicroAlgo));

  // Also handle legacy naming from IgnitionDelegate if template was compiled with those
  result = result.replace(/TMPL_EXPIRATION_ROUND/g, String(params.expiryRound));
  result = result.replace(/TMPL_ALLOWED_AMOUNT_MICROALGOS/g, String(params.costMicroAlgo));

  return result;
}

/**
 * Compile TEAL source code via the algod REST API.
 *
 * @param algodClient - Algod v2 client
 * @param tealSource - Complete TEAL source (no TMPL_ placeholders)
 * @returns Compiled program bytes, base64, and hash
 * @throws If algod compilation fails (syntax error, unsupported opcode, etc.)
 */
async function compileTeal(
  algodClient: algosdk.Algodv2,
  tealSource: string,
): Promise<CompiledProgram> {
  const compileResponse = await algodClient.compile(Buffer.from(tealSource)).do();

  const programBase64: string = compileResponse.result;
  const programBytes = new Uint8Array(Buffer.from(programBase64, 'base64'));
  const hash: string = compileResponse.hash;

  return { programBytes, programBase64, hash };
}
