# synthra-x402

The official SDK for interacting with the **Synthra API Marketplace**. This SDK automatically handles x402-avm payments (L402 protocol) using prepaid USDC on the Algorand blockchain.

It allows human developers and autonomous AI agents to consume premium APIs without manually managing cryptocurrency payments or transaction signing.

## Installation

```bash
npm install synthra-x402
```

## For Human Developers (Browser)

If you are building a web application, you can initialize the client using the user's active wallet provider (e.g., Pera Wallet, Defly, etc.). The SDK will automatically prompt the user to approve USDC payments when required.

```typescript
import { createSynthraClient } from 'synthra-x402/client'

// Assuming you are using @txnlab/use-wallet
const { activeAccount, signTransactions } = useWallet();

const client = createSynthraClient({
  network: 'testnet', // or 'mainnet'
  payTo: 'CREATOR_ALGORAND_ADDRESS_HERE',
  priceUsdc: 0.10, // Cost per request
  signer: {
    address: activeAccount.address,
    signTransactions: async (txns, indexesToSign) => {
      return signTransactions(txns, indexesToSign);
    }
  }
});

// Just fetch normally! The SDK handles the 402 payment flow under the hood
const response = await client.fetch('https://api.weather.in/cities');
const data = await response.json();
```

## For Autonomous Agents (Node.js)

Agents can consume APIs entirely autonomously by signing the USDC payment with their own private key. No human intervention is needed.

```typescript
import { createSynthraClient } from 'synthra-x402/client'
import algosdk from 'algosdk';

const secretKey = Buffer.from(process.env.AGENT_PRIVATE_KEY, "base64");
const address = algosdk.encodeAddress(secretKey.slice(32));

const agentClient = createSynthraClient({
  network: 'testnet', // or 'mainnet'
  payTo: 'CREATOR_ALGORAND_ADDRESS_HERE',
  priceUsdc: 0.10,
  signer: {
    address,
    signTransactions: async (txns, indexesToSign) => {
      return txns.map((txn, i) => {
        if (indexesToSign && !indexesToSign.includes(i)) return null;
        const decoded = algosdk.decodeUnsignedTransaction(txn);
        return algosdk.signTransaction(decoded, secretKey).blob;
      });
    }
  }
});

// The agent can now consume external APIs from the marketplace autonomously
const response = await agentClient.fetch('https://api.weather.in/cities');
const data = await response.json();
```

## Protecting your own APIs (Express.js Middleware)

You can also use this package to easily protect your own Express.js API endpoints and monetize them on the Synthra Marketplace.

```typescript
import express from 'express';
import { synthraApiAuth } from 'synthra-x402/server';

const app = express();

// Protect the endpoint requiring 0.10 USDC per request
app.use("/api/premium", synthraApiAuth({
  network: "testnet",
  priceUsdc: 0.10,
  payTo: "YOUR_ALGORAND_WALLET_ADDRESS"
}));

app.get("/api/premium", (req, res) => {
  res.json({ secret: "This data was paid for using x402!" });
});

app.listen(8080);
```

## How it works (Prepaid Tokens)

1. You use the `synthra-x402` SDK to make a request to a marketplace endpoint.
2. The server responds with a `402 Payment Required` invoice.
3. The SDK intercepts the response and automatically handles purchasing a prepaid token (Macaroon) via your wallet or private key.
4. You only pay network fees ONCE. Subsequent requests simply mathematically decrement your token budget off-chain, enabling thousands of requests per second with zero blockchain latency.
