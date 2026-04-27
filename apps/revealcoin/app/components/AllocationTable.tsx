import { formatNumber, RVUI_ALLOCATIONS, truncateAddress } from '@/lib/constants';

export function AllocationTable() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Allocation
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
              %
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
              Amount (RVC)
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">
              Wallet
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">
              Vesting
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {RVUI_ALLOCATIONS.map((alloc) => {
            const humanAmount = Number(alloc.amount / 1_000_000n);
            return (
              <tr key={alloc.name} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-950">{alloc.name}</td>
                <td className="px-4 py-3 text-right text-sm font-mono text-gray-600">
                  {alloc.percentage}%
                </td>
                <td className="px-4 py-3 text-right text-sm font-mono text-gray-600">
                  {formatNumber(humanAmount)}
                </td>
                <td className="hidden px-4 py-3 text-sm sm:table-cell">
                  <a
                    href={`https://explorer.solana.com/address/${alloc.wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-violet-600 hover:underline"
                  >
                    {truncateAddress(alloc.wallet, 6)}
                  </a>
                </td>
                <td className="hidden px-4 py-3 text-sm text-gray-500 md:table-cell">
                  {alloc.vestingDescription}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
