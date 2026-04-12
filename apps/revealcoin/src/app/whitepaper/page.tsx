import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { WhitepaperRenderer } from '@/components/WhitepaperRenderer';

export const metadata: Metadata = {
  title: 'Whitepaper  -  RevealCoin',
  description:
    'RevealCoin (RVC): A Hybrid Utility, Governance, and Reward Token for the RevealUI Ecosystem.',
};

function loadWhitepaper(): string {
  try {
    const filePath = join(process.cwd(), 'public', 'whitepaper.md');
    return readFileSync(filePath, 'utf-8');
  } catch {
    return '# Whitepaper\n\nWhitepaper content is being loaded. Please check back shortly.';
  }
}

export default function WhitepaperPage() {
  const content = loadWhitepaper();

  return (
    <div className="min-h-screen bg-white">
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <WhitepaperRenderer content={content} />
        </div>
      </section>
      <Footer />
    </div>
  );
}
