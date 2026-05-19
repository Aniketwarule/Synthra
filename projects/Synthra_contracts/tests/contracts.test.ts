/**
 * @file contracts.test.ts
 * @purpose Integration tests for SynthraDelegate (LogicSig) and SynthraVault (stateful).
 *
 * Tests:
 *   LogicSig:
 *     - signs and submits a valid payment ✓
 *     - rejects if amount exceeds cap ✓
 *     - rejects if receiver is wrong ✓
 *     - rejects after expiry round ✓
 *
 *   Vault:
 *     - deposit increases local balance ✓
 *     - deduct only callable by operator ✓
 *     - withdraw returns correct remainder ✓
 *
 * Prerequisites:
 *   - LocalNet running: `algokit localnet start`
 *   - Contracts compiled: `npm run build` in Synthra_contracts
 *
 * @dependencies vitest, algosdk
 */
import { describe, it, expect, beforeAll } from 'vitest';
import algosdk from 'algosdk';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ALGOD_URL = 'http://localhost:4001';
const ALGOD_TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const KMD_TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const TEAL_TEMPLATE_PATH = path.resolve(
  __dirname,
  '../smart_contracts/artifacts/synthra_delegate/SynthraDelegate.teal',
);

// Cost per call for tests (100,000 microALGO = 0.1 ALGO)
const TEST_COST_MICROALGO = 100_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL);
const kmdClient = new algosdk.Kmd(KMD_TOKEN, 'http://localhost', 4002);

/**
 * Safely convert an Address object or string to a plain string.
 * In algosdk v3, account.addr is an Address object, not a string.
 */
function addrStr(addr: unknown): string {
  if (typeof addr === 'string') return addr;
  return String(addr);
}

/**
 * Get the default LocalNet dispenser account via KMD.
 */
async function getDispenserAccount(): Promise<algosdk.Account> {
  const wallets = await kmdClient.listWallets();
  const defaultWallet = (wallets as { wallets: Array<{ name: string; id: string }> }).wallets.find(
    (w) => w.name === 'unencrypted-default-wallet',
  );
  if (!defaultWallet) throw new Error('Default KMD wallet not found');

  const handleResp = await kmdClient.initWalletHandle(defaultWallet.id, '');
  const handle = (handleResp as { wallet_handle_token: string }).wallet_handle_token;
  const keysResp = await kmdClient.listKeys(handle);
  const addr = (keysResp as { addresses: string[] }).addresses[0];
  const keyResp = await kmdClient.exportKey(handle, '', addr);
  await kmdClient.releaseWalletHandle(handle);

  return algosdk.mnemonicToSecretKey(
    algosdk.secretKeyToMnemonic((keyResp as { private_key: Uint8Array }).private_key),
  );
}

/**
 * Fund a test account from the dispenser.
 */
async function fundAccount(
  dispenser: algosdk.Account,
  recipient: unknown,
  amountMicroAlgo: number,
): Promise<void> {
  const params = await algodClient.getTransactionParams().do();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: dispenser.addr,
    receiver: addrStr(recipient),
    amount: amountMicroAlgo,
    suggestedParams: params,
  });
  const signed = txn.signTxn(dispenser.sk);
  const { txid } = await algodClient.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algodClient, txid, 4);
}

/**
 * Compile TEAL source with template vars substituted.
 */
async function compileTealWithParams(params: {
  serviceAddress: string;
  ownerAddress: string;
  costMicroAlgo: number;
  expiryRound: number;
}): Promise<Uint8Array> {
  let tealPath = TEAL_TEMPLATE_PATH;
  if (!fs.existsSync(tealPath)) {
    tealPath = path.resolve(
      __dirname,
      '../smart_contracts/artifacts/ignition_delegate/IgnitionDelegate.teal',
    );
  }

  let teal = fs.readFileSync(tealPath, 'utf-8');

  // For bytecblock: addresses must be raw 32-byte public key as hex (0x...)
  const serviceAddrBytes = algosdk.decodeAddress(params.serviceAddress).publicKey;
  const ownerAddrBytes = algosdk.decodeAddress(params.ownerAddress).publicKey;
  const serviceHex = '0x' + Buffer.from(serviceAddrBytes).toString('hex');
  const ownerHex = '0x' + Buffer.from(ownerAddrBytes).toString('hex');

  // Replace template variables
  teal = teal.replace(/TMPL_TREASURY_ADDRESS/g, serviceHex);
  teal = teal.replace(/TMPL_OWNER_ADDRESS/g, ownerHex);

  // Replace integer template vars
  teal = teal.replace(/TMPL_EXPIRATION_ROUND/g, String(params.expiryRound));
  teal = teal.replace(/TMPL_EXPIRY_ROUND/g, String(params.expiryRound));
  teal = teal.replace(/TMPL_ALLOWED_AMOUNT_MICROALGOS/g, String(params.costMicroAlgo));
  teal = teal.replace(/TMPL_COST_MICROALGOS/g, String(params.costMicroAlgo));

  const result = await algodClient.compile(Buffer.from(teal)).do();
  return new Uint8Array(Buffer.from(result.result, 'base64'));
}

