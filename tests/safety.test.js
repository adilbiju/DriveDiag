const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate } = require('../dist/safety.js');

const now = 100000;
const baseline = { mode: 'vehicle', now, codes: [], values: { coolant: 190, rpm: 900, shortFuel: 2, longFuel: 2 }, updatedAt: { coolant: now, rpm: now, shortFuel: now, longFuel: now } };

test('no alerts before connection or with normal live readings', () => {
  assert.deepEqual(evaluate(baseline), []);
  assert.deepEqual(evaluate({ ...baseline, mode: 'idle', codes: [{ code: 'P0300' }] }), []);
});
test('severe coolant temperature prompts stop, but stale data does not', () => {
  assert.equal(evaluate({ ...baseline, values: { ...baseline.values, coolant: 255 } })[0].level, 'stop');
  assert.deepEqual(evaluate({ ...baseline, values: { ...baseline.values, coolant: 255 }, updatedAt: { ...baseline.updatedAt, coolant: now - 13000 } }), []);
});
test('misfire codes prompt stop regardless of stored or pending status', () => {
  assert.equal(evaluate({ ...baseline, codes: [{ code: 'P0302', status: 'Stored' }] })[0].id, 'misfire');
  assert.deepEqual(evaluate({ ...baseline, codes: [{ code: 'P0420' }] }), []);
});
test('very high oil temperature prompts stop', () => {
  const result = evaluate({ ...baseline, values: { ...baseline.values, oil: 305 }, updatedAt: { ...baseline.updatedAt, oil: now } });
  assert.equal(result[0].id, 'oil-critical');
});
test('combined fuel trim is screened only with a warm, running engine', () => {
  const values = { ...baseline.values, shortFuel: 12, longFuel: 10 };
  assert.equal(evaluate({ ...baseline, values })[0].id, 'fuel-trim');
  assert.deepEqual(evaluate({ ...baseline, values: { ...values, coolant: 100 } }), []);
  assert.deepEqual(evaluate({ ...baseline, values: { ...values, rpm: 0 } }), []);
});
