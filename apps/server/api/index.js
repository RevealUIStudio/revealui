// Vercel serverless function entry point
// Uses @hono/node-server/vercel adapter to convert Hono app to Node.js handler
import { handle } from '@hono/node-server/vercel';
import app from '../dist/index.js';

const honoHandler = handle(app);

/**
 * Pre-buffer the request body before passing to the Hono adapter.
 *
 * @hono/node-server/vercel checks `incoming.rawBody` first. If it's a Buffer,
 * the adapter wraps it in a ReadableStream and never touches the underlying
 * Node.js stream. Without this step, `Readable.toWeb(incoming)` produces a
 * stream that hangs in Vercel's serverless environment because the runtime
 * puts the IncomingMessage stream in a state where it never emits "end".
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !req.rawBody) {
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    req.rawBody = Buffer.concat(chunks);
  }
  return honoHandler(req, res);
}
