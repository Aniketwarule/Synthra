import { getSupabaseClient } from '../db/supabase';
import crypto from 'crypto';

export type HostingType = 'internal' | 'external';

type AgentRow = {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  price_algo: number | string;
  creator_wallet: string;
  hosting_type: HostingType;
  base_model: string | null;
  system_prompt: string | null;
  endpoint_url: string | null;
  api_key: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentEntity = {
  id: string;
  _id: string;
  agentId: string;
  name: string;
  description: string;
  priceAlgo: number;
  creatorWallet: string;
  hostingType: HostingType;
  baseModel?: string;
  systemPrompt?: string;
  endpointUrl?: string;
  APIkey?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAgentInput = {
  agentId?: string;
  name: string;
  description: string;
  priceAlgo: number;
  creatorWallet: string;
  hostingType: HostingType;
  baseModel?: string;
  systemPrompt?: string;
  endpointUrl?: string;
  APIkey?: string;
};

const inMemoryAgents = new Map<string, AgentEntity>();
let fallbackWarningShown = false;

const isAgentsTableMissingError = (message: string | undefined): boolean => {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("could not find the table 'public.agents'") ||
    normalized.includes('relation "public.agents" does not exist');
};

const warnInMemoryFallbackOnce = (): void => {
  if (fallbackWarningShown) {
    return;
  }

  fallbackWarningShown = true;
  console.warn('[DB] Falling back to in-memory agents store because Supabase agents table is missing.');
};

const toNumber = (value: number | string): number => {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error('[DB] Failed to parse numeric value for agent price');
  }
  return parsed;
};

const toAgentEntity = (row: AgentRow): AgentEntity => ({
  id: row.id,
  _id: row.id,
  agentId: row.agent_id,
  name: row.name,
  description: row.description,
  priceAlgo: toNumber(row.price_algo),
  creatorWallet: row.creator_wallet,
  hostingType: row.hosting_type,
  baseModel: row.base_model ?? undefined,
  systemPrompt: row.system_prompt ?? undefined,
  endpointUrl: row.endpoint_url ?? undefined,
  APIkey: row.api_key ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const validateAgentInput = (input: CreateAgentInput): void => {
  if (input.hostingType === 'internal') {
    if (!input.baseModel || !input.systemPrompt || !input.APIkey) {
      throw new Error('Internal hosting requires baseModel, systemPrompt, and APIkey');
    }
  }

  if (input.hostingType === 'external') {
    if (!input.endpointUrl) {
      throw new Error('External hosting requires endpointUrl');
    }

    if (!/^https?:\/\//.test(input.endpointUrl)) {
      throw new Error('Invalid endpointUrl. URL must start with http:// or https://');
    }
  }
};

const createAgentId = (): string => `agent_${Math.random().toString(36).substring(2, 9)}`;

const createInMemoryAgent = (input: CreateAgentInput): AgentEntity => {
  const now = new Date().toISOString();
  const entity: AgentEntity = {
    id: crypto.randomUUID(),
    _id: '',
    agentId: input.agentId || createAgentId(),
    name: input.name,
    description: input.description,
    priceAlgo: input.priceAlgo,
    creatorWallet: input.creatorWallet,
    hostingType: input.hostingType,
    baseModel: input.baseModel,
    systemPrompt: input.systemPrompt,
    endpointUrl: input.endpointUrl,
    APIkey: input.APIkey,
    createdAt: now,
    updatedAt: now,
  };

  entity._id = entity.id;
  inMemoryAgents.set(entity.id, entity);
  return entity;
};

export const createAgent = async (input: CreateAgentInput): Promise<AgentEntity> => {
  validateAgentInput(input);

  const supabase = getSupabaseClient();

  const payload = {
    agent_id: input.agentId || createAgentId(),
    name: input.name,
    description: input.description,
    price_algo: input.priceAlgo,
    creator_wallet: input.creatorWallet,
    hosting_type: input.hostingType,
    base_model: input.hostingType === 'internal' ? input.baseModel ?? null : null,
    system_prompt: input.hostingType === 'internal' ? input.systemPrompt ?? null : null,
    endpoint_url: input.hostingType === 'external' ? input.endpointUrl ?? null : null,
    api_key: input.hostingType === 'internal' ? input.APIkey ?? null : null,
  };

  const { data, error } = await supabase
    .from('agents')
    .insert(payload)
    .select('*')
    .single();

  if (error && isAgentsTableMissingError(error.message)) {
    warnInMemoryFallbackOnce();
    return createInMemoryAgent(input);
  }

  if (error || !data) {
    throw new Error(`[DB] Failed to create agent: ${error?.message ?? 'Unknown error'}`);
  }

  return toAgentEntity(data as AgentRow);
};

export const listAgents = async (): Promise<AgentEntity[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error && isAgentsTableMissingError(error.message)) {
    warnInMemoryFallbackOnce();
    return [...inMemoryAgents.values()].sort((left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }

  if (error) {
    throw new Error(`[DB] Failed to fetch agents: ${error.message}`);
  }

  return (data ?? []).map((row) => toAgentEntity(row as AgentRow));
};

export const findAgentById = async (lookupId: string): Promise<AgentEntity | null> => {
  const supabase = getSupabaseClient();

  const byPrimaryKey = await supabase
    .from('agents')
    .select('*')
    .eq('id', lookupId)
    .maybeSingle();

  if (byPrimaryKey.error && isAgentsTableMissingError(byPrimaryKey.error.message)) {
    warnInMemoryFallbackOnce();
    for (const agent of inMemoryAgents.values()) {
      if (agent.id === lookupId || agent._id === lookupId || agent.agentId === lookupId) {
        return agent;
      }
    }
    return null;
  }

  if (byPrimaryKey.error) {
    throw new Error(`[DB] Failed to find agent by primary id: ${byPrimaryKey.error.message}`);
  }

  if (byPrimaryKey.data) {
    return toAgentEntity(byPrimaryKey.data as AgentRow);
  }

  const byAgentId = await supabase
    .from('agents')
    .select('*')
    .eq('agent_id', lookupId)
    .maybeSingle();

  if (byAgentId.error) {
    throw new Error(`[DB] Failed to find agent by agentId: ${byAgentId.error.message}`);
  }

  if (!byAgentId.data) {
    return null;
  }

  return toAgentEntity(byAgentId.data as AgentRow);
};
