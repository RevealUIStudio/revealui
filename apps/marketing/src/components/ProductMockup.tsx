'use client';

import Image from 'next/image';
import { useState } from 'react';

const SCREENSHOTS = [
  { src: '/screenshots/cms-dashboard.png', label: 'Dashboard' },
  { src: '/screenshots/cms-content.png', label: 'Content' },
  { src: '/screenshots/cms-editor-new.png', label: 'Editor' },
  { src: '/screenshots/cms-users-list.png', label: 'Users' },
  { src: '/screenshots/cms-agents.png', label: 'AI Agents' },
  { src: '/screenshots/cms-billing.png', label: 'Billing' },
  { src: '/screenshots/cms-monitoring.png', label: 'Monitoring' },
  { src: '/screenshots/api-swagger.png', label: 'API' },
];

export function ProductMockup() {
  const [activeTab, setActiveTab] = useState(0);
  const codeLines = [
    {
      tokens: [
        { t: 'keyword', v: 'import' },
        { t: 'plain', v: ' { buildConfig } ' },
        { t: 'keyword', v: 'from' },
        { t: 'string', v: " '@revealui/core'" },
      ],
    },
    { tokens: [] },
    {
      tokens: [
        { t: 'keyword', v: 'export default' },
        { t: 'plain', v: ' buildConfig({' },
      ],
    },
    {
      tokens: [
        { t: 'prop', v: '  collections' },
        { t: 'plain', v: ': [Posts, Products, Orders],' },
      ],
    },
    {
      tokens: [
        { t: 'prop', v: '  plugins' },
        { t: 'plain', v: ': [' },
      ],
    },
    {
      tokens: [
        { t: 'fn', v: '    stripePlugin' },
        { t: 'plain', v: '({ webhookSecret }),' },
      ],
    },
    {
      tokens: [
        { t: 'fn', v: '    vercelBlobStorage' },
        { t: 'plain', v: '({ token }),' },
      ],
    },
    { tokens: [{ t: 'plain', v: '  ],' }] },
    {
      tokens: [
        { t: 'prop', v: '  db' },
        { t: 'plain', v: ': ' },
        { t: 'fn', v: 'universalPostgresAdapter' },
        { t: 'plain', v: '({ connectionString: url }),' },
      ],
    },
    {
      tokens: [
        { t: 'prop', v: '  auth' },
        { t: 'plain', v: ': { sessions: true, rateLimit: true },' },
      ],
    },
    { tokens: [{ t: 'plain', v: '})' }] },
  ];

  const tokenColor: Record<string, string> = {
    keyword: 'text-purple-400',
    string: 'text-green-400',
    prop: 'text-blue-300',
    fn: 'text-yellow-300',
    plain: 'text-gray-300',
  };

  return (
    <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left: Admin UI browser */}
      <div className="lg:col-span-3 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-gray-900/10">
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
              cms.revealui.com/admin
            </div>
          </div>
        </div>

        {/* Screenshot tabs */}
        <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 overflow-x-auto">
          {SCREENSHOTS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                i === activeTab
                  ? 'bg-white text-gray-900 font-medium shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Real screenshot */}
        <div className="relative bg-gray-100" style={{ minHeight: '380px' }}>
          <Image
            src={SCREENSHOTS[activeTab]?.src ?? ''}
            alt={`RevealUI Admin — ${SCREENSHOTS[activeTab]?.label ?? ''}`}
            fill
            className="object-cover object-top"
            sizes="(max-width: 1024px) 100vw, 60vw"
            priority
          />
        </div>
      </div>

      {/* Right: Code panel */}
      <div className="lg:col-span-2 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-gray-900/10 bg-gray-950 flex flex-col">
        {/* Tab bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/60" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <div className="h-3 w-3 rounded-full bg-green-500/60" />
          </div>
          <div className="ml-3 flex items-center gap-1 rounded-md bg-gray-800 px-3 py-1 text-xs text-gray-400">
            <span className="text-blue-400">revealui</span>
            <span className="text-gray-600">/</span>
            <span>config.ts</span>
          </div>
        </div>

        {/* Code */}
        <div className="flex-1 px-5 py-5 font-mono text-xs leading-6 overflow-hidden">
          {codeLines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static display list, no reordering
            <div key={i} className="flex">
              <span className="select-none w-6 shrink-0 text-gray-600 text-right mr-4">
                {i + 1}
              </span>
              <span>
                {line.tokens.length === 0 ? (
                  <span>&nbsp;</span>
                ) : (
                  line.tokens.map((tok, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static display list, no reordering
                    <span key={j} className={tokenColor[tok.t] ?? 'text-gray-300'}>
                      {tok.v}
                    </span>
                  ))
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Status bar */}
        <div className="px-5 py-2 bg-blue-600/20 border-t border-gray-800 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-xs text-gray-400 font-mono">TypeScript · RevealUI v0.5.2</span>
        </div>
      </div>
    </div>
  );
}
