import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env vars
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const newAgents = [
  {
    agent_id: 'agent_storyweaver',
    name: 'Story Weaver',
    description: 'Expert creative writer and world builder.',
    price_algo: 0.002,
    creator_wallet: process.env.IGNITION_TREASURY_ADDRESS,
    hosting_type: 'internal',
    base_model: 'gemini-1.5-pro',
    system_prompt: 'You are an expert creative writer and world builder. Respond with highly descriptive and engaging narratives.',
    api_key: 'dummy',
  },
  {
    agent_id: 'agent_code_ninja',
    name: 'Code Ninja',
    description: 'Advanced Python & Rust developer assistant.',
    price_algo: 0.005,
    creator_wallet: process.env.IGNITION_TREASURY_ADDRESS,
    hosting_type: 'internal',
    base_model: 'gpt-4o',
    system_prompt: 'You are an advanced Python and Rust developer. Provide concise, highly optimized, and robust code snippets.',
    api_key: 'dummy',
  },
  {
    agent_id: 'agent_defi_analyst',
    name: 'DeFi Analyst',
    description: 'Analyzes charts and tokenomics for Web3 projects.',
    price_algo: 0.001,
    creator_wallet: process.env.IGNITION_TREASURY_ADDRESS,
    hosting_type: 'internal',
    base_model: 'claude-3-opus',
    system_prompt: 'You are a DeFi analyst. Provide insights on tokenomics, charting, and Web3 project viability.',
    api_key: 'dummy',
  },
  {
    agent_id: 'agent_translator_bot',
    name: 'Polyglot Translator',
    description: 'Real-time contextual translations for 50+ languages.',
    price_algo: 0.001,
    creator_wallet: process.env.IGNITION_TREASURY_ADDRESS,
    hosting_type: 'internal',
    base_model: 'gemini-2.0-flash',
    system_prompt: 'You are a highly capable polyglot translator. Translate the given text contextually, providing nuances if necessary.',
    api_key: 'dummy',
  }
];

async function seed() {
  console.log("Clearing existing agents...");
  // Delete all agents by deleting where id is not null
  const { error: deleteError } = await supabase.from('agents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (deleteError) {
    console.error("Failed to delete existing agents:", deleteError);
    return;
  }

  console.log("Inserting new community agents...");
  const { error: insertError } = await supabase.from('agents').insert(newAgents);
  
  if (insertError) {
    console.error("Failed to insert agents:", insertError);
  } else {
    console.log("Successfully seeded 4 new community agents!");
  }
}

seed();
