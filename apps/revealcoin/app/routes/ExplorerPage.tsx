import { useEffect, useState } from 'react';
import { Footer } from '../components/Footer';
import { type CoinAllocation, fetchCoinAllocations, fetchCoinSupply } from '../lib/api';
import {
  DEPLOY_DATE,
  EXPLORER_URL,
  formatNumber,
  MINT_ADDRESS,
  RVUI_ALLOCATIONS,
  TOTAL_SUPPLY_DISPLAY,
  truncateAddress,
} from '../lib/constants';

export function ExplorerPage() {
  const [supply, setSupply] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<CoinAllocation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [supplyData, allocData] = await Promise.all([
          fetchCoinSupply(),
          fetchCoinAllocations(),
        ]);
        setSupply(supplyData.totalSupply);
        setAllocations(allocData.allocations);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">
              Explorer
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              On-Chain Data
            </h1>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              Live token data from Solana mainnet.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="mx-auto mt-16 max-w-4xl grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Total Supply"
              value={supply ? Number(supply).toLocaleString('en-US') : TOTAL_SUPPLY_DISPLAY}
              loading={loading}
            />
            <StatCard
              label="Mint Address"
              value={truncateAddress(MINT_ADDRESS, 6)}
              mono
              loading={false}
            />
            <StatCard label="Deployed" value={DEPLOY_DATE} loading={false} />
            <StatCard label="Program" value="Token-2022" loading={false} />
          </div>

          {error && (
            <p className="mx-auto mt-8 max-w-4xl text-center text-sm text-red-500">{error}</p>
          )}

          {/* Allocation Wallet Cards */}
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-950">Allocation Wallets</h2>
              <a
                href={EXPLORER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-600 hover:underline"
              >
                View mint on Explorer
              </a>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {RVUI_ALLOCATIONS.map((alloc) => {
                const totalHuman = Number(alloc.amount / 1_000_000n);
                const liveBalance = allocations?.find((a) => a.wallet === alloc.wallet);
                const balanceDisplay = liveBalance
                  ? formatNumber(liveBalance.balance)
                  : loading
                    ? '...'
                    : formatNumber(totalHuman);
                const percentage = liveBalance
                  ? Math.round((liveBalance.balance / totalHuman) * 100)
                  : 100;

                return (
                  <div key={alloc.wallet} className="rounded-xl ring-1 ring-gray-950/5 p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-950">{alloc.name}</h3>
                      <span className="text-xs font-mono text-gray-400">{alloc.percentage}%</span>
                    </div>
                    <p className="mt-2 text-lg font-bold font-mono text-gray-950">
                      {balanceDisplay}
                    </p>
                    <p className="text-xs text-gray-500">of {formatNumber(totalHuman)} RVC</p>

                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full bg-violet-500 transition-all duration-500"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <a
                        href={`https://explorer.solana.com/address/${alloc.wallet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-violet-600 hover:underline"
                      >
                        {truncateAddress(alloc.wallet, 4)}
                      </a>
                      <span className="text-xs text-gray-400">
                        {alloc.vestingDescription.split(',')[0]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

function StatCard({
  label,
  value,
  loading = false,
  mono = false,
}: {
  label: string;
  value: string;
  loading?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      {loading ? (
        <div className="mt-1 h-6 w-24 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className={`mt-1 text-sm font-semibold text-gray-950 ${mono ? 'font-mono' : ''}`}>
          {value}
        </p>
      )}
    </div>
  );
}
