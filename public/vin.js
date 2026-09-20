(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DriveDiagVin = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
  const bytes = (text) => {
    const compact = text.replace(/\s+/g, '');
    return compact.length % 2 === 0 && /^[0-9A-F]+$/i.test(compact)
      ? compact.match(/../g).map((pair) => Number.parseInt(pair, 16)) : [];
  };
  function validVin(value) { return VIN_PATTERN.test(value); }
  function fromData(data) {
    const marker = data.findIndex((byte, index) => byte === 0x49 && data[index + 1] === 0x02);
    if (marker < 0 || data[marker + 2] !== 0x01) return null;
    const vin = String.fromCharCode(...data.slice(marker + 3, marker + 20));
    return validVin(vin) ? vin : null;
  }

  function parseResponse(response) {
    const lines = response.toUpperCase().split(/[\r\n]+/).map((line) => line.trim());
    // ELM CAN formatting: length, then 0:, 1:, 2: frames. Never join
    // arbitrary lines, because multiple ECUs can reply to the same request.
    const frames = new Map();
    for (const line of lines) {
      const match = line.match(/^([0-9A-F]):\s*((?:[0-9A-F]{2}\s*)+)$/);
      if (match && !frames.has(Number.parseInt(match[1], 16))) frames.set(Number.parseInt(match[1], 16), bytes(match[2]));
    }
    if (frames.has(0)) {
      const data = [];
      for (let i = 0; frames.has(i); i += 1) data.push(...frames.get(i));
      const vin = fromData(data);
      if (vin) return vin;
    }

    // Older protocols repeat 49 02 with a byte indicating the line number.
    const parts = new Map();
    for (const line of lines) {
      const data = bytes(line);
      if (data[0] === 0x49 && data[1] === 0x02 && data[2] >= 1 && data[2] <= 9 && !parts.has(data[2])) parts.set(data[2], data.slice(3));
      const vin = fromData(data); // Single-line, already reassembled response.
      if (vin) return vin;
    }
    if (parts.has(1)) {
      const data = [];
      for (let i = 1; parts.has(i); i += 1) data.push(...parts.get(i));
      const vin = String.fromCharCode(...data.filter((byte) => byte !== 0).slice(0, 17));
      if (validVin(vin)) return vin;
    }
    return null;
  }

  return { parseResponse, validVin };
});
