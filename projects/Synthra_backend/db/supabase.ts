import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

const AGENTS_TABLE_NAME = 'public.agents';

const isSchemaMissingError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes(`could not find the table '${AGENTS_TABLE_NAME}'`) ||
    normalized.includes('relation "public.agents" does not exist');
};

export class SupabaseSchemaNotReadyError extends Error {
  constructor() {
    super(
      `[Init] Supabase schema is not initialized. Run SQL migration: projects/Synthra_backend/supabase/migrations/20260416_init_supabase.sql`,
    );
    this.name = 'SupabaseSchemaNotReadyError';
  }
}

const getRequiredEnv = (name: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[Init] Missing required environment variable: ${name}`);
  }
  return value;
};

export const getSupabaseClient = (): SupabaseClient => {
  if (cachedClient) {
    return cachedClient;
  }

  const url = getRequiredEnv('SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
};

export const verifySupabaseConnection = async (): Promise<void> => {
  const supabase = getSupabaseClient();

  // Connectivity/auth check that does not depend on application tables.
  const { error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (authError) {
    throw new Error(`[Init] Supabase auth connectivity check failed: ${authError.message}`);
  }

  const { error } = await supabase.from('agents').select('id').limit(1);

  if (error) {
    if (isSchemaMissingError(error.message)) {
      throw new SupabaseSchemaNotReadyError();
    }

    throw new Error(`[Init] Supabase connectivity check failed: ${error.message}`);
  }
};
