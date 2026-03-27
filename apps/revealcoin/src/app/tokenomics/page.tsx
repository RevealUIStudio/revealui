import type { Metadata } from 'next';
import { AllocationTable } from '@/components/AllocationTable';
import { Footer } from '@/components/Footer';
import { TokenomicsChart } from '@/components/TokenomicsChart';
import { VestingTracker } from '@/components/VestingTracker';
import { RVUI_DISCOUNT_RATES } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Tokenomics — RevealCoin',
  description:
    'Distribution, vesting schedules, emission rates, and discount structure for RevealCoin (RVC).',
};

export default function TokenomicsPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">
              Tokenomics
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              Distribution & Economics
            </h1>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              58,906,000,000 RVC — fixed supply, no inflation, transparent allocation.
            </p>
          </div>

          {/* Chart */}
          <div className="mx-auto mt-16 max-w-4xl rounded-2xl bg-white p-8 ring-1 ring-gray-950/5">
            <TokenomicsChart />
          </div>

          {/* Table */}
          <div className="mx-auto mt-16 max-w-5xl">
            <h2 className="text-xl font-bold text-gray-950 mb-6">Allocation Breakdown</h2>
            <div className="rounded-2xl ring-1 ring-gray-950/5 overflow-hidden">
              <AllocationTable />
            </div>
          </div>

          {/* Vesting Tracker */}
          <div className="mx-auto mt-16 max-w-4xl">
            <h2 className="text-xl font-bold text-gray-950 mb-6">Vesting Tracker</h2>
            <VestingTracker />
          </div>

          {/* Discounts */}
          <div className="mx-auto mt-16 max-w-4xl">
            <h2 className="text-xl font-bold text-gray-950 mb-6">RVC Payment Discounts</h2>
            <div className="rounded-2xl ring-1 ring-gray-950/5 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Service
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Discount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.values(RVUI_DISCOUNT_RATES).map((rate) => (
                    <tr key={rate.service} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-950">{rate.service}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">
                        {rate.discountPercent}% off
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
