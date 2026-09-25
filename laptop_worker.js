process.stdout?.on?.('error', () => {});
process.stderr?.on?.('error', () => {});
process.on('uncaughtException', (err) => {
  if (err?.code === 'EPIPE' || err?.code === 'EBADF') return;
  console.error(err);
});
require('dotenv').config();
const http = require('http');
const os = require('os');
const { executeTool } = require('./src/tools/local_executor');
const { handleDlTool } = require('./src/tools/dl_tools');

const PORT = parseInt(process.env.WORKER_PORT || '20130', 10);
const SECRET = process.env.WORKER_SECRET || 'hermes-tailscale-secret';

const server = http.createServer(async (req, res) => {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      device: 'laptop-windows',
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: os.uptime(),
      timestamp: Date.now()
    }));
  }

  if (req.method === 'GET' && url.pathname === '/api/gpu') {
    const gpuInfo = handleDlTool('cek_gpu', {});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ gpu: gpuInfo }));
  }

  if (req.method === 'POST' && url.pathname === '/api/execute-tool') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');

        const reqSecret = req.headers['authorization']?.replace(/^Bearer\s+/i, '') || payload.secret;
        if (SECRET && reqSecret !== SECRET) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Unauthorized: Invalid worker secret token' }));
        }

        const { name, args } = payload;
        if (!name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Tool name is required' }));
        }

        console.log(`[Worker] Menjalankan tool dari Server: "${name}"...`);
        const result = await executeTool(name, args || {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, result }));
      } catch (err) {
        console.error('[Worker Error]:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================');
  console.log(`⚡ Hermes Laptop Bridge Worker Aktif!`);
  console.log(`📡 Port: ${PORT} (Listening on 0.0.0.0)`);
  console.log(`🔒 Secret Token: ${SECRET ? 'AKTIF' : 'OFF'}`);
  console.log(`💻 Device: ${os.hostname()} (${os.platform()})`);
  console.log(`🌐 Siap menerima perintah dari Server via Tailscale!`);
  console.log('==================================================');
});

