import { Router } from 'express';
import algosdk from 'algosdk';
import { x402Facilitator } from "@x402-avm/core/facilitator";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/facilitator";
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2 } from "@x402-avm/avm";
import { extractDiscoveryInfo } from "@x402-avm/extensions";
import type { FacilitatorAvmSigner } from "@x402-avm/avm";
import { getSupabaseClient } from '../db/supabase';

const router = Router();

// Retrieve key or generate a random one for testing if not set
const privKeyStr = process.env.AVM_PRIVATE_KEY;
let secretKey: Uint8Array;
if (privKeyStr) {
  secretKey = Buffer.from(privKeyStr, "base64");
} else {
  const account = algosdk.generateAccount();
  secretKey = account.sk;
  console.warn("WARNING: No AVM_PRIVATE_KEY found in env. Generated random key for testing.");
}

const address = algosdk.encodeAddress(secretKey.slice(32));
const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");

const facilitatorSigner: FacilitatorAvmSigner = {
  getAddresses: () => [address],
  signTransaction: async (txn: Uint8Array, senderAddress: string) => {
    const decoded = algosdk.decodeUnsignedTransaction(txn);
    const signed = algosdk.signTransaction(decoded, secretKey);
    return signed.blob;
  },
  getAlgodClient: (network: string) => algodClient,
  simulateTransactions: async (txns: Uint8Array[], network: string) => {
    const stxns = txns.map((txnBytes) => {
      try {
        return algosdk.decodeSignedTransaction(txnBytes);
      } catch {
        const txn = algosdk.decodeUnsignedTransaction(txnBytes);
        return new algosdk.SignedTransaction({ txn });
      }
    });
    const request = new algosdk.modelsv2.SimulateRequest({
      txnGroups: [
        new algosdk.modelsv2.SimulateRequestTransactionGroup({ txns: stxns }),
      ],
      allowEmptySignatures: true,
    });
    return algodClient.simulateTransactions(request).do();
  },
  sendTransactions: async (signedTxns: Uint8Array[], network: string) => {
    const combined = Buffer.concat(signedTxns.map((t) => Buffer.from(t)));
    const response = await algodClient.sendRawTransaction(combined).do();
    return (response as any).txId;
  },
  waitForConfirmation: async (txId: string, network: string, waitRounds = 4) => {
    return algosdk.waitForConfirmation(algodClient, txId, waitRounds);
  },
};

const facilitator = new x402Facilitator();

registerExactAvmScheme(facilitator, {
  signer: facilitatorSigner,
  networks: [ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2],
});

// Hook into settlement to extract Bazaar Discovery extensions & log usage
facilitator.onAfterSettle(async (context) => {
  if (context.result.success) {
    const supabase = getSupabaseClient();
    
    // 1. Log usage
    try {
      // Basic extraction of data (assuming consumer is payer, and we can infer revenue)
      // Ideally this ties back to a specific endpoint_id if passed in requirements/payload
      // For now we do a generic log if we can't find an endpoint.
      
      let endpointId = null;
      let revenueUsdc = 0;
      let consumerWallet = "unknown";

      if (context.paymentPayload) {
         // simplified metric logging
         consumerWallet = (context.paymentPayload as any).payer || (context.paymentPayload as any).client_id || "unknown";
      }

      await supabase.from('endpoint_usage_logs').insert({
         endpoint_id: endpointId,
         consumer_wallet: consumerWallet,
         latency_ms: 42, // mock latency
         revenue_usdc: revenueUsdc,
         status: 'success'
      });
    } catch (e) {
      console.error("Failed to log usage metric", e);
    }

    // 2. Extract Discovery Info (Bazaar)
    const discovered = extractDiscoveryInfo(
      context.paymentPayload,
      context.requirements,
    );

    if (discovered) {
      console.log("Cataloged API endpoint via Bazaar:", discovered.resourceUrl);
      // We could automatically create/update an endpoint here, but we rely on explicit POST /deploy
    }
  }
});

router.get("/supported", async (_req, res) => {
  res.json([ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2]);
});

router.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Deploy / Register API
router.post("/deploy", async (req, res) => {
  try {
    const { creator_wallet, name, description, target_url, price_usdc, tags } = req.body;
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.from('marketplace_endpoints').insert({
      creator_wallet, name, description, target_url, price_usdc, tags
    }).select().single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Catalog of APIs
router.get("/catalog", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('marketplace_endpoints')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Map to expected format for frontend
    const catalog = data.map(ep => ({
       id: ep.id,
       resourceUrl: ep.target_url,
       description: ep.name,
       price: { amount: ep.price_usdc, currency: "USDC" },
       tags: ep.tags
    }));
    
    res.json(catalog);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Metrics
router.get("/metrics/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    const supabase = getSupabaseClient();

    // Find endpoints owned by wallet
    const { data: endpoints } = await supabase
      .from('marketplace_endpoints')
      .select('id, name')
      .eq('creator_wallet', wallet);

    if (!endpoints || endpoints.length === 0) {
      return res.json({
        totalRequests: 0,
        revenueUsdc: 0,
        activeConsumers: 0,
        avgLatency: 0,
        topEndpoints: []
      });
    }

    const endpointIds = endpoints.map(e => e.id);

    // Get logs for these endpoints
    const { data: logs } = await supabase
      .from('endpoint_usage_logs')
      .select('*')
      .in('endpoint_id', endpointIds);

    if (!logs) throw new Error("Could not fetch logs");

    const totalRequests = logs.length;
    const revenueUsdc = logs.reduce((sum, log) => sum + Number(log.revenue_usdc), 0);
    const uniqueConsumers = new Set(logs.map(log => log.consumer_wallet)).size;
    const avgLatency = logs.length > 0 ? Math.round(logs.reduce((sum, log) => sum + log.latency_ms, 0) / logs.length) : 0;

    // Calculate top endpoints
    const endpointStats = endpoints.map(ep => {
      const epLogs = logs.filter(l => l.endpoint_id === ep.id);
      return {
        name: ep.name,
        reqs: epLogs.length,
        rev: epLogs.reduce((sum, l) => sum + Number(l.revenue_usdc), 0)
      };
    }).sort((a, b) => b.reqs - a.reqs);

    res.json({
      totalRequests,
      revenueUsdc,
      activeConsumers: uniqueConsumers,
      avgLatency,
      topEndpoints: endpointStats
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
