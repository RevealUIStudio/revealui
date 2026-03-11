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
        <h1 className="text-2xl font-bold">Product not found</h1>
        <p className="mt-4">
          <a href="/products" className="text-accent underline">
            Back to products
          </a>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <nav className="mb-8">
        <a href="/products" className="text-sm text-accent underline">
          &larr; Back to products
        </a>
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
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatPrice(product.price)}</p>
          <div className="prose mt-6">
            {typeof product.description === 'string' ? (
              <p>{product.description}</p>
            ) : (
              <p className="text-gray-500">Product description will render here.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
