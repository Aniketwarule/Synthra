import { getSupabaseClient } from '../db/supabase';

type ApiKeyRow = {
  id: string;
  key: string;
  model_id: string;
  upstream_model: string;
  wallet_address: string;
  hits: number | string;
  total_tokens: number | string;
  accrued_algo: number | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type UsageLogRow = {
  id: string;
  api_key_masked: string;
  model_id: string;
  upstream_model: string;
  wallet_address: string;
  prompt_tokens: number | string;
  completion_tokens: number | string;
  total_tokens: number | string;
  prompt_snippet: string;
  response_snippet: string;
  latency_ms: number | string;
  status: 'success' | 'error';
  error_message: string | null;
  created_at: string;
};

export type ApiKeyEntity = {
  key: string;
  modelId: string;
  upstreamModel: string;
  walletAddress: string;
  hits: number;
  totalTokens: number;
  accruedAlgo: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UsageLogEntity = {
  apiKey: string;
  modelId: string;
  upstreamModel: string;
  walletAddress: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptSnippet: string;
  responseSnippet: string;
  latencyMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  createdAt: string;
};

export type CreateApiKeyInput = {
  key: string;
  modelId: string;
  upstreamModel: string;
  walletAddress: string;
  hits?: number;
  totalTokens?: number;
  accruedAlgo?: number;
  isActive?: boolean;
};

export type CreateUsageLogInput = {
  apiKey: string;
  modelId: string;
  upstreamModel: string;
  walletAddress: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  promptSnippet?: string;
  responseSnippet?: string;
  latencyMs?: number;
  status: 'success' | 'error';
  errorMessage?: string;
};

const toNumber = (value: number | string): number => {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error('[DB] Failed to parse numeric value for API key repository');
  }

  return parsed;
};

const toApiKeyEntity = (row: ApiKeyRow): ApiKeyEntity => ({
  key: row.key,
  modelId: row.model_id,
  upstreamModel: row.upstream_model,
  walletAddress: row.wallet_address,
  hits: toNumber(row.hits),
  totalTokens: toNumber(row.total_tokens),
  accruedAlgo: toNumber(row.accrued_algo),
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toUsageLogEntity = (row: UsageLogRow): UsageLogEntity => ({
  apiKey: row.api_key_masked,
  modelId: row.model_id,
  upstreamModel: row.upstream_model,
  walletAddress: row.wallet_address,
  promptTokens: toNumber(row.prompt_tokens),
  completionTokens: toNumber(row.completion_tokens),
  totalTokens: toNumber(row.total_tokens),
  promptSnippet: row.prompt_snippet,
  responseSnippet: row.response_snippet,
  latencyMs: toNumber(row.latency_ms),
  status: row.status,
  errorMessage: row.error_message ?? undefined,
  createdAt: row.created_at,
});

export const createApiKey = async (input: CreateApiKeyInput): Promise<ApiKeyEntity> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      key: input.key,
      model_id: input.modelId,
      upstream_model: input.upstreamModel,
      wallet_address: input.walletAddress,
      hits: input.hits ?? 0,
      total_tokens: input.totalTokens ?? 0,
      accrued_algo: input.accruedAlgo ?? 0,
      is_active: input.isActive ?? true,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`[DB] Failed to create API key: ${error?.message ?? 'Unknown error'}`);
  }

  return toApiKeyEntity(data as ApiKeyRow);
};

export const findApiKeyByKey = async (key: string): Promise<ApiKeyEntity | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    throw new Error(`[DB] Failed to fetch API key: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return toApiKeyEntity(data as ApiKeyRow);
};

export const findActiveApiKeyByKey = async (key: string): Promise<ApiKeyEntity | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key', key)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`[DB] Failed to fetch active API key: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return toApiKeyEntity(data as ApiKeyRow);
};

export const incrementApiKeyUsage = async (
  key: string,
  totalTokens: number,
  accruedAlgo: number,
): Promise<ApiKeyEntity | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('increment_api_key_usage', {
    p_key: key,
    p_total_tokens: totalTokens,
    p_accrued_algo: accruedAlgo,
  });

  if (error) {
    throw new Error(`[DB] Failed to increment API key usage: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return null;
  }

  return toApiKeyEntity(row as ApiKeyRow);
};

export const createUsageLog = async (input: CreateUsageLogInput): Promise<void> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('usage_logs').insert({
    api_key_masked: input.apiKey,
    model_id: input.modelId,
    upstream_model: input.upstreamModel,
    wallet_address: input.walletAddress,
    prompt_tokens: input.promptTokens ?? 0,
    completion_tokens: input.completionTokens ?? 0,
    total_tokens: input.totalTokens ?? 0,
    prompt_snippet: input.promptSnippet ?? '',
    response_snippet: input.responseSnippet ?? '',
    latency_ms: input.latencyMs ?? 0,
    status: input.status,
    error_message: input.errorMessage ?? null,
  });

  if (error) {
    throw new Error(`[DB] Failed to create usage log: ${error.message}`);
  }
};

export const listRecentUsageLogs = async (apiKeyMasked: string, limit = 10): Promise<UsageLogEntity[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('api_key_masked', apiKeyMasked)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`[DB] Failed to fetch usage logs: ${error.message}`);
  }

  return (data ?? []).map((row) => toUsageLogEntity(row as UsageLogRow));
};
