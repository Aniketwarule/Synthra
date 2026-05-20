import { x402Client } from "@x402-avm/core/client";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2, USDC_TESTNET_ASA_ID, USDC_MAINNET_ASA_ID } from "@x402-avm/avm";
import type { ClientAvmSigner } from "@x402-avm/avm";

export interface SynthraClientConfig {
  signer: ClientAvmSigner;
  network?: "testnet" | "mainnet";
}

/**
 * Creates a wrapped fetch client that automatically handles x402 payments
 * using prepaid USDC on Algorand.
 */
export function createSynthraClient(config: SynthraClientConfig) {
  const isMainnet = config.network === "mainnet";
  const caip2 = isMainnet ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2;
  const usdcId = isMainnet ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID;

  // Initialize the base fetch client
  const client = new x402Client();

  // Register the AVM scheme
  registerExactAvmScheme(client, { signer: config.signer });

  // The x402Client has a .fetch() method that automatically handles the 402 flow
  return client;
}

export type { ClientAvmSigner };
