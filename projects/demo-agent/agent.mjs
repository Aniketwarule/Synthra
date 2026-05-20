import { createSynthraClient } from 'synthra-x402/client';
import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

// 1. Initialize Agent's Algorand Wallet
// This private key represents the autonomous agent's "bank account"
const privateKeyBase64 = process.env.AGENT_PRIVATE_KEY;
if (!privateKeyBase64) {
  console.error("❌ Please set AGENT_PRIVATE_KEY in your .env file!");
  console.error("   You can generate one using: node generate-key.mjs");
  process.exit(1);
}

const secretKey = Buffer.from(privateKeyBase64, 'base64');
const address = algosdk.encodeAddress(secretKey.slice(32));

console.log(`🤖 Autonomous Agent Initialized`);
console.log(`💳 Agent Wallet: ${address}\n`);

// 2. Configure the x402 Client
// The agent knows who to pay and how much to pay for the endpoint
const agentClient = createSynthraClient({
  network: 'testnet',
  payTo: 'O4WJ4WQZ2Z3W6JQQWBY75SSTV2B3VAY4F7W6JQQWBY75SSTV2B3VAY4Q', // Target Marketplace Creator
  priceUsdc: 0.02, // 2 cents per request
  signer: {
    address,
    signTransactions: async (txns, indexesToSign) => {
      console.log(`\n[Agent] ⚡ Signing L402 Payment Transaction autonomously...`);
      return txns.map((txn, i) => {
        if (indexesToSign && !indexesToSign.includes(i)) return null;
        const decoded = algosdk.decodeUnsignedTransaction(txn);
        return algosdk.signTransaction(decoded, secretKey).blob;
      });
    }
  }
});

// 3. Autonomous Loop
async function runDemo() {
  console.log("🌐 Agent is requesting Sentiment Analysis API from the Marketplace...\n");
  
  try {
    // The fetch call handles EVERYTHING.
    // 1. Initial 402 Payment Required intercepted
    // 2. Invoice generated
    // 3. Transaction signed automatically by our signer hook above
    // 4. Token received
    // 5. Request retried and data returned
    const response = await agentClient.fetch('https://ai.synthra.io/sentiment', {
      method: 'POST',
      body: JSON.stringify({ text: "Algorand is the most incredible blockchain technology!" })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Success! Agent received the data:");
      console.log(data);
    } else {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error("❌ Agent failed to complete the task:", err.message);
  }
}

runDemo();
