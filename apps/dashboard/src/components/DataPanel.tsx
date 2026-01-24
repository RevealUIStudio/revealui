'use client'

import { useState } from 'react'

type QueryResult = {
  type: 'table' | 'chart' | 'text'
  data: any
  title: string
}

export function DataPanel() {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<QueryResult[]>([])

  const handleQuery = async () => {
    if (!query.trim()) return

    setIsLoading(true)

    // Simulate AI query processing
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock results based on query
    let mockResult: QueryResult

    if (query.toLowerCase().includes('page') && query.toLowerCase().includes('view')) {
      mockResult = {
        type: 'table',
        title: 'Page Performance Data',
        data: {
          headers: ['Page', 'Views', 'Bounce Rate', 'Avg. Time'],
          rows: [
            ['Homepage', '12,543', '34%', '2:34'],
            ['About', '3,421', '28%', '3:12'],
            ['Services', '8,765', '41%', '1:58'],
            ['Contact', '2,189', '52%', '1:23'],
          ],
        },
      }
    } else if (
      query.toLowerCase().includes('content') &&
      query.toLowerCase().includes('performance')
    ) {
      mockResult = {
        type: 'chart',
        title: 'Content Performance Trends',
        data: {
          type: 'line',
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [
            {
              label: 'Page Views',
              data: [1200, 1900, 3000, 5000, 2000, 3000],
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
            },
          ],
        },
      }
    } else {
      mockResult = {
        type: 'text',
        title: 'Query Result',
        data: `I analyzed your query: "${query}". This appears to be a request for data analysis. Try asking about page views, content performance, or user engagement metrics.`,
      }
    }

    setResults((prev) => [mockResult, ...prev.slice(0, 2)]) // Keep last 3 results
    setQuery('')
    setIsLoading(false)
  }

  const renderResult = (result: QueryResult) => {
    switch (result.type) {
      case 'table':
        return (
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">{result.title}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-600">
                    {result.data.headers.map((header: string, i: number) => (
                      <th key={i} className="text-left text-gray-300 font-medium py-2 px-3">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.rows.map((row: string[], i: number) => (
                    <tr key={i} className="border-b border-gray-700">
                      {row.map((cell: string, j: number) => (
                        <td key={j} className="text-gray-300 py-2 px-3">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'chart':
        return (
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">{result.title}</h4>
            <div className="h-48 bg-gray-700 rounded flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-2">📊</div>
                <p>Chart visualization would render here</p>
                <p className="text-xs mt-1">
                  {result.data.datasets[0].label}:{' '}
                  {result.data.datasets[0].data.slice(-1)[0].toLocaleString()} latest
                </p>
              </div>
            </div>
          </div>
        )

      case 'text':
        return (
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">{result.title}</h4>
            <p className="text-gray-300">{result.data}</p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Data & Analytics</h2>
      </div>

      {/* Query Input */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
            placeholder="Ask about your data... (e.g., 'Show me top performing pages')"
            className="flex-1 bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleQuery}
            disabled={isLoading || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Query
              </>
            )}
          </button>
        </div>

        {/* Query Suggestions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            'Show me top performing pages',
            "What's my bounce rate trend?",
            'Content performance analysis',
            'User engagement metrics',
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setQuery(suggestion)}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-2 py-1 rounded transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {results.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4">📈</div>
              <h3 className="text-xl font-medium mb-2">Data Insights</h3>
              <p className="text-sm">
                Ask questions about your website data, content performance, or user analytics. The
                AI will provide visualizations and insights.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index}>{renderResult(result)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