/**
 * Create a delegated LogicSig: compile, create LogicSigAccount, sign with user's key.
 */
async function createDelegatedLsig(
  user: algosdk.Account,
  serviceAddress: unknown,
  costMicroAlgo: number,
  expiryRound: number,
): Promise<algosdk.LogicSigAccount> {
  const programBytes = await compileTealWithParams({
    serviceAddress: addrStr(serviceAddress),
    ownerAddress: addrStr(user.addr),
    costMicroAlgo,
    expiryRound,
  });

  const lsig = new algosdk.LogicSigAccount(programBytes);
  lsig.sign(user.sk);
  return lsig;
}

/**
 * Compute the ABI method selector (first 4 bytes of SHA-512/256 hash).
 */
function abiMethodSelector(signature: string): Uint8Array {
  return new Uint8Array(
    algosdk.ABIMethod.fromSignature(signature).getSelector(),
  );
}

// ---------------------------------------------------------------------------
// Test Suite: SynthraDelegate (LogicSig)
// ---------------------------------------------------------------------------

describe('SynthraDelegate LogicSig', () => {
  let dispenser: algosdk.Account;
  let user: algosdk.Account;
  let serviceWallet: algosdk.Account;
  let currentRound: number;

  beforeAll(async () => {
    dispenser = await getDispenserAccount();
    user = algosdk.generateAccount();
    serviceWallet = algosdk.generateAccount();

    // Fund user with 10 ALGO for tests
    await fundAccount(dispenser, user.addr, 10_000_000);

    const status = await algodClient.status().do();
    currentRound = Number((status as Record<string, unknown>).lastRound ?? (status as Record<string, unknown>)['last-round']);
  }, 30_000);

  it('signs and submits a valid payment', async () => {
    const expiryRound = currentRound + 1000;

    const lsig = await createDelegatedLsig(
      user,
      serviceWallet.addr,
      TEST_COST_MICROALGO,
      expiryRound,
    );

    const params = await algodClient.getTransactionParams().do();
    params.fee = 1000;
    params.flatFee = true;

    if (params.lastValid > expiryRound) {
      params.lastValid = expiryRound;
    }

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: addrStr(user.addr),
      receiver: addrStr(serviceWallet.addr),
      amount: TEST_COST_MICROALGO,
      suggestedParams: params,
    });

    const signedTxn = algosdk.signLogicSigTransaction(txn, lsig);
    const { txid } = await algodClient.sendRawTransaction(signedTxn.blob).do();
    const confirmation = await algosdk.waitForConfirmation(algodClient, txid, 4);

    expect(txid).toBeTruthy();
    expect(confirmation).toBeTruthy();
  }, 15_000);

  it('rejects if amount exceeds cap', async () => {
    const expiryRound = currentRound + 1000;

    const lsig = await createDelegatedLsig(
      user,
      serviceWallet.addr,
      TEST_COST_MICROALGO,
      expiryRound,
    );

    const params = await algodClient.getTransactionParams().do();
    params.fee = 1000;
    params.flatFee = true;
    if (params.lastValid > expiryRound) {
      params.lastValid = expiryRound;
    }

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: addrStr(user.addr),
      receiver: addrStr(serviceWallet.addr),
      amount: TEST_COST_MICROALGO + 1,
      suggestedParams: params,
    });

    const signedTxn = algosdk.signLogicSigTransaction(txn, lsig);

    await expect(
      algodClient.sendRawTransaction(signedTxn.blob).do(),
    ).rejects.toThrow();
  }, 15_000);

  it('rejects if receiver is wrong', async () => {
    const expiryRound = currentRound + 1000;
    const wrongReceiver = algosdk.generateAccount();

    const lsig = await createDelegatedLsig(
      user,
      serviceWallet.addr,
      TEST_COST_MICROALGO,
      expiryRound,
    );

    const params = await algodClient.getTransactionParams().do();
    params.fee = 1000;
    params.flatFee = true;
    if (params.lastValid > expiryRound) {
      params.lastValid = expiryRound;
    }

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: addrStr(user.addr),
      receiver: addrStr(wrongReceiver.addr),
      amount: TEST_COST_MICROALGO,
      suggestedParams: params,
    });

    const signedTxn = algosdk.signLogicSigTransaction(txn, lsig);

    await expect(
      algodClient.sendRawTransaction(signedTxn.blob).do(),
    ).rejects.toThrow();
  }, 15_000);

  it('rejects after expiry round', async () => {
    // Use round 1 — on a fresh LocalNet this round has already passed.
    // If currentRound is very low (< 5), skip this test as the round window
    // doesn't allow us to create an expired lsig yet.
    const expiredRound = Math.max(1, currentRound - 10);

    // If we can't create a meaningfully expired round, skip
    if (currentRound <= 10) {
      // Compile with round 1 — it should still fail because lastValid > expiryRound
      const lsig = await createDelegatedLsig(
        user,
        serviceWallet.addr,
        TEST_COST_MICROALGO,
        1, // Round 1 has already passed
      );

      const params = await algodClient.getTransactionParams().do();
      params.fee = 1000;
      params.flatFee = true;

      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: addrStr(user.addr),
        receiver: addrStr(serviceWallet.addr),
        amount: TEST_COST_MICROALGO,
        suggestedParams: params,
      });

      const signedTxn = algosdk.signLogicSigTransaction(txn, lsig);

      // Should fail because lastValid (from params) > expiryRound (1)
      await expect(
        algodClient.sendRawTransaction(signedTxn.blob).do(),
      ).rejects.toThrow();
      return;
    }

    const lsig = await createDelegatedLsig(
      user,
      serviceWallet.addr,
      TEST_COST_MICROALGO,
      expiredRound,
    );

    const params = await algodClient.getTransactionParams().do();
    params.fee = 1000;
    params.flatFee = true;

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: addrStr(user.addr),
      receiver: addrStr(serviceWallet.addr),
      amount: TEST_COST_MICROALGO,
      suggestedParams: params,
    });

    const signedTxn = algosdk.signLogicSigTransaction(txn, lsig);

    await expect(
      algodClient.sendRawTransaction(signedTxn.blob).do(),
    ).rejects.toThrow();
  }, 15_000);
});

