import { Heading, LinkButton, Text } from '@revealui/presentation';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: unknown;
  price: number;
  status: string;
  image?: { url: string; alt?: string } | null;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_URL}/api/products?where[slug][equals]=${slug}&limit=1`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.docs?.[0] ?? null;
  } catch {
    return null;
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <Heading>Product not found</Heading>
        <Text className="mt-4">
          <LinkButton href="/products" appearance="link" size="sm">
            Back to products
          </LinkButton>
        </Text>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <nav className="mb-8">
        <LinkButton href="/products" appearance="link" size="sm">
          Back to products
        </LinkButton>
      </nav>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {product.image?.url && (
          <Image
            src={product.image.url}
            alt={product.image.alt || product.name}
            width={600}
            height={600}
            className="aspect-square w-full rounded-lg object-cover"
          />
        )}
        <div>
          <Heading>{product.name}</Heading>
          <Text className="mt-2 text-2xl font-bold">{formatPrice(product.price)}</Text>
          <div className="prose mt-6">
            {typeof product.description === 'string' ? (
              <Text>{product.description}</Text>
            ) : (
              <Text className="text-gray-500">Product description will render here.</Text>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
