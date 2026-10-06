import type { RevealDocument, RevealValue } from '@revealui/core/types';
import type { OrderStatus } from '@revealui/db/schema/products';

export interface OrderCollectionItem extends Record<string, RevealValue> {
  productId: string;
  title: string;
  quantity: number;
  priceInCents: number;
}

export interface OrderCollectionDocument extends RevealDocument {
  id: string;
  customerId: string;
  status: OrderStatus;
  totalInCents: number;
  currency: string;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  items: OrderCollectionItem[];
  shippingAddress: Record<string, RevealValue> | null;
  metadata: Record<string, RevealValue> | null;
  createdAt: string;
  updatedAt: string;
}
