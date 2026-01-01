import type { Get, UniversalHandler } from "@universal-middleware/core";

// Placeholder handler - replace with actual RevealUI SSR implementation
export const revealuiHandler: Get<[], UniversalHandler> = () => async (request) => {
  const url = new URL(request.url);
  
  // Return a simple HTML response for now
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RevealUI Web</title>
</head>
<body>
  <h1>RevealUI Web App</h1>
  <p>Path: ${url.pathname}</p>
  <p>This is a placeholder. Configure your routes in hono-entry.ts</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
    },
  });
};
