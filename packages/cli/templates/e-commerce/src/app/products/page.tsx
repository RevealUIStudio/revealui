import { Heading, LinkButton, Text } from '@revealui/presentation';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  status: string;
  image?: { url: string; alt?: string } | null;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function getProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_URL}/api/products?where[status][equals]=active&sort=name`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.docs ?? [];
  } catch {
    return [];
  }
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <Heading className="mb-8">Products</Heading>

      {products.length === 0 ? (
        <Text>
          No products yet. Add products in the{' '}
          <LinkButton href="/admin/collections/products" appearance="link" size="sm">
            admin panel
          </LinkButton>
          , or run <code className="rounded bg-gray-100 px-1">pnpm db:seed</code> to add sample
          data.
        </Text>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <LinkButton
              key={product.id}
              href={`/products/${product.slug}`}
              appearance="link"
              className="h-auto flex-col items-start rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
            >
              {product.image?.url && (
                <Image
                  src={product.image.url}
                  alt={product.image.alt || product.name}
                  width={400}
                  height={400}
                  className="mb-4 aspect-square w-full rounded object-cover"
                />
              )}
              <Heading level={2} className="text-base">
                {product.name}
              </Heading>
              <Text className="mt-1 text-lg font-bold">{formatPrice(product.price)}</Text>
            </LinkButton>
          ))}
        </div>
      )}
    </main>
  );
}
