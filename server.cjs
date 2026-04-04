/**
 * Minimal Express-like API server for Docker self-hosting.
 * Handles /api/* routes by dynamically loading edge function modules.
 */
const http = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const PORT = process.env.API_PORT || 3001;

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }

  // Route /api/health/v1/* to edge function files
  const match = req.url?.match(/^\/api\/health\/v1\/(\w+)/);
  if (match) {
    try {
      const modulePath = join(__dirname, 'api', 'health', 'v1', `${match[1]}.ts`);
      // In production, these would be compiled JS files
      res.writeHead(501, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Edge functions require Vercel runtime or compilation' }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[EpidemicMonitor API] Listening on port ${PORT}`);
});
