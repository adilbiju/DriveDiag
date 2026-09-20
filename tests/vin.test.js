const test = require('node:test');
const assert = require('node:assert/strict');
const { parseResponse, validVin } = require('../dist/vin.js');

const vin = '1D4GP00R55B123456';
test('parses ELM CAN VIN frames and ignores length line', () => {
  assert.equal(parseResponse('0902\r014\r0: 49 02 01 31 44 34\r1: 47 50 30 30 52 35 35\r2: 42 31 32 33 34 35 36\r>'), vin);
});
test('parses older repeated Mode 09 frames', () => {
  assert.equal(parseResponse('49 02 01 00 00 00 31\r49 02 02 44 34 47 50\r49 02 03 30 30 52 35\r49 02 04 35 42 31 32\r49 02 05 33 34 35 36\r>'), vin);
});
test('rejects incomplete VINs, invalid characters, and unrelated frames', () => {
  assert.equal(parseResponse('0: 49 02 01 31 44 34\r1: 47 50 30'), null);
  assert.equal(parseResponse('NO DATA\r>'), null);
  assert.equal(validVin('1D4GP00R55I123456'), false);
});
