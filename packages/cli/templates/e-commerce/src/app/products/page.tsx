const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  status: string
  image?: { url: string; alt?: string } | null
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

async function getProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_URL}/api/products?where[status][equals]=active&sort=name`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.docs ?? []
  } catch {
    return []
  }
}

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-8 text-3xl font-bold">Products</h1>

      {products.length === 0 ? (
        <p className="text-gray-500">
          No products yet. Add products in the{' '}
          <a href="/admin/collections/products" className="text-blue-600 underline">
            admin panel
          </a>
          , or run <code className="rounded bg-gray-100 px-1">pnpm db:seed</code> to add sample
          data.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.slug}`}
              className="group rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
            >
              {product.image?.url && (
                <img
                  src={product.image.url}
                  alt={product.image.alt || product.name}
                  className="mb-4 aspect-square w-full rounded object-cover"
                />
              )}
              <h2 className="font-semibold group-hover:text-blue-600">{product.name}</h2>
              <p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(product.price)}</p>
            </a>
          ))}
        </div>
      )}
    </main>
  )
}