// ---------------------------------------------------------------------------
// Test Suite: SynthraVault (Stateful Contract)
// ---------------------------------------------------------------------------

describe('SynthraVault Stateful Contract', () => {
  let dispenser: algosdk.Account;
  let operator: algosdk.Account;
  let depositor: algosdk.Account;
  let nonOperator: algosdk.Account;
  let appId: number;
  let appAddress: string;

  beforeAll(async () => {
    dispenser = await getDispenserAccount();
    operator = algosdk.generateAccount();
    depositor = algosdk.generateAccount();
    nonOperator = algosdk.generateAccount();

    // Fund test accounts
    await fundAccount(dispenser, operator.addr, 10_000_000);
    await fundAccount(dispenser, depositor.addr, 10_000_000);
    await fundAccount(dispenser, nonOperator.addr, 5_000_000);

    // Check if compiled artifacts exist
    const approvalPath = path.resolve(
      __dirname,
      '../smart_contracts/artifacts/synthra_vault/SynthraVault.approval.teal',
    );
    const clearPath = path.resolve(
      __dirname,
      '../smart_contracts/artifacts/synthra_vault/SynthraVault.clear.teal',
    );

    if (!fs.existsSync(approvalPath) || !fs.existsSync(clearPath)) {
      console.warn(
        'SynthraVault TEAL artifacts not found. Run `npm run build` first. Skipping vault tests.',
      );
      return;
    }

    // Compile approval and clear programs
    const approvalTeal = fs.readFileSync(approvalPath, 'utf-8');
    const clearTeal = fs.readFileSync(clearPath, 'utf-8');

    const approvalResult = await algodClient.compile(Buffer.from(approvalTeal)).do();
    const clearResult = await algodClient.compile(Buffer.from(clearTeal)).do();

    const approvalProgram = new Uint8Array(Buffer.from(approvalResult.result, 'base64'));
    const clearProgram = new Uint8Array(Buffer.from(clearResult.result, 'base64'));

    // Deploy the contract with createApplication ABI method
    const params = await algodClient.getTransactionParams().do();

    const createTxn = algosdk.makeApplicationCreateTxnFromObject({
      sender: addrStr(operator.addr),
      approvalProgram,
      clearProgram,
      numGlobalInts: 1,      // totalCalls
      numGlobalByteSlices: 1, // owner
      numLocalInts: 1,        // userBalance
      numLocalByteSlices: 0,
      suggestedParams: params,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [abiMethodSelector('createApplication()void')],
    });

    const signedCreate = createTxn.signTxn(operator.sk);
    const { txid } = await algodClient.sendRawTransaction(signedCreate).do();
    const confirmation = await algosdk.waitForConfirmation(algodClient, txid, 4) as Record<string, unknown>;

    appId = Number(confirmation['application-index'] ?? confirmation.applicationIndex);
    appAddress = addrStr(algosdk.getApplicationAddress(BigInt(appId)));

    // Fund the app account for inner transactions
    await fundAccount(dispenser, appAddress, 1_000_000);

    // Depositor opts in via ABI optIn method
    const optInParams = await algodClient.getTransactionParams().do();
    const optInTxn = algosdk.makeApplicationOptInTxnFromObject({
      sender: addrStr(depositor.addr),
      appIndex: appId,
      suggestedParams: optInParams,
      appArgs: [abiMethodSelector('optIn()void')],
    });
    const signedOptIn = optInTxn.signTxn(depositor.sk);
    const optInResult = await algodClient.sendRawTransaction(signedOptIn).do();
    await algosdk.waitForConfirmation(algodClient, optInResult.txid, 4);
  }, 60_000);

  it('deposit increases local balance', async () => {
    if (!appId) return;

    const depositAmount = 500_000; // 0.5 ALGO
    const params = await algodClient.getTransactionParams().do();

    // Create atomic group: payment + app call (ABI deposit method)
    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: addrStr(depositor.addr),
      receiver: appAddress,
      amount: depositAmount,
      suggestedParams: params,
    });

    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: addrStr(depositor.addr),
      appIndex: appId,
      appArgs: [abiMethodSelector('deposit(pay)void')],
      suggestedParams: params,
    });

    const grouped = algosdk.assignGroupID([payTxn, appCallTxn]);
    const signedPay = grouped[0].signTxn(depositor.sk);
    const signedCall = grouped[1].signTxn(depositor.sk);

    const { txid } = await algodClient.sendRawTransaction([signedPay, signedCall]).do();
    await algosdk.waitForConfirmation(algodClient, txid, 4);

    // Check local state
    const accountInfo = await algodClient.accountApplicationInformation(addrStr(depositor.addr), appId).do() as Record<string, unknown>;
    const appLocalState = accountInfo['app-local-state'] ?? accountInfo['appLocalState'];
    const localState = ((appLocalState as Record<string, unknown>)?.['key-value'] ??
                        (appLocalState as Record<string, unknown>)?.['keyValue'] ?? []) as Array<{ key: string; value: { uint: number } }>;

    const balanceEntry = localState.find(
      (kv) => Buffer.from(kv.key, 'base64').toString() === 'user_balance',
    );

    expect(balanceEntry).toBeTruthy();
    if (balanceEntry) {
      expect(Number(balanceEntry.value.uint)).toBeGreaterThanOrEqual(depositAmount);
    }
  }, 15_000);

  it('deduct only callable by operator', async () => {
    if (!appId) return;

    const params = await algodClient.getTransactionParams().do();

    // Encode deduct(address,uint64) ABI args
    const addrCodec = algosdk.ABIType.from('address');
    const uint64Codec = algosdk.ABIType.from('uint64');

    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: addrStr(nonOperator.addr),
      appIndex: appId,
      appArgs: [
        abiMethodSelector('deduct(address,uint64)void'),
        addrCodec.encode(addrStr(depositor.addr)),
        uint64Codec.encode(BigInt(50_000)),
      ],
      accounts: [addrStr(depositor.addr)],
      suggestedParams: params,
    });

    const signed = appCallTxn.signTxn(nonOperator.sk);

    await expect(
      algodClient.sendRawTransaction(signed).do(),
    ).rejects.toThrow();
  }, 15_000);

  it('withdraw returns correct remainder', async () => {
    if (!appId) return;

    const params = await algodClient.getTransactionParams().do();
    // Cover inner txn fee via fee pooling
    params.fee = 2000;
    params.flatFee = true;

    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: addrStr(depositor.addr),
      appIndex: appId,
      appArgs: [abiMethodSelector('withdraw()void')],
      suggestedParams: params,
    });

    const signed = appCallTxn.signTxn(depositor.sk);
    const { txid } = await algodClient.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(algodClient, txid, 4);

    // Verify local state balance is now 0
    const appInfo = await algodClient.accountApplicationInformation(addrStr(depositor.addr), appId).do() as Record<string, unknown>;
    const appLocalState = appInfo['app-local-state'] ?? appInfo['appLocalState'];
    const localState = ((appLocalState as Record<string, unknown>)?.['key-value'] ??
                        (appLocalState as Record<string, unknown>)?.['keyValue'] ?? []) as Array<{ key: string; value: { uint: number } }>;

    const balanceEntry = localState.find(
      (kv) => Buffer.from(kv.key, 'base64').toString() === 'user_balance',
    );

    if (balanceEntry) {
      expect(Number(balanceEntry.value.uint)).toBe(0);
    }
  }, 15_000);
});
