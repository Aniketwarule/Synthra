-- Seed file for Marketplace Endpoints and Community Agents
-- You can run this in your Supabase SQL Editor

-- 1. Insert Mock Marketplace APIs
INSERT INTO marketplace_endpoints (creator_wallet, name, description, target_url, price_usdc, tags)
VALUES 
  (
    'F7W6JQQWBY75SSTV2B3VAY44O4WJ4WQZ2Z3W6JQQWBY75SSTV2B3VAY4', 
    'Real-Time DeFi Oracle', 
    'Provides real-time price feeds for Algorand ASAs from Tinyman and Pact.', 
    'https://oracle.synthra.io/prices', 
    0.05, 
    ARRAY['oracle', 'defi', 'data']
  ),
  (
    'O4WJ4WQZ2Z3W6JQQWBY75SSTV2B3VAY4F7W6JQQWBY75SSTV2B3VAY4Q', 
    'Sentiment Analysis AI', 
    'Analyze text sentiment using a fine-tuned LLM. Returns a score from -1 to 1.', 
    'https://ai.synthra.io/sentiment', 
    0.02, 
    ARRAY['ai', 'text', 'analysis']
  ),
  (
    'TV2B3VAY4F7W6JQQWBY75SSTO4WJ4WQZ2Z3W6JQQWBY75SSTV2B3VAY4', 
    'Image Generation Proxy', 
    'Generates high-quality images. Wraps Stable Diffusion with x402 payments.', 
    'https://ai.synthra.io/generate-image', 
    0.20, 
    ARRAY['ai', 'image', 'generation']
  ),
  (
    'SSTV2B3VAY4F7W6JQQWBY75SO4WJ4WQZ2Z3W6JQQWBY75SSTV2B3VAY4', 
    'Algorand Fast RPC', 
    'Extremely low latency Algod RPC node designed for high-frequency trading bots.', 
    'https://rpc.synthra.io/algod', 
    0.001, 
    ARRAY['rpc', 'algorand', 'infrastructure']
  );

-- 2. Insert Mock Community Agents
INSERT INTO agents (agent_id, name, description, price_algo, creator_wallet, hosting_type, base_model, system_prompt)
VALUES 
  (
    'sc-auditor-alice',
    'Smart Contract Auditor Alice',
    'An autonomous agent specialized in auditing Algorand Teal and Python smart contracts for vulnerabilities.',
    0.50,
    'F7W6JQQWBY75SSTV2B3VAY44O4WJ4WQZ2Z3W6JQQWBY75SSTV2B3VAY4',
    'internal',
    'gpt-4o',
    'You are Alice, an expert Algorand smart contract auditor. Analyze the provided TEAL/Python code for Reentrancy, logic bugs, and opcode budget issues.'
  ),
  (
    'defi-trader-bob',
    'DeFi Trader Bob',
    'Bob analyzes market trends on Tinyman and provides buy/sell recommendations.',
    0.25,
    'O4WJ4WQZ2Z3W6JQQWBY75SSTV2B3VAY4F7W6JQQWBY75SSTV2B3VAY4Q',
    'internal',
    'claude-3.5-sonnet',
    'You are Bob, a DeFi trading expert on Algorand. Analyze ASAs and provide actionable trading advice.'
  );
