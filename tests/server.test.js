const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer, validateSnapshot, lookupVin, describeGeminiError, resolveGeminiModel } = require('../server.js');

test('Gemini defaults to 3.5 Flash-Lite and accepts a models/ prefix override', () => {
  assert.equal(resolveGeminiModel(''), 'gemini-3.5-flash-lite');
  assert.equal(resolveGeminiModel('models/gemini-3.5-flash-lite'), 'gemini-3.5-flash-lite');
});

test('Gemini failures identify the actual category without disclosing the key', () => {
  assert.match(describeGeminiError(400, { error: { status: 'FAILED_PRECONDITION', message: 'Free tier is not available in this region.' } }), /key or region.*Free tier is not available/s);
  assert.match(describeGeminiError(404, { error: { status: 'NOT_FOUND', message: 'Model unavailable' } }, 'custom-model'), /custom-model.*Model unavailable/s);
  assert.match(describeGeminiError(400, { error: { status: 'INVALID_ARGUMENT', message: 'Unknown field: thinkingConfig' } }), /INVALID_ARGUMENT.*thinkingConfig/s);
  assert.match(describeGeminiError(403, { error: { status: 'PERMISSION_DENIED', message: 'Key abc-private-key is restricted' } }, 'test-model', 'abc-private-key'), /\[redacted key\]/);
  assert.doesNotMatch(describeGeminiError(403, { error: { message: 'Key abc-private-key is restricted' } }, 'test-model', 'abc-private-key'), /abc-private-key/);
  assert.match(describeGeminiError(429, undefined), /quota or rate limit/);
});

test('snapshot validation strips extra fields and rejects malformed codes', () => {
  const input = { source: 'vehicle', vehicle: { year: 2012, make: 'Honda', model: 'Civic', vin: 'DO-NOT-SEND' }, codes: [{ code: 'p0171', status: 'Pending' }], sensors: [{ id: 'coolant', name: 'Coolant', value: 195, unit: '°F' }], device: 'VEEPEAK' };
  const output = validateSnapshot(input);
  assert.equal(output.codes[0].code, 'P0171');
  assert.equal(output.vehicle.make, 'Honda');
  assert.equal(output.vehicle.vin, undefined);
  assert.equal(output.device, undefined);
  assert.equal(validateSnapshot({ ...input, codes: [{ code: 'not-a-code' }] }), null);
});

test('VIN lookup returns only year, make, and model from NHTSA', async () => {
  const vin = '1HGCM82633A004352';
  let requested;
  const vehicle = await lookupVin(vin, async (url) => {
    requested = url;
    return { ok: true, json: async () => ({ Results: [{ ErrorCode: '0', Make: 'HONDA', Model: 'Accord', ModelYear: '2003', VIN: vin, PlantCountry: 'USA' }] }) };
  });
  assert.match(requested, /vpic\.nhtsa\.dot\.gov\/api\/vehicles\/DecodeVinValues/);
  assert.deepEqual(vehicle, { year: 2003, make: 'HONDA', model: 'Accord', partial: false });
  await assert.rejects(lookupVin('invalid', async () => { throw new Error('Should not fetch'); }), /valid 17-character VIN/);
  await assert.rejects(lookupVin(vin, async () => ({ ok: true, json: async () => ({ Results: [{ ErrorCode: '1', Make: 'HONDA' }] }) })), /could not decode/);
});

test('localhost API handles missing key and serves the app', async () => {
  const existingKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Troubleshoot with AI/);
    const response = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /not configured/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (existingKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = existingKey;
  }
});
