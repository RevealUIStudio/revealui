/**
 * Seed script for the e-commerce template.
 * Creates 3 sample products via the RevealUI REST API.
 *
 * Usage: pnpm db:seed (requires the dev server to be running)
 */

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

interface SeedProduct {
  name: string;
  slug: string;
  description: string;
  price: number;
  status: string;
}

const products: SeedProduct[] = [
  {
    name: 'Wireless Headphones',
    slug: 'wireless-headphones',
    description:
      'Premium wireless headphones with active noise cancellation and 30-hour battery life.',
    price: 9999,
    status: 'active',
  },
  {
    name: 'Mechanical Keyboard',
    slug: 'mechanical-keyboard',
    description:
      'Compact 75% mechanical keyboard with hot-swappable switches and RGB backlighting.',
    price: 14999,
    status: 'active',
  },
  {
    name: 'USB-C Hub',
    slug: 'usb-c-hub',
    description: '7-in-1 USB-C hub with HDMI, USB-A, SD card reader, and 100W power delivery.',
    price: 4999,
    status: 'active',
  },
];

const log = (...args: unknown[]) => process.stdout.write(`${args.join(' ')}\n`);
const logErr = (...args: unknown[]) => process.stderr.write(`${args.join(' ')}\n`);

async function seed(): Promise<void> {
  log(`Seeding products to ${API_URL}...`);

  for (const product of products) {
    try {
      // Idempotency: skip if a product with this slug already exists. Lets
      // users re-run `pnpm db:seed` after a failed first attempt without
      // duplicating rows or tripping UNIQUE constraints.
      const existing = await fetch(
        `${API_URL}/api/products?where[slug][equals]=${encodeURIComponent(product.slug)}`,
      );
      if (existing.ok) {
        const json = (await existing.json()) as { docs?: unknown[] } | unknown[];
        const docs = Array.isArray(json) ? json : (json.docs ?? []);
        if (docs.length > 0) {
          log(`  Exists (skipped): ${product.name}`);
          continue;
        }
      }

      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });

      if (res.ok) {
        log(`  Created: ${product.name}`);
      } else if (res.status === 409) {
        log(`  Exists (409 conflict): ${product.name}`);
      } else {
        const error = await res.text();
        logErr(`  Failed to create "${product.name}": ${error}`);
      }
    } catch (err) {
      logErr(`  Error creating "${product.name}":`, err);
    }
  }

  log('Seeding complete.');
}

seed();
