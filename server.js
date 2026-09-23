const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, 'public');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const vinRequests = [];
const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/;

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(payload));
}

async function lookupVin(vin, fetcher = fetch) {
  if (!vinPattern.test(vin)) throw new Error('Enter a valid 17-character VIN.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetcher(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, { signal: controller.signal });
    if (!upstream.ok) throw new Error('NHTSA lookup is unavailable. Try again later.');
    const result = (await upstream.json()).Results?.[0];
    if (!result || String(result.ErrorCode ?? '') !== '0') throw new Error('NHTSA could not decode this VIN. Check it or enter the vehicle details manually.');
    const year = Number(result.ModelYear);
    const make = String(result.Make || '').trim().slice(0, 40);
    const modelName = String(result.Model || '').trim().slice(0, 60);
    if (!Number.isInteger(year) || year < 1980 || year > 2100 || !make) throw new Error('NHTSA returned incomplete vehicle details. Enter them manually.');
    return { year, make, model: modelName, partial: !modelName };
  } finally { clearTimeout(timer); }
}

async function decodeVin(request, response) {
  const origin = request.headers.origin;
  if (origin && origin !== `http://${request.headers.host}`) return sendJson(response, 403, { error: 'Requests must come from this localhost app.' });
  if (!/^\s*application\/json(?:\s*;|\s*$)/i.test(request.headers['content-type'] || '')) return sendJson(response, 415, { error: 'Send JSON data.' });
  const now = Date.now();
  while (vinRequests.length && now - vinRequests[0] > 60000) vinRequests.shift();
  if (vinRequests.length >= 10) return sendJson(response, 429, { error: 'Please wait before looking up another VIN.' });
  try {
    let raw = '';
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 1000) return sendJson(response, 413, { error: 'VIN request is too large.' });
    }
    const vin = JSON.parse(raw)?.vin;
    if (typeof vin !== 'string' || !vinPattern.test(vin)) return sendJson(response, 400, { error: 'Enter a valid 17-character VIN.' });
    vinRequests.push(now);
    return sendJson(response, 200, await lookupVin(vin));
  } catch (error) {
    return sendJson(response, error.name === 'SyntaxError' ? 400 : 502, { error: error.name === 'SyntaxError' ? 'Invalid JSON.' : error.message?.startsWith('NHTSA') ? error.message : 'VIN lookup failed. Try again or enter vehicle details manually.' });
  }
}

function serveStatic(request, response) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); response.end(); return; }
  const file = path.resolve(publicDir, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (file !== publicDir && !file.startsWith(`${publicDir}${path.sep}`)) { response.writeHead(403); response.end(); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(response);
  });
}

function createServer() {
  return http.createServer((request, response) => {
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host || '')) return sendJson(response, 403, { error: 'Localhost only.' });
    if (request.method === 'POST' && request.url === '/api/decode-vin') return void decodeVin(request, response);
    if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Method not allowed.' });
    serveStatic(request, response);
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  createServer().listen(port, '127.0.0.1', () => console.log(`DriveDiag: http://127.0.0.1:${port}`));
}

module.exports = { createServer, lookupVin };
