import { DashboardLayout } from '@/components/DashboardLayout'

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
          {[
            { label: 'LLM Provider', value: process.env.LLM_PROVIDER ?? 'openai' },
            {
              label: 'CMS API URL',
              value: process.env.NEXT_PUBLIC_CMS_URL ?? 'http://localhost:4000',
            },
            { label: 'API URL', value: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3004' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-6 py-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{value}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          Configuration is read from environment variables. Edit <code>.env.local</code> to change
          these values.
        </p>
      </div>
    </DashboardLayout>
  )
}
