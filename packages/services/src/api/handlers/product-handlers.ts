/**
 * Product and price record handlers for Stripe webhooks
 */

import { logger } from '@revealui/core/utils/logger';
import type Stripe from 'stripe';
import type { SupabaseClient } from '../../supabase/index.js';
import type { Database, TablesInsert } from '../../supabase/types.js';

export const upsertRecord = async <TTable extends keyof Database['public']['Tables']>(
  supabase: SupabaseClient<Database>,
  table: TTable,
  record: Database['public']['Tables'][TTable]['Insert'],
): Promise<void> => {
  // biome-ignore lint/suspicious/noExplicitAny: Supabase upsert type doesn't perfectly match our generated types, but is runtime-compatible
  const { error } = await supabase.from(table).upsert([record] as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (error) {
    logger.error('Error upserting record', { table: String(table), error });
    throw error;
  }
  logger.info('Record upserted', { table: String(table), record });
};

export const upsertProductRecord = async (
  supabase: SupabaseClient<Database>,
  product: Stripe.Product,
): Promise<void> => {
  const productData: TablesInsert<'products'> = {
    stripe_product_i_d: product.id,
    title: typeof product.name === 'string' ? product.name : (product.name as string),
    created_at: new Date(product.created * 1000).toISOString(),
    updated_at: new Date(product.updated * 1000).toISOString(),
    price_j_s_o_n: product.default_price
      ? typeof product.default_price === 'string'
        ? product.default_price
        : typeof product.default_price === 'object' &&
            product.default_price !== null &&
            'id' in product.default_price
          ? String((product.default_price as { id: string }).id)
          : String(product.default_price)
      : null,
  };

  await upsertRecord(supabase, 'products', productData);
};

export const upsertPriceRecord = async (
  supabase: SupabaseClient<Database>,
  price: Stripe.Price,
): Promise<void> => {
  const priceData: TablesInsert<'prices'> = {
    price_j_s_o_n: price.id.toString(),
  };

  await upsertRecord(supabase, 'prices', priceData);
};

export const toDateTime = (secs: number): Date => {
  const t = new Date(1970, 0, 1);
  t.setSeconds(secs);
  return t;
};
