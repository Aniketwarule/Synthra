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
  /** Exact payment amount per API call in micro-units (USDC). */
  costMicroAlgo: number;
  /** Round number after which the delegation expires. */
  expiryRound: number;
  /** The USDC Asset ID */
  usdcAssetId: number;
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
  return `#pragma version 11
#pragma typetrack false

// smart_contracts/synthra_delegate/SynthraDelegate.algo.ts::program() -> uint64:
main:
    intcblock 1 0 4 TMPL_USDC_ASSET_ID TMPL_EXPIRY_ROUND TMPL_COST_MICROALGOS
    bytecblock TMPL_OWNER_ADDRESS TMPL_TREASURY_ADDRESS
    pushbytes ""
    dupn 3
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:48
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    txn TypeEnum
    intc_2 // 4
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:48-49
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    bz main_bool_false@7
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:49
    // Txn.xferAsset === usdcAsset &&
    txn XferAsset
    intc_3 // TMPL_USDC_ASSET_ID
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:48-49
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    bz main_bool_false@7
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:50
    // Txn.assetReceiver === treasuryAddress &&
    txn AssetReceiver
    bytec_1 // TMPL_TREASURY_ADDRESS
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:48-50
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.assetReceiver === treasuryAddress &&
    bz main_bool_false@7
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:51
    // Txn.assetAmount === costUSDC &&
    txn AssetAmount
    intc 5 // TMPL_COST_MICROALGOS
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:48-51
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.assetReceiver === treasuryAddress &&
    // Txn.assetAmount === costUSDC &&
    bz main_bool_false@7
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:52
    // Txn.lastValid <= expiryRound &&
    txn LastValid
    intc 4 // TMPL_EXPIRY_ROUND
    <=
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:48-52
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.assetReceiver === treasuryAddress &&
    // Txn.assetAmount === costUSDC &&
    // Txn.lastValid <= expiryRound &&
    bz main_bool_false@7
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:53
    // Txn.assetCloseTo === Global.zeroAddress
    txn AssetCloseTo
    global ZeroAddress
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:48-53
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.assetReceiver === treasuryAddress &&
    // Txn.assetAmount === costUSDC &&
    // Txn.lastValid <= expiryRound &&
    // Txn.assetCloseTo === Global.zeroAddress
    bz main_bool_false@7
    intc_0 // 1
    bury 3

main_bool_merge@8:
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:59
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    txn TypeEnum
    intc_2 // 4
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:59-60
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    bz main_bool_false@14
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:60
    // Txn.xferAsset === usdcAsset &&
    txn XferAsset
    intc_3 // TMPL_USDC_ASSET_ID
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:59-60
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    bz main_bool_false@14
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:61
    // Txn.assetReceiver === Txn.sender &&
    txn AssetReceiver
    txn Sender
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:59-61
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.assetReceiver === Txn.sender &&
    bz main_bool_false@14
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:62
    // Txn.assetAmount === Uint64(0) &&
    txn AssetAmount
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:59-62
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.assetReceiver === Txn.sender &&
    // Txn.assetAmount === Uint64(0) &&
    bnz main_bool_false@14
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:63
    // Txn.assetCloseTo === Global.zeroAddress
    txn AssetCloseTo
    global ZeroAddress
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:59-63
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.assetReceiver === Txn.sender &&
    // Txn.assetAmount === Uint64(0) &&
    // Txn.assetCloseTo === Global.zeroAddress
    bz main_bool_false@14
    intc_0 // 1
    bury 1

main_bool_merge@15:
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:67
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    txn TypeEnum
    intc_2 // 4
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:67-68
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    bz main_bool_false@22
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:68
    // Txn.xferAsset === usdcAsset &&
    txn XferAsset
    intc_3 // TMPL_USDC_ASSET_ID
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:67-68
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    bz main_bool_false@22
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:69
    // Txn.firstValid > expiryRound &&
    txn FirstValid
    intc 4 // TMPL_EXPIRY_ROUND
    >
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:67-69
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.firstValid > expiryRound &&
    bz main_bool_false@22
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:70
    // Txn.assetReceiver === ownerAddress &&
    txn AssetReceiver
    bytec_0 // TMPL_OWNER_ADDRESS
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:67-70
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.firstValid > expiryRound &&
    // Txn.assetReceiver === ownerAddress &&
    bz main_bool_false@22
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:71
    // Txn.assetAmount === Uint64(0) &&
    txn AssetAmount
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:67-71
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.firstValid > expiryRound &&
    // Txn.assetReceiver === ownerAddress &&
    // Txn.assetAmount === Uint64(0) &&
    bnz main_bool_false@22
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:72
    // Txn.assetCloseTo === ownerAddress
    txn AssetCloseTo
    bytec_0 // TMPL_OWNER_ADDRESS
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:67-72
    // Txn.typeEnum === TransactionType.AssetTransfer &&
    // Txn.xferAsset === usdcAsset &&
    // Txn.firstValid > expiryRound &&
    // Txn.assetReceiver === ownerAddress &&
    // Txn.assetAmount === Uint64(0) &&
    // Txn.assetCloseTo === ownerAddress
    bz main_bool_false@22
    intc_0 // 1
    bury 2

main_bool_merge@23:
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:76
    // Txn.typeEnum === TransactionType.Payment &&
    txn TypeEnum
    intc_0 // 1
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:76-77
    // Txn.typeEnum === TransactionType.Payment &&
    // Txn.firstValid > expiryRound &&
    bz main_bool_false@29
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:77
    // Txn.firstValid > expiryRound &&
    txn FirstValid
    intc 4 // TMPL_EXPIRY_ROUND
    >
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:76-77
    // Txn.typeEnum === TransactionType.Payment &&
    // Txn.firstValid > expiryRound &&
    bz main_bool_false@29
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:78
    // Txn.receiver === ownerAddress &&
    txn Receiver
    bytec_0 // TMPL_OWNER_ADDRESS
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:76-78
    // Txn.typeEnum === TransactionType.Payment &&
    // Txn.firstValid > expiryRound &&
    // Txn.receiver === ownerAddress &&
    bz main_bool_false@29
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:79
    // Txn.amount === Uint64(0) &&
    txn Amount
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:76-79
    // Txn.typeEnum === TransactionType.Payment &&
    // Txn.firstValid > expiryRound &&
    // Txn.receiver === ownerAddress &&
    // Txn.amount === Uint64(0) &&
    bnz main_bool_false@29
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:80
    // Txn.closeRemainderTo === ownerAddress
    txn CloseRemainderTo
    bytec_0 // TMPL_OWNER_ADDRESS
    ==
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:76-80
    // Txn.typeEnum === TransactionType.Payment &&
    // Txn.firstValid > expiryRound &&
    // Txn.receiver === ownerAddress &&
    // Txn.amount === Uint64(0) &&
    // Txn.closeRemainderTo === ownerAddress
    bz main_bool_false@29
    intc_0 // 1
    bury 4

main_bool_merge@30:
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:84
    // assert(Txn.fee <= Uint64(2_000), 'Fee too high')
    txn Fee
    pushint 2000 // 2000
    <=
    assert // Fee too high
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:85
    // assert(Txn.rekeyTo === Global.zeroAddress, 'Rekey is not allowed')
    txn RekeyTo
    global ZeroAddress
    ==
    assert // Rekey is not allowed
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:88
    // if (isPromptPayment || isUSDCCloseOut || isAlgoCloseOut) {
    dig 2
    bnz main_if_body@33
    dig 1
    bnz main_if_body@33
    dig 3
    bz main_else_body@34

main_if_body@33:
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:89
    // assert(Global.groupSize <= Uint64(2), 'Invalid group size for action')
    global GroupSize
    pushint 2 // 2
    <=
    assert // Invalid group size for action

main_after_if_else@37:
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:95
    // assert(isPromptPayment || isUSDCOptIn || isUSDCCloseOut || isAlgoCloseOut, 'Transaction does not match session policy')
    dig 2
    dig 1
    ||
    dig 2
    ||
    dig 4
    ||
    assert // Transaction does not match session policy
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:97
    // return true
    intc_0 // 1
    return

main_else_body@34:
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:90
    // } else if (isUSDCOptIn) {
    dup
    bz main_after_if_else@37
    // smart_contracts/synthra_delegate/SynthraDelegate.algo.ts:91
    // assert(Global.groupSize <= Uint64(3), 'OptIn must be part of a funding group')
    global GroupSize
    pushint 3 // 3
    <=
    assert // OptIn must be part of a funding group
    b main_after_if_else@37

main_bool_false@29:
    intc_1 // 0
    bury 4
    b main_bool_merge@30

main_bool_false@22:
    intc_1 // 0
    bury 2
    b main_bool_merge@23

main_bool_false@14:
    intc_1 // 0
    bury 1
    b main_bool_merge@15

main_bool_false@7:
    intc_1 // 0
    bury 3
    b main_bool_merge@8
`;
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
  result = result.replace(/TMPL_USDC_ASSET_ID/g, String(params.usdcAssetId));

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
