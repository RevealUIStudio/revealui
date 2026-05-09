import { Footer } from '../components/Footer';
import { REVEALCOIN_RESUME_TARGET } from '../lib/parked-config';

const PREREQUISITES = [
  'On-chain Anchor vesting program built and audited (Trail of Bits / OtterSec)',
  'Hardware-wallet-backed mint authority via 3-of-5 Squads multisig',
  'Token classification opinion from securities counsel (US + EU)',
  'Adversarial test suite (replay, race, property-based token math)',
  'Bounded RVC_INITIAL_PRICE with min/max + dual-confirm env vars',
];

/**
 * Single-page placeholder rendered while `REVEALCOIN_PARKED === true`.
 *
 * Replaces the historical 5-route marketing/dashboard surface with one honest
 * notice that names the parking decision and the resumption preconditions.
 * The historical pages (`HomePage`, `TokenomicsPage`, `ExplorerPage`,
 * `WhitepaperPage`) remain on disk so un-parking is a single-flag flip in
 * `lib/parked-config.ts`.
 */
export function ParkedPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="flex flex-col items-center justify-center px-6 py-32 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">
          RevealCoin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
          Parked until {REVEALCOIN_RESUME_TARGET}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-gray-600">
          The RevealCoin dashboard is paused while the prerequisites for honest public-facing token
          messaging are completed. The token has not been deployed to Solana mainnet, and the prior
          dashboard surface implied forward marketing progress that the underlying state does not
          support.
        </p>

        <div className="mt-10 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-6 py-5 text-left text-sm text-amber-900">
          <p className="font-semibold">Resumption requires all of:</p>
          <ul className="mt-3 space-y-2">
            {PREREQUISITES.map((item) => (
              <li key={item} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-amber-800">
            Until then, the only customer-facing token surface is the broader RevealUI roadmap.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://revealui.com"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Visit RevealUI
          </a>
          <a
            href="https://github.com/RevealUIStudio/revealcoin"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg ring-1 ring-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-950 hover:ring-gray-300"
          >
            View source
          </a>
        </div>
      </section>
      <Footer />
    </div>
  );
}
