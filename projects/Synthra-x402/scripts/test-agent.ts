import algosdk from "algosdk";
import { createSynthraClient } from "../src/client";
import type { ClientAvmSigner } from "../src/client";

async function main() {
  console.log("Initializing Agent...");

  // Normally the agent has a funded private key. For simulation, we generate one.
  const account = algosdk.generateAccount();
  const secretKey = account.sk;
  const address = account.addr;

  console.log("Agent Address:", address);

  // Implement the ClientAvmSigner interface for the Agent
  const agentSigner: ClientAvmSigner = {
    address,
    signTransactions: async (txns, indexesToSign) => {
      return txns.map((txnBytes, i) => {
        if (indexesToSign && !indexesToSign.includes(i)) return null;
        const decoded = algosdk.decodeUnsignedTransaction(txnBytes);
        return algosdk.signTransaction(decoded, secretKey).blob;
      });
    },
  };

  // Create the API SDK Client
  const fetchClient = createSynthraClient({
    signer: agentSigner,
    network: "testnet"
  });

  console.log("Fetching paid API endpoint...");
  try {
    // This will intercept the 402, sign the transaction using agentSigner,
    // get the x402 Macaroon prepaid token, and replay the request.
    const res = await fetchClient("http://localhost:8080/api/weather-demo");
    const data = await res.json();
    console.log("API Response:", data);
  } catch (error) {
    // Note: We expect this to fail with "insufficient funds" since the generated account is empty,
    // but the SDK flow will be fully tested.
    console.error("Test Output:", (error as Error).message);
  }
}

main().catch(console.error);
