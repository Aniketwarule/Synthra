import { Request, Response } from 'express';
import algosdk from 'algosdk';
import crypto from 'crypto';
import { findAgentById } from '../repositories/agents';
import {
  finalizeReservedTxProof,
  reserveTxProof,
  TxProofScope,
} from '../repositories/paymentTxProofs';

import { chargeForPrompt } from '../services/charge.service';
import { lsigStore } from '../routes/authorize';
import { generateWithGroq, resolveGroqModel } from '../routes/baseModels';

const indexerClient = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', '');
const PAYMENT_PROOF_SCOPE: TxProofScope = 'marketplace_generate';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const generateRoute = async (req: Request, res: Response): Promise<void> => {
  let reservedTxId: string | null = null;
  let consumePaymentProof = false;

  try {
    const { prompt, agentId } = req.body;
    const authHeader = req.headers.authorization;

    if (!prompt || !agentId) {
      res.status(400).json({ error: 'Missing prompt or agentId' });
      return;
    }

    const agent = await findAgentById(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const requiredAmount = Math.round(agent.priceAlgo * 1_000_000);
    const requiredAddress = agent.creatorWallet;

    // ─── Step 1: Handle Delegated LogicSig ───
    if (authHeader && authHeader.startsWith('Delegated ')) {
      const userAddress = authHeader.split(' ')[1];
      
      const algodClient = new algosdk.Algodv2(
        process.env.ALGOD_TOKEN !== undefined ? process.env.ALGOD_TOKEN : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        process.env.ALGOD_URL || 'http://localhost:4001',
        ''
      );

      const chargeResult = await chargeForPrompt({
        userAddress,
        algodClient,
        lsigStore,
        serviceAddress: requiredAddress,
        costMicroAlgo: requiredAmount
      });

      if (!chargeResult.ok) {
        if (chargeResult.reason === 'insufficient_balance' || chargeResult.reason === 'expired') {
          console.warn(`[Generate] Escrow LogicSig charge failed (${chargeResult.reason}): ${chargeResult.detail}`);
          res.status(402).json({ error: `Payment Required: ${chargeResult.reason}` });
        } else {
          res.status(401).json({ error: `Delegated LogicSig charge failed: ${chargeResult.reason} - ${chargeResult.detail}` });
        }
        return;
      }
      
      reservedTxId = chargeResult.txId;
      consumePaymentProof = true;
      console.log(`[Generate] Successfully charged delegated lsig for ${userAddress}, txId: ${reservedTxId}`);
    } 
    // ─── Step 2: Standard L402 Intercept & Verify ───
    else {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 402 Payment Required
        const invoiceId = crypto.randomBytes(8).toString('hex');
        const challenge = Buffer.from(
          JSON.stringify({
            amountMicroAlgos: requiredAmount,
            creatorAddress: requiredAddress,
            invoiceId: invoiceId,
            message: `Payment required for ${agent.name}`,
          })
        ).toString('base64');

        res.status(402).set('Payment-Required', challenge).json({
          error: 'Payment Required',
          amountMicroAlgos: requiredAmount,
          creatorAddress: requiredAddress,
          invoiceId: invoiceId
        });
        return;
      }

      const txId = authHeader.split(' ')[1];
      reservedTxId = txId;

      let txInfo;
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        try {
          txInfo = await indexerClient.lookupTransactionByID(txId).do();
          const txCandidate = txInfo?.transaction as any;
          const confirmedRound = Number(txCandidate?.['confirmed-round'] ?? txCandidate?.confirmedRound ?? 0);
          if (confirmedRound > 0) {
            break;
          }
        } catch {
          // Retry until the indexer catches up.
        }

        if (attempt < 10) {
          await sleep(900);
        }
      }

      if (!txInfo?.transaction) {
        res.status(401).json({ error: 'Invalid or missing transaction' });
        return;
      }

      const txn: any = txInfo.transaction;

      if (Number(txn['confirmed-round'] ?? txn.confirmedRound ?? 0) <= 0) {
        res.status(401).json({ error: 'Transaction is not confirmed yet' });
        return;
      }

      // Ensure it's a USDC asset transfer transaction
      if (txn['tx-type'] !== 'axfer') {
        res.status(401).json({ error: 'Transaction must be an asset transfer (axfer)' });
        return;
      }

      const usdcAssetId = Number(process.env.USDC_ASSET_ID || 10458941);
      const assetTxn = txn.assetTransferTransaction || txn['asset-transfer-transaction'] || {};
      
      const assetId = Number(assetTxn.assetId ?? assetTxn['asset-id'] ?? 0);

      if (assetId !== usdcAssetId) {
        res.status(401).json({ error: 'Asset ID mismatch. Must be USDC.' });
        return;
      }

      // Verify the receiver destination
      if (assetTxn.receiver !== requiredAddress) {
        res.status(401).json({ error: 'Payment destination address mismatch' });
        return;
      }

      // Verify the amount paid (strict exact amount for true pay-per-use).
      if (Number(assetTxn.amount) !== requiredAmount) {
        res.status(401).json({ error: `Payment amount mismatch. Expected exactly ${requiredAmount} microUSDC.` });
        return;
      }

      const reservation = await reserveTxProof(txId, PAYMENT_PROOF_SCOPE);
      if (reservation === 'already_used') {
        res.status(409).json({ error: 'Transaction already used (double spend)' });
        return;
      }

      if (reservation === 'in_flight') {
        res.status(409).json({ error: 'Transaction is already being processed' });
        return;
      }
    }

    // ─── Step 3: The Dual Router ───

    // --- 3A: Internally Hosted (Ignition Base Model Wrapper) ---
    if (agent.hostingType === 'internal') {
      console.log(`[Router] Routing to internal LLM (${agent.baseModel}) for agent: ${agent.name}`);

      const groqApiKey = (process.env.GROQ_API_KEY || '').trim();
      if (!groqApiKey) {
         res.status(500).send('AI provider key (GROQ) not configured on backend.');
         return;
      }
      
      const resolvedModel = resolveGroqModel(agent.baseModel || '');

      res.status(200);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');

      try {
         const output = await generateWithGroq(groqApiKey, resolvedModel, prompt, 'internal-agent', 1, agent.systemPrompt || undefined);
         res.write(output);
      } catch (err: any) {
         console.error('[Router] LLM Generation Error:', err);
         res.write(`\n\n[Generation Error: ${err.message}]`);
      }

      consumePaymentProof = true;
      res.end();
      return;
    }

    // --- 3B: Externally Hosted (Ignition HTTP Proxy) ---
    if (agent.hostingType === 'external') {
      console.log(`[Router] Proxying request to external hook: ${agent.endpointUrl}`);

      try {
        const externalResponse = await fetch(agent.endpointUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Pass along generic metadata
            'X-Ignition-Agent': agent.name,
            'X-Ignition-TxId': reservedTxId || '',
          },
          body: JSON.stringify({ prompt }),
        });

        if (!externalResponse.ok) {
          throw new Error(`External endpoint returned ${externalResponse.status}`);
        }

        // We can either stream back the response using externalResponse.body
        // or just send the full text for simplicity in this prototype.
        const responseData = await externalResponse.text();

        // Pass the raw external response right back to the client
        consumePaymentProof = true;
        res.status(200).send(responseData);
        return;
      } catch (error) {
        console.error(`[Router] External proxy failed:`, error);
        res.status(502).json({ error: 'Bad Gateway. The external agent endpoint is unreachable.' });
        return;
      }
    }

    res.status(400).json({ error: 'Unsupported agent hosting type' });
    return;

  } catch (error: any) {
    console.error('[Gateway] Error:', error);
    require('fs').writeFileSync('generate_error_log.txt', error?.stack || error?.message || String(error));
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (reservedTxId) {
      await finalizeReservedTxProof(reservedTxId, PAYMENT_PROOF_SCOPE, consumePaymentProof).catch((error) => {
        console.error(`[Gateway] Failed to finalize payment proof txId=${reservedTxId}:`, error);
      });
    }
  }
};
