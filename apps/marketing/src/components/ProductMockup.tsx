export function ProductMockup() {
  const navItems = [
    { label: 'Posts', active: true },
    { label: 'Pages', active: false },
    { label: 'Media', active: false },
    { label: 'Users', active: false },
    { label: 'Categories', active: false },
  ]

  const globals = ['Settings', 'Header', 'Footer']

  const posts = [
    { title: 'Getting Started with RevealUI', status: 'published', date: 'Mar 4', author: 'AK' },
    { title: 'Building Multi-Tenant Apps', status: 'published', date: 'Mar 2', author: 'SL' },
    { title: 'AI Agent Workflows', status: 'draft', date: 'Mar 1', author: 'AK' },
    { title: 'Real-Time Sync with ElectricSQL', status: 'published', date: 'Feb 28', author: 'MR' },
    { title: 'White-Label CMS Guide', status: 'draft', date: 'Feb 25', author: 'SL' },
  ]

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Browser chrome */}
      <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-gray-900/10">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 border-b border-gray-200">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-4">
            <div className="flex items-center gap-2 bg-white rounded-md px-3 py-1 text-xs text-gray-500 ring-1 ring-gray-200">
              <svg
                className="h-3 w-3 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <title>Lock</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              cms.yourdomain.com/admin
            </div>
          </div>
          <div className="text-xs text-gray-400 font-medium">v1.0.0</div>
        </div>

        {/* Admin UI */}
        <div className="flex bg-white" style={{ minHeight: '420px' }}>
          {/* Sidebar */}
          <div className="w-48 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
            <div className="px-4 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">R</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">RevealUI</span>
              </div>
            </div>

            <nav className="flex-1 px-2 py-3">
              <p className="px-2 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Collections
              </p>
              {navItems.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs mb-0.5 cursor-default ${
                    item.active
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${item.active ? 'bg-blue-600' : 'bg-gray-300'}`}
                  />
                  {item.label}
                </div>
              ))}

              <p className="px-2 mt-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Globals
              </p>
              {globals.map((g) => (
                <div
                  key={g}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-600 mb-0.5 cursor-default"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                  {g}
                </div>
              ))}

              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-600">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <title>Agents</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                    />
                  </svg>
                  AI Agents
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-600">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <title>Monitoring</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z"
                    />
                  </svg>
                  Monitoring
                </div>
              </div>
            </nav>

            <div className="px-3 py-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-semibold">
                  AK
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">alex@acmecorp.io</p>
                  <p className="text-xs text-blue-600">Pro</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h1 className="text-base font-semibold text-gray-900">Posts</h1>
                <p className="text-xs text-gray-500">5 entries</p>
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <title>New</title>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Post
              </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-2.5 font-medium text-gray-500 w-full">
                      Title
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">
                      Date
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Author</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post, i) => (
                    <tr
                      key={post.title}
                      className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30`}
                    >
                      <td className="px-6 py-3 font-medium text-gray-900">{post.title}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            post.status === 'published'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${post.status === 'published' ? 'bg-green-500' : 'bg-amber-500'}`}
                          />
                          {post.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{post.date}</td>
                      <td className="px-4 py-3">
                        <div
                          className={`h-5 w-5 rounded-full flex items-center justify-center text-white text-xs font-semibold ${post.author === 'SL' ? 'bg-emerald-500' : post.author === 'MR' ? 'bg-violet-500' : 'bg-indigo-500'}`}
                        >
                          {post.author}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
