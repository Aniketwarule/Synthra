import algosdk from 'algosdk';

const account = algosdk.generateAccount();
const privateKeyBase64 = Buffer.from(account.sk).toString('base64');

console.log(`\n🎉 New Algorand Wallet Generated!`);
console.log(`\n📍 Address: ${account.addr}`);
console.log(`🔑 Private Key Base64: ${privateKeyBase64}`);
console.log(`\nNext steps:`);
console.log(`1. Copy the private key and put it in projects/demo-agent/.env as AGENT_PRIVATE_KEY`);
console.log(`2. Fund the address with Testnet ALGO via the dispenser (https://bank.testnet.algorand.network)`);
console.log(`3. Run 'node agent.mjs' to see the agent work autonomously!`);
