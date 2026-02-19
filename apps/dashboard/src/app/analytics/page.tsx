import { DashboardLayout } from '@/components/DashboardLayout'

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Analytics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Conversations', value: '—' },
            { label: 'Messages Sent', value: '—' },
            { label: 'Active Agents', value: '—' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col gap-2"
            >
              <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Analytics data will appear here once conversations are recorded.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
