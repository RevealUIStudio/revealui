// Simple demo server for ElectricSQL sync testing using Hono
// Serves the HTML demo and proxies ElectricSQL shapes API

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Hono();
const PORT = 3002;

// Serve static files
app.use(
  '/electric-demo.html',
  serveStatic({
    path: path.join(__dirname, 'electric-demo.html'),
  }),
);

// Proxy ElectricSQL shapes API to avoid CORS issues
app.use('/api/shapes/*', async (c) => {
  try {
    const url = new URL(c.req.url);
    const targetUrl = `http://localhost:4000${url.pathname}${url.search}`;

    const response = await fetch(targetUrl);
    const data = await response.json();

    return c.json(data);
  } catch (error) {
    console.log('Proxy error:', error.message);
    // Return mock data for demo purposes
    return c.json([
      { id: '1', title: 'Demo Conversation 1', user_id: '1', created_at: new Date().toISOString() },
      { id: '2', title: 'Demo Conversation 2', user_id: '1', created_at: new Date().toISOString() },
    ]);
  }
});

console.log(`🚀 ElectricSQL Demo Server running at http://localhost:${PORT}`);
console.log(`📄 Open http://localhost:${PORT}/electric-demo.html in your browser`);
console.log(`⚡ ElectricSQL is running at http://localhost:3001`);
console.log(`🔄 Test real-time sync by opening the demo in multiple tabs`);

serve({
  fetch: app.fetch,
  port: PORT,
});
