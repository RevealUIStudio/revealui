import { useEffect, useState } from 'react';
import { Footer } from '../components/Footer';
import { WhitepaperRenderer } from '../components/WhitepaperRenderer';

const FALLBACK = '# Whitepaper\n\nFailed to load whitepaper. Please try again later.';

export function WhitepaperPage() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWhitepaper() {
      try {
        const response = await fetch('/whitepaper.md');
        if (!response.ok) {
          throw new Error(`Failed to load whitepaper: ${response.status}`);
        }
        const text = await response.text();
        setContent(text);
      } catch {
        setContent(FALLBACK);
      } finally {
        setLoading(false);
      }
    }

    loadWhitepaper();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-8 w-2/3 rounded bg-gray-200" />
              <div className="h-4 w-full rounded bg-gray-200" />
              <div className="h-4 w-5/6 rounded bg-gray-200" />
              <div className="h-4 w-3/4 rounded bg-gray-200" />
            </div>
          ) : (
            <WhitepaperRenderer content={content} />
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
