import { getSupabaseClient } from '../db/supabase';

const DUPLICATE_KEY_ERROR_CODE = '23505';

export type TxProofScope = 'base_models_generate' | 'marketplace_generate';

export type ReserveTxProofResult = 'reserved' | 'already_used' | 'in_flight';

type TxProofRow = {
  status: 'in_flight' | 'consumed';
};

export const reserveTxProof = async (txId: string, scope: TxProofScope): Promise<ReserveTxProofResult> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('payment_tx_proofs').insert({
    tx_id: txId,
    scope,
    status: 'in_flight',
  });

  if (!error) {
    return 'reserved';
  }

  if (error.code !== DUPLICATE_KEY_ERROR_CODE) {
    throw new Error(`[DB] Failed to reserve tx proof: ${error.message}`);
  }

  const { data, error: readError } = await supabase
    .from('payment_tx_proofs')
    .select('status')
    .eq('tx_id', txId)
    .eq('scope', scope)
    .single();

  if (readError || !data) {
    throw new Error(`[DB] Failed to inspect duplicate tx proof: ${readError?.message ?? 'Unknown error'}`);
  }

  const row = data as TxProofRow;
  return row.status === 'consumed' ? 'already_used' : 'in_flight';
};

export const finalizeReservedTxProof = async (
  txId: string,
  scope: TxProofScope,
  consumed: boolean,
): Promise<void> => {
  const supabase = getSupabaseClient();

  if (consumed) {
    const { error } = await supabase
      .from('payment_tx_proofs')
      .update({ status: 'consumed', consumed_at: new Date().toISOString() })
      .eq('tx_id', txId)
      .eq('scope', scope);

    if (error) {
      throw new Error(`[DB] Failed to finalize tx proof as consumed: ${error.message}`);
    }

    return;
  }

  const { error } = await supabase
    .from('payment_tx_proofs')
    .delete()
    .eq('tx_id', txId)
    .eq('scope', scope)
    .eq('status', 'in_flight');

  if (error) {
    throw new Error(`[DB] Failed to release in-flight tx proof: ${error.message}`);
  }
};

export const consumeTxProofOnce = async (txId: string, scope: TxProofScope): Promise<boolean> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('payment_tx_proofs').insert({
    tx_id: txId,
    scope,
    status: 'consumed',
    consumed_at: new Date().toISOString(),
  });

  if (!error) {
    return true;
  }

  if (error.code === DUPLICATE_KEY_ERROR_CODE) {
    return false;
  }

  throw new Error(`[DB] Failed to persist consumed tx proof: ${error.message}`);
};
