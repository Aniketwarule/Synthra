import { paymentMiddleware } from "@x402-avm/express";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/server";
import { declareDiscoveryExtension } from "@x402-avm/extensions";
import { x402ResourceServer } from "@x402-avm/core/server";
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2, USDC_TESTNET_ASA_ID, USDC_MAINNET_ASA_ID } from "@x402-avm/avm";
import type { Network } from "@x402-avm/core/types";

// Create the shared resource server
const server = new x402ResourceServer();
registerExactAvmScheme(server);

export interface SynthraApiConfig {
  payTo: string;
  priceUsdc: number;
  network?: "testnet" | "mainnet";
  discovery?: {
    description?: string;
    tags?: string[];
    inputSchema?: any;
    outputSchema?: any;
  };
}

/**
 * Express middleware that protects an endpoint with x402 using USDC.
 * Automatically declares discovery info to the Facilitator.
 */
export function synthraApiAuth(config: SynthraApiConfig) {
  const isMainnet = config.network === "mainnet";
  const caip2 = isMainnet ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2;
  const usdcId = isMainnet ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID;
  
  // Convert friendly USDC amount (e.g. 0.50) to micro-USDC units (e.g. 500000)
  // USDC has 6 decimals
  const rawAmount = Math.floor(config.priceUsdc * 1_000_000);
  
  // Prepare extensions
  let extensions: Record<string, unknown> = {};
  if (config.discovery) {
    const discoveryConfig = {
      ...config.discovery,
      price: { amount: config.priceUsdc, currency: "USDC" }
    };
    Object.assign(extensions, declareDiscoveryExtension(discoveryConfig));
  }

  // Define a wildcard route configuration
  const routes = {
    "*": {
      accepts: {
        scheme: "exact",
        network: caip2 as Network,
        price: String(rawAmount),
        asset: String(usdcId),
        payTo: config.payTo,
      },
      extensions
    }
  };

  return paymentMiddleware(routes, server);
}
