const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

const SENSOR_DEFS = [
  { id: 'load', pid: '04', name: 'Calculated engine load', short: 'Engine load', unit: '%', min: 0, max: 100, range: '0–100%', group: 'Engine', available: true, decode: ([a]) => a * 100 / 255 },
  { id: 'coolant', pid: '05', name: 'Engine coolant temperature', short: 'Coolant temp', unit: '°F', min: -40, max: 300, range: '-40–300°F', group: 'Thermal', available: true, decode: ([a]) => (a - 40) * 9 / 5 + 32 },
  { id: 'shortFuel', pid: '06', name: 'Short-term fuel trim — Bank 1', short: 'Short fuel trim', unit: '%', min: -100, max: 100, range: '-100–99%', group: 'Fuel', available: true, decode: ([a]) => (a - 128) * 100 / 128 },
  { id: 'longFuel', pid: '07', name: 'Long-term fuel trim — Bank 1', short: 'Long fuel trim', unit: '%', min: -100, max: 100, range: '-100–99%', group: 'Fuel', available: true, decode: ([a]) => (a - 128) * 100 / 128 },
  { id: 'fuelPressure', pid: '0A', name: 'Fuel pressure', short: 'Fuel pressure', unit: 'kPa', min: 0, max: 765, range: '0–765 kPa', group: 'Fuel', available: true, decode: ([a]) => a * 3 },
  { id: 'manifold', pid: '0B', name: 'Intake manifold pressure', short: 'Manifold pressure', unit: 'kPa', min: 0, max: 255, range: '0–255 kPa', group: 'Air', available: true, decode: ([a]) => a },
  { id: 'rpm', pid: '0C', name: 'Engine speed', short: 'Engine RPM', unit: 'rpm', min: 0, max: 8000, range: '0–16,384 rpm', group: 'Engine', available: true, decode: ([a, b]) => (a * 256 + b) / 4 },
  { id: 'speed', pid: '0D', name: 'Vehicle speed', short: 'Vehicle speed', unit: 'mph', min: 0, max: 140, range: '0–158 mph', group: 'Motion', available: true, decode: ([a]) => a * 0.621371 },
  { id: 'timing', pid: '0E', name: 'Timing advance', short: 'Timing advance', unit: '°', min: -64, max: 64, range: '-64–63.5°', group: 'Engine', available: true, decode: ([a]) => a / 2 - 64 },
  { id: 'intake', pid: '0F', name: 'Intake air temperature', short: 'Intake temp', unit: '°F', min: -40, max: 250, range: '-40–419°F', group: 'Thermal', available: true, decode: ([a]) => (a - 40) * 9 / 5 + 32 },
  { id: 'maf', pid: '10', name: 'Mass air flow rate', short: 'Air flow', unit: 'g/s', min: 0, max: 200, range: '0–655 g/s', group: 'Air', available: true, decode: ([a, b]) => (a * 256 + b) / 100 },
  { id: 'throttle', pid: '11', name: 'Throttle position', short: 'Throttle', unit: '%', min: 0, max: 100, range: '0–100%', group: 'Air', available: true, decode: ([a]) => a * 100 / 255 },
  { id: 'oxygen1', pid: '14', name: 'O₂ sensor 1 voltage', short: 'O₂ sensor 1', unit: 'V', min: 0, max: 1.3, range: '0–1.275 V', group: 'Emissions', available: true, decode: ([a]) => a / 200 },
  { id: 'runtime', pid: '1F', name: 'Run time since engine start', short: 'Engine runtime', unit: 's', min: 0, max: 7200, range: '0–18.2 hr', group: 'Vehicle', available: true, decode: ([a, b]) => a * 256 + b },
  { id: 'distanceCel', pid: '21', name: 'Distance with CEL on', short: 'CEL distance', unit: 'mi', min: 0, max: 500, range: '0–40,722 mi', group: 'Diagnostics', available: true, decode: ([a, b]) => (a * 256 + b) * 0.621371 },
  { id: 'fuel', pid: '2F', name: 'Fuel tank level', short: 'Fuel level', unit: '%', min: 0, max: 100, range: '0–100%', group: 'Fuel', available: true, decode: ([a]) => a * 100 / 255 },
  { id: 'barometric', pid: '33', name: 'Barometric pressure', short: 'Barometric pressure', unit: 'kPa', min: 0, max: 130, range: '0–255 kPa', group: 'Air', available: true, decode: ([a]) => a },
  { id: 'catalyst', pid: '3C', name: 'Catalyst temperature — Bank 1', short: 'Catalyst temp', unit: '°F', min: 0, max: 1800, range: '-40–1,691°F', group: 'Emissions', available: true, decode: ([a, b]) => ((a * 256 + b) / 10 - 40) * 9 / 5 + 32 },
  { id: 'voltage', command: 'ATRV', name: 'OBD adapter supply voltage', short: 'Battery voltage', unit: 'V', min: 8, max: 16, range: '0–25 V', group: 'Electrical', available: true, decodeResponse: (response) => Number.parseFloat(response.match(/(\d+(?:\.\d+)?)\s*V/i)?.[1]) },
  { id: 'absoluteLoad', pid: '43', name: 'Absolute load value', short: 'Absolute load', unit: '%', min: 0, max: 150, range: '0–25,700%', group: 'Engine', available: false, decode: ([a, b]) => (a * 256 + b) * 100 / 255 },
  { id: 'relativeThrottle', pid: '45', name: 'Relative throttle position', short: 'Relative throttle', unit: '%', min: 0, max: 100, range: '0–100%', group: 'Air', available: false, decode: ([a]) => a * 100 / 255 },
  { id: 'ambient', pid: '46', name: 'Ambient air temperature', short: 'Ambient temp', unit: '°F', min: -40, max: 160, range: '-40–419°F', group: 'Thermal', available: true, decode: ([a]) => (a - 40) * 9 / 5 + 32 },
  { id: 'ethanol', pid: '52', name: 'Ethanol fuel percentage', short: 'Ethanol content', unit: '%', min: 0, max: 100, range: '0–100%', group: 'Fuel', available: false, decode: ([a]) => a * 100 / 255 },
  { id: 'oil', pid: '5C', name: 'Engine oil temperature', short: 'Oil temp', unit: '°F', min: -40, max: 300, range: '-40–419°F', group: 'Thermal', available: true, decode: ([a]) => (a - 40) * 9 / 5 + 32 },
  { id: 'fuelRate', pid: '5E', name: 'Engine fuel rate', short: 'Fuel rate', unit: 'L/h', min: 0, max: 40, range: '0–3,212 L/h', group: 'Fuel', available: false, decode: ([a, b]) => (a * 256 + b) / 20 },
  { id: 'torque', pid: '62', name: 'Actual engine torque', short: 'Engine torque', unit: '%', min: -125, max: 125, range: '-125–125%', group: 'Engine', available: false, decode: ([a]) => a - 125 },
  { id: 'torqueRef', pid: '63', name: 'Engine reference torque', short: 'Reference torque', unit: 'Nm', min: 0, max: 1000, range: '0–65,535 Nm', group: 'Engine', available: false, decode: ([a, b]) => a * 256 + b },
  { id: 'gear', pid: 'A4', name: 'Transmission actual gear', short: 'Selected gear', unit: '', min: 0, max: 10, range: '0–10', group: 'Transmission', available: false, decode: ([a]) => a & 15 }
];

const initialValues = {
  load: 42, coolant: 196, shortFuel: 1.6, longFuel: -2.3, fuelPressure: 358,
  manifold: 46, rpm: 2840, speed: 72, timing: 14.5, intake: 81, maf: 18.7,
  throttle: 28, oxygen1: .74, runtime: 2844, distanceCel: 126, fuel: 68,
  barometric: 101, catalyst: 1184, voltage: 14.2, absoluteLoad: 48, ambient: 74,
  relativeThrottle: 24, ethanol: 10, oil: 204, fuelRate: 5.8, torque: 37,
  torqueRef: 320, gear: 5
};

const demoSupport = Object.fromEntries(SENSOR_DEFS.map((sensor) => [sensor.id, sensor.available]));
const emptyValues = Object.fromEntries(SENSOR_DEFS.map((sensor) => [sensor.id, Number.NaN]));
const demoCodes = [
  { code: 'P0420', status: 'Stored' },
  { code: 'P0171', status: 'Pending' }
];
SENSOR_DEFS.forEach((sensor) => { sensor.available = null; });

const SERIES_COLORS = ['#f39a17', '#242924', '#6b9e2a', '#dc5b43'];
const SENSOR_ICONS = {
  Engine: 'engine', Thermal: 'temperature', Fuel: 'gas-station', Air: 'wind',
  Motion: 'dashboard', Emissions: 'activity-heartbeat', Vehicle: 'car',
  Diagnostics: 'alert-triangle', Electrical: 'battery-automotive', Transmission: 'manual-gearbox'
};
const FAST_SENSOR_IDS = ['rpm', 'speed', 'load', 'throttle'];
const POLL_INTERVALS = {
  rpm: 120, speed: 120, load: 250, throttle: 250, maf: 500, timing: 500,
  shortFuel: 900, longFuel: 900, coolant: 2500, intake: 2500, voltage: 5000
};
const state = {
  mode: 'idle', device: null, server: null, writeCharacteristic: null, notifyCharacteristic: null,
  responseBuffer: '', pendingCommand: null, pollTimer: null, pollingIndex: 0, suspendPolling: false,
  sensorLastPolled: {}, fastBundleIds: [], lastFastPoll: 0, fastTimingConfigured: false, sampleTimestamps: [],
  values: { ...emptyValues }, sensorUpdatedAt: {}, selected: [], history: {}, paused: false,
  sensorFilter: 'available', sensorSearch: '', chartSearch: '',
  tripMiles: 0, speedSamples: [], codes: [], codeScanComplete: false, aiPending: false, analysisRevision: 0,
  vinRevision: 0, vehicleIdentityState: 'idle', vehicleIdentityMessage: '', connectionFallbackLabel: 'Not connected'
};

let toastTimer;
let demoTimer;
let chartFrame;
let dtcCodes = {};
const dtcCatalogReady = fetch('data/dtc-codes.json?v=1')
  .then((response) => {
    if (!response.ok) throw new Error(`DTC catalog request failed (${response.status})`);
    return response.json();
  })
  .then((catalog) => { dtcCodes = catalog.codes || {}; })
  .catch((error) => console.warn('Could not load the local DTC catalog.', error));

function sensorById(id) { return SENSOR_DEFS.find((sensor) => sensor.id === id); }
function showToast(message, persistent = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  if (!persistent) toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function currentSampleRate(now = Date.now()) {
  state.sampleTimestamps = state.sampleTimestamps.filter((timestamp) => now - timestamp <= 5000);
  if (!state.sampleTimestamps.length) return 0;
  const windowSeconds = Math.max(1, (now - state.sampleTimestamps[0]) / 1000);
  return state.sampleTimestamps.length / windowSeconds;
}

function formatValue(sensor, value) {
  if (!Number.isFinite(value)) return '—';
  if (sensor.id === 'runtime') {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const seconds = Math.floor(value % 60);
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  const decimals = ['voltage', 'oxygen1', 'shortFuel', 'longFuel', 'maf', 'fuelRate', 'timing'].includes(sensor.id) ? 1 : 0;
  return `${value.toFixed(decimals)}${sensor.unit ? ` ${sensor.unit}` : ''}`;
}

function renderTicks() {
  const group = $('#speedTicks');
  group.replaceChildren();
  for (let i = 0; i <= 14; i += 1) {
    const angle = Math.PI - (i / 14) * Math.PI;
    const inner = i % 2 === 0 ? 119 : 122;
    const outer = 127;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', 150 + Math.cos(angle) * inner);
    line.setAttribute('y1', 156 - Math.sin(angle) * inner);
    line.setAttribute('x2', 150 + Math.cos(angle) * outer);
    line.setAttribute('y2', 156 - Math.sin(angle) * outer);
    line.setAttribute('stroke', '#aeb0a8');
    line.setAttribute('stroke-width', i % 2 === 0 ? '1.5' : '1');
    group.append(line);
  }
}

function updateDashboard() {
  const { speed, rpm, load, coolant, fuel, voltage } = state.values;
  const hasSpeed = Number.isFinite(speed);
  const hasRpm = Number.isFinite(rpm);
  $('#speedValue').textContent = hasSpeed ? Math.round(speed) : '—';
  $('#rpmValue').textContent = hasRpm ? Math.round(rpm).toLocaleString() : '—';
  $('#loadValue').textContent = Number.isFinite(load) ? `${Math.round(load)}%` : '—';
  $('#tempValue').textContent = Number.isFinite(coolant) ? Math.round(coolant) : '—';
  $('#fuelValue').textContent = Number.isFinite(fuel) ? Math.round(fuel) : '—';
  $('#voltageValue').textContent = Number.isFinite(voltage) ? voltage.toFixed(1) : '—';
  $('#tempValue').nextElementSibling.hidden = !Number.isFinite(coolant);
  $('#fuelValue').nextElementSibling.hidden = !Number.isFinite(fuel);
  $('#voltageValue').nextElementSibling.hidden = !Number.isFinite(voltage);
  $('#tripValue').textContent = hasSpeed ? `${state.tripMiles.toFixed(1)} mi` : '—';
  const avg = state.speedSamples.length ? state.speedSamples.reduce((sum, value) => sum + value, 0) / state.speedSamples.length : Number.NaN;
  $('#avgValue').textContent = Number.isFinite(avg) ? `${Math.round(avg)} mph` : '—';
  $('#speedArc').style.strokeDashoffset = 351.8 * (1 - clamp(hasSpeed ? speed / 140 : 0, 0, 1));
  $('#rpmBar').style.width = `${clamp(hasRpm ? rpm / 8000 : 0, 0, 1) * 100}%`;
  $('.temperature .mini-bar i').style.width = `${Number.isFinite(coolant) ? clamp((coolant - 100) / 1.5, 0, 100) : 0}%`;
  $('.fuel .mini-bar i').style.width = `${Number.isFinite(fuel) ? clamp(fuel, 0, 100) : 0}%`;
  $('.voltage .mini-bar i').style.width = `${Number.isFinite(voltage) ? clamp((voltage - 8) * 12.5, 0, 100) : 0}%`;
  $('.temperature small').textContent = Number.isFinite(coolant) ? 'Live coolant reading' : 'Awaiting data';
  $('.fuel small').textContent = Number.isFinite(fuel) ? 'Live tank level' : 'Awaiting data';
  $('.voltage small').textContent = Number.isFinite(voltage) ? 'Live OBD-port voltage' : 'Awaiting data';
  $('#speedValue').closest('.speed-gauge').setAttribute('aria-label', hasSpeed ? `Current speed ${Math.round(speed)} miles per hour` : 'Speed unavailable until an adapter connects');
}

function updateLiveValues() {
  $$('[data-sensor-value]').forEach((element) => {
    const sensor = sensorById(element.dataset.sensorValue);
    element.textContent = formatValue(sensor, state.values[sensor.id]);
  });
  updateDashboard();
  renderSafety();
}

function renderSafety() {
  const alerts = DriveDiagSafety.evaluate({ mode: state.mode, values: state.values, updatedAt: state.sensorUpdatedAt, codes: state.codes });
  const panel = $('#safetyPanel');
  panel.hidden = !alerts.length;
  if (!alerts.length) return;
  const primary = alerts[0];
  panel.classList.toggle('stop', primary.level === 'stop');
  $('#safetyLevel').textContent = primary.level === 'stop' ? 'PULL OVER SAFELY' : 'VEHICLE ADVISORY';
  $('#safetyTitle').textContent = primary.title;
  $('#safetyDetail').textContent = primary.detail;
  $('#safetyMore').replaceChildren(...alerts.slice(1).map((alert) => {
    const item = document.createElement('li');
    item.textContent = `${alert.title}: ${alert.detail}`;
    return item;
  }));
}

function updateAiAvailability() {
  const year = Number($('#vehicleYear').value);
  const manualReady = state.vehicleIdentityState === 'fallback' && Number.isInteger(year) && year >= 1980 && year <= 2100 && $('#vehicleMake').value.trim() && $('#vehicleModel').value.trim();
  const identityReady = state.mode === 'demo' || state.vehicleIdentityState === 'identified' || manualReady;
  const ready = state.mode !== 'idle' && state.codeScanComplete && identityReady;
  $('#analyzeAi').disabled = !ready || state.aiPending;
  $('#aiSnapshotHint').textContent = state.aiPending ? 'Analyzing…' : state.mode === 'idle' ? 'Connect an OBD adapter first.' : !state.codeScanComplete ? 'Scan codes before analyzing.' : state.vehicleIdentityState === 'loading' || state.vehicleIdentityState === 'waiting' ? 'Identifying the vehicle…' : state.vehicleIdentityState === 'fallback' && !manualReady ? 'Enter year, make and model first.' : state.mode === 'demo' ? 'Demo data will be sent.' : 'Ready to send a snapshot.';
}

function resetAiResult() {
  state.analysisRevision += 1;
  $('#aiResult').hidden = true;
  $('#aiResult').classList.remove('error');
  $('#aiResultHeading').textContent = 'Suggested next steps';
  $('#aiResultCaution').hidden = false;
  $('#aiResultText').textContent = '';
  updateAiAvailability();
}

function renderVehicleIdentity() {
  const status = state.vehicleIdentityState;
  const labels = {
    idle: ['Not connected', 'Connect an OBD adapter to identify the vehicle automatically.'],
    waiting: ['Waiting for vehicle', 'Turn the ignition on so the adapter can read the vehicle.'],
    loading: ['Identifying vehicle…', 'Reading the VIN from OBD and decoding year, make and model.'],
    identified: [`${$('#vehicleYear').value} ${$('#vehicleMake').value} ${$('#vehicleModel').value}`, 'Identified automatically from the vehicle VIN.'],
    fallback: ['Vehicle details needed', state.vehicleIdentityMessage || 'Automatic VIN identification was unavailable. Enter year, make and model below.'],
    demo: ['Demo vehicle', 'Synthetic data; no vehicle is connected.']
  };
  $('#vehicleIdentityTitle').textContent = labels[status][0];
  $('#vehicleIdentityNote').textContent = labels[status][1];
  $('#manualVehicleFields').hidden = status !== 'fallback';
  updateConnectionLabel();
  updateAiAvailability();
}

function resetVehicleIdentity() {
  state.vinRevision += 1;
  state.vehicleIdentityState = state.mode === 'vehicle' ? 'waiting' : state.mode === 'demo' ? 'demo' : 'idle';
  state.vehicleIdentityMessage = '';
  $('#vehicleYear').value = '';
  $('#vehicleMake').value = '';
  $('#vehicleModel').value = '';
  renderVehicleIdentity();
}

async function identifyVehicleAutomatically() {
  if (state.mode !== 'vehicle' || !['waiting', 'loading'].includes(state.vehicleIdentityState)) return;
  const revision = ++state.vinRevision;
  state.vehicleIdentityState = 'loading';
  renderVehicleIdentity();
  let vin;
  state.suspendPolling = true;
  try {
    while (state.pendingCommand) await sleep(40);
    if (state.mode !== 'vehicle' || revision !== state.vinRevision) return;
    vin = DriveDiagVin.parseResponse(await sendCommand('0902', 6500));
    if (!vin) throw new Error('The vehicle did not return a complete VIN.');
  } catch (error) {
    if (revision === state.vinRevision) {
      state.vehicleIdentityState = 'fallback';
      state.vehicleIdentityMessage = 'The VIN could not be read from OBD. Enter year, make and model below.';
      renderVehicleIdentity();
    }
    return;
  } finally { state.suspendPolling = false; }

  if (state.mode !== 'vehicle' || revision !== state.vinRevision) return;
  try {
    const response = await fetch('/api/decode-vin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vin }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'VIN lookup failed.');
    if (state.mode !== 'vehicle' || revision !== state.vinRevision) return;
    $('#vehicleYear').value = data.year;
    $('#vehicleMake').value = data.make;
    $('#vehicleModel').value = data.model;
    state.vehicleIdentityState = data.partial ? 'fallback' : 'identified';
    state.vehicleIdentityMessage = data.partial ? 'The VIN lookup could not identify the model. Enter it below.' : '';
    renderVehicleIdentity();
    resetAiResult();
  } catch {
    if (state.mode !== 'vehicle' || revision !== state.vinRevision) return;
    state.vehicleIdentityState = 'fallback';
    state.vehicleIdentityMessage = 'The VIN lookup failed. Enter year, make and model below.';
    renderVehicleIdentity();
  }
}

async function inspectConnectedVehicle() {
  if (state.mode !== 'vehicle' || state.vehicleIdentityState !== 'waiting') return;
  state.vehicleIdentityState = 'loading';
  renderVehicleIdentity();
  await scanCodes();
  if (state.mode === 'vehicle') await identifyVehicleAutomatically();
}

async function analyzeWithAi() {
  if (state.mode === 'idle' || !state.codeScanComplete || state.aiPending || $('#analyzeAi').disabled) return;
  const year = $('#vehicleYear').value.trim();
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1980 || Number(year) > 2100)) {
    showToast('Enter a valid four-digit model year or leave it blank.');
    return;
  }
  const now = Date.now();
  const sensors = SENSOR_DEFS.filter((sensor) => sensor.available && Number.isFinite(state.values[sensor.id]) && now - (state.sensorUpdatedAt[sensor.id] || 0) <= 30000)
    .map((sensor) => ({ id: sensor.id, name: sensor.name, value: Number(state.values[sensor.id].toFixed(2)), unit: sensor.unit }));
  const snapshot = {
    source: state.mode,
    sampledAt: new Date(now).toISOString(),
    vehicle: { year: year ? Number(year) : null, make: $('#vehicleMake').value.trim().slice(0, 40), model: $('#vehicleModel').value.trim().slice(0, 60) },
    codes: state.codes.map(({ code, status }) => ({ code, status })),
    sensors
  };
  state.aiPending = true;
  resetAiResult();
  const revision = state.analysisRevision;
  try {
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Analysis failed (${response.status}).`);
    if (revision !== state.analysisRevision) return;
    $('#aiResultText').textContent = data.analysis;
    $('#aiResult').hidden = false;
  } catch (error) {
    if (revision === state.analysisRevision) {
      $('#aiResultHeading').textContent = 'Analysis unavailable';
      $('#aiResultText').textContent = error instanceof SyntaxError ? 'AI needs the localhost app server. Start it with npm start.' : error.message;
      $('#aiResultCaution').hidden = true;
      $('#aiResult').classList.add('error');
      $('#aiResult').hidden = false;
    }
  } finally { state.aiPending = false; updateAiAvailability(); }
}

function renderSensorRows() {
  const query = state.sensorSearch.toLowerCase();
  const visible = SENSOR_DEFS.filter((sensor) => {
    const matchesText = `${sensor.name} ${sensor.pid} ${sensor.group}`.toLowerCase().includes(query);
    const matchesFilter = state.sensorFilter === 'all' || (state.sensorFilter === 'available' ? sensor.available === true : sensor.available === false);
    return matchesText && matchesFilter;
  });
  $('#availableCount').textContent = SENSOR_DEFS.filter((sensor) => sensor.available === true).length;
  $('#sensorRate').textContent = state.mode === 'idle' ? '0' : state.mode === 'demo' ? '24' : currentSampleRate().toFixed(1);
  $('#sensorRows').innerHTML = visible.length ? visible.map((sensor) => `
    <div class="sensor-row">
      <div class="sensor-name"><span class="sensor-glyph" aria-hidden="true"><i class="icon icon-${SENSOR_ICONS[sensor.group] || 'adjustments-horizontal'}"></i></span><div><strong>${sensor.name}</strong><small>${sensor.group}</small></div></div>
      <span class="pid-code">${sensor.command ? 'AT RV' : `01 ${sensor.pid}`}</span>
      <strong class="live-value" data-sensor-value="${sensor.id}">${formatValue(sensor, state.values[sensor.id])}</strong>
      <span class="sensor-range">${sensor.range}</span>
      <span class="status-pill ${sensor.available === null ? 'unknown' : sensor.available ? '' : 'off'}">${sensor.available === null ? 'Awaiting scan' : sensor.available ? 'Available' : 'Not reported'}</span>
    </div>`).join('') : '<div class="empty-row">No sensors match this filter.</div>';
}

function renderSignalOptions() {
  const query = state.chartSearch.toLowerCase();
  const available = SENSOR_DEFS.filter((sensor) => sensor.available && `${sensor.name} ${sensor.group}`.toLowerCase().includes(query));
  $('#signalOptions').innerHTML = available.map((sensor) => {
    const index = state.selected.indexOf(sensor.id);
    const color = index >= 0 ? SERIES_COLORS[index] : '#b4b6ae';
    return `<label class="signal-option" style="--series-color:${color}"><input type="checkbox" value="${sensor.id}" ${index >= 0 ? 'checked' : ''}><span class="signal-check"></span><span><strong>${sensor.short}</strong><small>${formatValue(sensor, state.values[sensor.id])}</small></span></label>`;
  }).join('');
  $$('#signalOptions input').forEach((input) => input.addEventListener('change', handleSignalToggle));
  $('#selectedCount').textContent = state.selected.length;
  renderLegend();
}

function handleSignalToggle(event) {
  const id = event.target.value;
  if (event.target.checked) {
    if (state.selected.length >= 4) {
      event.target.checked = false;
      showToast('You can compare up to four signals.');
      return;
    }
    state.selected.push(id);
    if (!state.history[id]) state.history[id] = [];
  } else {
    state.selected = state.selected.filter((value) => value !== id);
  }
  renderSignalOptions();
  drawChart();
}

function renderLegend() {
  $('#chartLegend').innerHTML = state.selected.map((id, index) => {
    const sensor = sensorById(id);
    return `<span class="legend-item" style="--series-color:${SERIES_COLORS[index]}"><i></i>${sensor.short} · ${formatValue(sensor, state.values[id])}</span>`;
  }).join('');
}

function pushHistory() {
  if (state.paused) return;
  SENSOR_DEFS.forEach((sensor) => {
    if (!state.history[sensor.id]) state.history[sensor.id] = [];
    state.history[sensor.id].push(state.values[sensor.id]);
    if (state.history[sensor.id].length > 120) state.history[sensor.id].shift();
  });
  renderLegend();
  drawChart();
}

function drawChart() {
  cancelAnimationFrame(chartFrame);
  chartFrame = requestAnimationFrame(() => {
    const canvas = $('#liveChart');
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height - 18;
    ctx.clearRect(0, 0, width, rect.height);
    ctx.strokeStyle = '#e3e2dc';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = Math.round((height / 4) * i) + .5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    for (let i = 0; i <= 6; i += 1) {
      const x = Math.round((width / 6) * i) + .5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      ctx.fillStyle = '#999c93'; ctx.font = '10px DM Sans'; ctx.textAlign = i === 0 ? 'left' : i === 6 ? 'right' : 'center';
      ctx.fillText(`${60 - i * 10}s`, x, rect.height - 2);
    }
    state.selected.forEach((id, seriesIndex) => {
      const sensor = sensorById(id);
      const values = state.history[id] || [];
      if (values.length < 2) return;
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = (index / 119) * width;
        const normalized = clamp((value - sensor.min) / (sensor.max - sensor.min), 0, 1);
        const y = height - normalized * height;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = SERIES_COLORS[seriesIndex];
      ctx.lineWidth = seriesIndex === 0 ? 2.5 : 2;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    });
  });
}

const DTC_DOMAINS = { P: 'Powertrain', B: 'Body', C: 'Chassis', U: 'Network' };

function enrichCode(code, status = 'Stored') {
  const detail = dtcCodes[code];
  return {
    code,
    status,
    title: detail?.title || 'Diagnostic trouble code reported',
    detail: detail?.description || 'Description is unavailable. Refer to the vehicle service information for manufacturer-specific guidance.',
    domain: DTC_DOMAINS[code[0]] || 'Vehicle'
  };
}

function renderCodes() {
  $('#issueCount').textContent = String(state.codes.length);
  const idle = state.mode === 'idle';
  $('#healthTitle').textContent = idle ? 'Not connected' : !state.codeScanComplete ? 'Scan needed' : state.codes.length ? `${state.codes.length} issue${state.codes.length === 1 ? '' : 's'} need attention` : 'No trouble codes reported';
  $('#healthCopy').textContent = idle ? 'Connect an OBD adapter to scan the engine control module.' : !state.codeScanComplete ? 'No code scan has completed yet.' : state.mode === 'demo' ? 'Optional demo codes are shown. Connect a vehicle for a real scan.' : state.codes.length ? 'Codes were returned by the connected engine control module.' : 'The engine control module returned no stored or pending codes.';
  $('#protocolValue').textContent = idle ? 'Awaiting connection' : state.mode === 'demo' ? 'Demo' : 'Not read';
  $('#milStatus').textContent = idle ? '—' : 'Not read';
  $('#milDistance').textContent = idle ? '—' : formatValue(sensorById('distanceCel'), state.values.distanceCel);
  $$('.monitor-row em').forEach((element) => { element.textContent = idle ? '—' : 'Not read'; element.classList.remove('ready'); });
  $('#codesList').innerHTML = idle ? '<div class="no-codes panel"><div><i class="icon icon-plug-connected" aria-hidden="true"></i><h3>Connect to diagnose</h3><p>Select an OBD adapter before requesting trouble codes.</p></div></div>' : !state.codeScanComplete ? '<div class="no-codes panel"><div><i class="icon icon-refresh" aria-hidden="true"></i><h3>Scan codes</h3><p>No trouble-code scan has completed yet.</p></div></div>' : state.codes.length ? state.codes.map((item) => `
    <article class="code-card panel">
      <div class="code-id"><strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(item.status.toUpperCase())}</span></div>
      <div class="code-copy"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div>
      <div class="code-domain"><i class="icon icon-activity-heartbeat" aria-hidden="true"></i>${escapeHtml(item.domain)}</div>
    </article>`).join('') : '<div class="no-codes panel"><div><i class="icon icon-circle-check" aria-hidden="true"></i><h3>No codes found</h3><p>The connected ECU reported no stored or pending trouble codes.</p></div></div>';
  renderSafety();
  updateAiAvailability();
}

function navigate(view, updateHash = true) {
  if (!['dashboard', 'sensors', 'visualize', 'diagnose'].includes(view)) return;
  $$('.nav-item').forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle('is-active', active);
    active ? item.setAttribute('aria-current', 'page') : item.removeAttribute('aria-current');
  });
  $$('.view').forEach((section) => section.classList.toggle('is-visible', section.id === view));
  $('.topbar h1').textContent = view[0].toUpperCase() + view.slice(1);
  $('.sidebar').classList.remove('open');
  if (updateHash) history.replaceState(null, '', `#${view}`);
  if (view === 'visualize') setTimeout(drawChart, 20);
}

function tickDemo() {
  if (state.mode !== 'demo') return;
  const v = state.values;
  v.speed = clamp(v.speed + (Math.random() - .48) * 2.4, 0, 120);
  v.rpm = clamp(720 + v.speed * 29 + Math.sin(Date.now() / 2800) * 240 + (Math.random() - .5) * 90, 680, 7000);
  v.load = clamp(20 + (v.rpm / 8000) * 64 + (Math.random() - .5) * 5, 8, 94);
  v.throttle = clamp(12 + v.load * .42 + (Math.random() - .5) * 2, 0, 100);
  v.relativeThrottle = v.throttle * .86;
  v.manifold = clamp(27 + v.load * .44, 20, 100);
  v.maf = clamp(3 + v.rpm * v.load / 15500, 2, 190);
  v.shortFuel = clamp(Math.sin(Date.now() / 2400) * 3 + (Math.random() - .5), -12, 12);
  v.oxygen1 = clamp(.45 + Math.sin(Date.now() / 900) * .35, .08, .92);
  v.runtime += .75;
  v.catalyst = clamp(v.catalyst + (Math.random() - .5) * 5, 850, 1500);
  v.voltage = clamp(14.15 + (Math.random() - .5) * .12, 13.8, 14.5);
  v.fuelRate = clamp(1.1 + v.load * .11, .6, 28);
  v.torque = clamp(v.load - 8, -10, 100);
  Object.keys(v).forEach((id) => { state.sensorUpdatedAt[id] = Date.now(); });
  state.tripMiles += v.speed / 4800;
  state.speedSamples.push(v.speed);
  if (state.speedSamples.length > 120) state.speedSamples.shift();
  updateLiveValues();
  pushHistory();
}

const UUIDS = {
  obdlink: { label: 'OBDLink CX', service: '0000fff0-0000-1000-8000-00805f9b34fb', write: '0000fff2-0000-1000-8000-00805f9b34fb', notify: '0000fff1-0000-1000-8000-00805f9b34fb' },
  nordic: { label: 'Nordic UART', service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', write: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', notify: '6e400003-b5a3-f393-e0a9-e50e24dcca9e' },
  hm10: { label: 'HM-10 UART', service: '0000ffe0-0000-1000-8000-00805f9b34fb', write: '0000ffe1-0000-1000-8000-00805f9b34fb', notify: '0000ffe1-0000-1000-8000-00805f9b34fb' }
};

function updateConnectionLabel() {
  const make = $('#vehicleMake').value.trim();
  const model = $('#vehicleModel').value.trim();
  const hasVehicleIdentity = state.mode === 'vehicle' && ['identified', 'fallback'].includes(state.vehicleIdentityState) && make && model;
  const label = hasVehicleIdentity ? `${make} ${model}` : state.connectionFallbackLabel;
  $('#connectionLabel').textContent = label;
  $('#connectionLabel').title = label;
}

function setConnectionUI(label, connected) {
  state.connectionFallbackLabel = label;
  updateConnectionLabel();
  $('.connection-state i').style.background = connected ? '#a7db4f' : '#a5a89e';
  $('.connection-state i').style.boxShadow = connected ? '0 0 0 4px rgba(167,219,79,.14)' : 'none';
  $('.status-dot').style.background = connected ? '#a7db4f' : '#656961';
  $('#connectButton span:last-child').textContent = connected ? 'Disconnect' : 'Connect OBD';
  $('#connectPrompt').hidden = connected || state.mode === 'demo';
  $('.live-tag').textContent = connected ? 'LIVE' : state.mode === 'demo' ? 'DEMO' : 'OFFLINE';
  $('.live-tag').classList.toggle('offline', !connected && state.mode !== 'demo');
  $('#streamText').textContent = state.mode === 'idle' ? 'WAITING FOR VEHICLE' : state.paused ? 'PAUSED' : 'STREAMING';
  $('.stream-state').classList.toggle('paused', state.mode === 'idle' || state.paused);
  $('#pauseChart').disabled = state.mode === 'idle';
  $('#resetChart').disabled = state.mode === 'idle';
}

async function connectBluetooth(showAll = false) {
  if (!navigator.bluetooth) {
    showToast('Web Bluetooth is not available in this browser. Try Chrome or Edge over HTTPS.', true);
    return;
  }
  const filteredButton = $('#pairDevice');
  const allButton = $('#showAllDevices');
  filteredButton.disabled = true;
  allButton.disabled = true;
  if (showAll) allButton.textContent = 'Waiting for device…';
  else filteredButton.querySelector('span').textContent = 'Searching for OBD devices…';
  let connectionStage = 'opening the Bluetooth connection';
  try {
    const services = [...new Set(Object.values(UUIDS).map((config) => config.service))];
    const namePrefixes = ['OBD', 'obd', 'ELM', 'Vgate', 'V-GATE', 'V-LINK', 'vLinker', 'OBDLink', 'VEEPEAK', 'Viecar', 'iCar', 'KONNWEI', 'CARISTA', 'FIXD', 'BAFX'];
    const filters = namePrefixes.map((namePrefix) => ({ namePrefix }));
    const requestOptions = showAll
      ? { acceptAllDevices: true, optionalServices: services }
      : { filters, optionalServices: services };
    const device = await navigator.bluetooth.requestDevice(requestOptions);
    state.device = device;
    device.addEventListener('gattserverdisconnected', handleDisconnect);
    setConnectionUI('Connecting…', false);
    state.server = await device.gatt.connect();
    let transport = null;
    for (const config of Object.values(UUIDS)) {
      try {
        connectionStage = `opening the ${config.label} service`;
        const service = await state.server.getPrimaryService(config.service);
        const writeCharacteristic = await service.getCharacteristic(config.write);
        const notifyCharacteristic = config.notify === config.write ? writeCharacteristic : await service.getCharacteristic(config.notify);
        const canWrite = writeCharacteristic.properties.write || writeCharacteristic.properties.writeWithoutResponse;
        const canNotify = notifyCharacteristic.properties.notify || notifyCharacteristic.properties.indicate;
        if (!canWrite) throw new Error(`${config.label} write characteristic is not writable.`);
        if (!canNotify) throw new Error(`${config.label} notification characteristic cannot notify.`);
        transport = { ...config, writeCharacteristic, notifyCharacteristic };
        break;
      } catch { /* Try the next known BLE UART profile. */ }
    }
    if (!transport) throw new Error('No supported serial service was found on this device.');
    state.writeCharacteristic = transport.writeCharacteristic;
    state.notifyCharacteristic = transport.notifyCharacteristic;
    connectionStage = `subscribing to ${transport.label} notifications`;
    await state.notifyCharacteristic.startNotifications();
    state.notifyCharacteristic.addEventListener('characteristicvaluechanged', handleNotification);
    await sleep(250);
    state.mode = 'vehicle';
    clearInterval(demoTimer);
    state.values = { ...emptyValues };
    state.sensorUpdatedAt = {};
    state.history = {};
    state.codes = [];
    state.codeScanComplete = false;
    resetAiResult();
    resetVehicleIdentity();
    state.tripMiles = 0;
    state.speedSamples = [];
    state.sensorLastPolled = {};
    state.fastBundleIds = [];
    state.lastFastPoll = 0;
    state.fastTimingConfigured = false;
    state.sampleTimestamps = [];
    SENSOR_DEFS.forEach((sensor) => { sensor.available = null; });
    $('#adapterName').textContent = device.name || 'BLE OBD adapter';
    setConnectionUI(device.name || 'Vehicle connected', true);
    renderSensorRows(); renderSignalOptions(); renderCodes(); updateLiveValues();
    $('#connectDialog').close();
    connectionStage = 'initializing the OBD adapter';
    await initializeAdapter();
    connectionStage = 'reading the vehicle sensor list';
    setConnectionUI('Detecting vehicle protocol…', true);
    const supportedCount = await discoverSupportedPids(25000);
    if (supportedCount) await configureFastTiming();
    await refreshAdapterVoltage();
    await detectFastBundleSupport();
    startVehiclePolling();
    if (supportedCount) {
      setConnectionUI(device.name || 'Vehicle connected', true);
      showToast(`${device.name || 'OBD adapter'} connected.`);
      inspectConnectedVehicle();
    } else {
      setConnectionUI(`${device.name || 'Adapter'} · waiting for vehicle`, true);
      showToast('Adapter connected, but the vehicle has not responded. Keep the ignition on; detection will retry.');
    }
  } catch (error) {
    if (state.device) state.device.removeEventListener('gattserverdisconnected', handleDisconnect);
    if (state.device?.gatt?.connected) state.device.gatt.disconnect();
    resetDisconnectedState();
    if (error.name !== 'NotFoundError') {
      const message = /GATT operation not permitted/i.test(error.message || '')
        ? `The adapter rejected ${connectionStage}. Close other OBD apps, unplug and reconnect the adapter, then try again.`
        : error.message || 'Could not connect to that adapter.';
      showToast(message);
    }
  } finally {
    filteredButton.disabled = false;
    allButton.disabled = false;
    filteredButton.querySelector('span').textContent = 'Find OBD devices';
    allButton.textContent = 'Adapter not listed? Show all devices';
  }
}

function handleNotification(event) {
  const text = new TextDecoder().decode(event.target.value);
  state.responseBuffer += text;
  if (state.responseBuffer.includes('>') && state.pendingCommand) {
    const response = state.responseBuffer;
    state.responseBuffer = '';
    const pending = state.pendingCommand;
    state.pendingCommand = null;
    clearTimeout(pending.timer);
    pending.resolve(response);
  }
}

async function writeCommand(command) {
  const bytes = new TextEncoder().encode(`${command}\r`);
  const characteristic = state.writeCharacteristic;
  if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
    await characteristic.writeValueWithoutResponse(bytes);
  } else if (characteristic.properties.write && characteristic.writeValueWithResponse) {
    await characteristic.writeValueWithResponse(bytes);
  } else if (characteristic.properties.write) {
    await characteristic.writeValue(bytes);
  } else {
    throw new Error('The selected Bluetooth characteristic is not writable.');
  }
}

async function sendCommand(command, timeout = 2200) {
  if (!state.writeCharacteristic) throw new Error('No adapter is connected.');
  if (state.pendingCommand) throw new Error('Adapter is busy.');
  state.responseBuffer = '';
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => {
      if (state.pendingCommand?.command === command) state.pendingCommand = null;
      console.warn(`[OBD] ${command} timed out after ${timeout} ms`);
      reject(new Error(`No response to ${command}`));
    }, timeout);
    state.pendingCommand = { command, resolve, reject, timer };
    try { await writeCommand(command); } catch (error) { clearTimeout(timer); state.pendingCommand = null; reject(error); }
  });
}

async function initializeAdapter() {
  setConnectionUI('Initializing adapter…', true);
  const commands = [['ATZ', 4000], ['ATE0', 1800], ['ATL0', 1800], ['ATS0', 1800], ['ATH0', 1800], ['ATSP0', 3500]];
  for (const [command, timeout] of commands) {
    try { await sendCommand(command, timeout); } catch (error) { if (command !== 'ATZ') throw error; }
    await sleep(80);
  }
  setConnectionUI(state.device?.name || 'Vehicle connected', true);
}

function responseBytes(response) {
  const output = [];
  response.toUpperCase().split(/[\r\n]+/).forEach((line) => {
    const compact = line.replace(/SEARCHING\.{0,3}|BUS INIT[^A-F0-9]*/g, '').replace(/[^A-F0-9]/g, '');
    if (compact.length >= 4 && compact.length % 2 === 0 && !/NODATA|STOPPED|ERROR/.test(line.replace(/\s/g, ''))) {
      const bytes = compact.match(/.{2}/g)?.map((pair) => parseInt(pair, 16));
      if (bytes?.every(Number.isFinite)) output.push(bytes);
    }
  });
  return output;
}

function extractMode01(response, pid) {
  const target = parseInt(pid, 16);
  for (const bytes of responseBytes(response)) {
    const index = bytes.findIndex((byte, i) => byte === 0x41 && bytes[i + 1] === target);
    if (index >= 0) return bytes.slice(index + 2);
  }
  return null;
}

async function refreshAdapterVoltage() {
  const sensor = sensorById('voltage');
  try {
    const response = await sendCommand(sensor.command, 2500);
    const value = sensor.decodeResponse(response);
    if (!Number.isFinite(value)) throw new Error('Invalid ATRV response.');
    state.values.voltage = value;
    sensor.available = true;
    updateLiveValues();
    renderSensorRows();
    renderSignalOptions();
    return true;
  } catch {
    sensor.available = false;
    return false;
  }
}

async function configureFastTiming() {
  if (state.fastTimingConfigured) return;
  for (const command of ['ATAT2', 'ATST0A']) {
    try { await sendCommand(command, 1800); } catch { /* Older adapters may ignore timing controls. */ }
  }
  state.fastTimingConfigured = true;
}

function applySensorValue(sensor, value) {
  if (!Number.isFinite(value)) return false;
  state.values[sensor.id] = value;
  state.sensorUpdatedAt[sensor.id] = Date.now();
  state.sampleTimestamps.push(state.sensorUpdatedAt[sensor.id]);
  const rateElement = $('#sensorRate');
  if (rateElement) rateElement.textContent = currentSampleRate().toFixed(1);
  if (sensor.id === 'speed') {
    state.speedSamples.push(value);
    if (state.speedSamples.length > 120) state.speedSamples.shift();
  }
  return true;
}

function readSensorResponse(sensor, response) {
  if (sensor.command) return sensor.decodeResponse(response);
  const payload = extractMode01(response, sensor.pid);
  return payload ? sensor.decode(payload) : Number.NaN;
}

async function detectFastBundleSupport() {
  const sensors = FAST_SENSOR_IDS.map(sensorById)
    .filter((sensor) => sensor?.available)
    .sort((a, b) => parseInt(a.pid, 16) - parseInt(b.pid, 16));
  if (sensors.length < 2) return false;
  try {
    const response = await sendCommand(`01${sensors.map((sensor) => sensor.pid).join('')}`, 3000);
    const readings = sensors.map((sensor) => [sensor, readSensorResponse(sensor, response)]);
    if (readings.some(([, value]) => !Number.isFinite(value))) return false;
    readings.forEach(([sensor, value]) => applySensorValue(sensor, value));
    state.fastBundleIds = sensors.map((sensor) => sensor.id);
    state.lastFastPoll = Date.now();
    console.info(`[OBD] Combined fast polling enabled for ${state.fastBundleIds.join(', ')}.`);
    updateLiveValues();
    pushHistory();
    return true;
  } catch {
    return false;
  }
}

async function discoverSupportedPids(initialTimeout = 25000) {
  const supported = new Set();
  for (const basePid of ['00', '20', '40', '60', '80', 'A0']) {
    try {
      const response = await sendCommand(`01${basePid}`, basePid === '00' ? initialTimeout : 5000);
      const data = extractMode01(response, basePid);
      if (!data || data.length < 4) break;
      const base = parseInt(basePid, 16);
      data.slice(0, 4).forEach((byte, byteIndex) => {
        for (let bit = 0; bit < 8; bit += 1) if (byte & (1 << (7 - bit))) supported.add((base + byteIndex * 8 + bit + 1).toString(16).toUpperCase().padStart(2, '0'));
      });
      if (!supported.has((base + 0x20).toString(16).toUpperCase().padStart(2, '0'))) break;
    } catch { break; }
  }
  if (supported.size) SENSOR_DEFS.forEach((sensor) => {
    if (!sensor.command) sensor.available = supported.has(sensor.pid);
  });
  if (!state.selected.length) state.selected = ['rpm', 'speed', 'coolant'].filter((id) => sensorById(id)?.available);
  renderSensorRows();
  renderSignalOptions();
  return supported.size;
}

function startVehiclePolling() {
  clearTimeout(state.pollTimer);
  const poll = async () => {
    if (state.mode !== 'vehicle' || !state.server?.connected) return;
    if (state.suspendPolling) { state.pollTimer = setTimeout(poll, 120); return; }
    const available = SENSOR_DEFS.filter((sensor) => sensor.available);
    const vehicleSensors = available.filter((sensor) => !sensor.command);
    if (!vehicleSensors.length) {
      await refreshAdapterVoltage();
      const supportedCount = await discoverSupportedPids(6000);
      if (supportedCount) {
        await configureFastTiming();
        await detectFastBundleSupport();
        setConnectionUI(state.device?.name || 'Vehicle connected', true);
        showToast('Vehicle data detected.');
        inspectConnectedVehicle();
      }
      state.pollTimer = setTimeout(poll, supportedCount ? 5 : 5000);
      return;
    }
    const bundled = new Set(state.fastBundleIds.filter((id) => sensorById(id)?.available));
    const now = Date.now();
    const tasks = available
      .filter((sensor) => !bundled.has(sensor.id))
      .map((sensor) => ({ type: 'sensor', sensor, interval: POLL_INTERVALS[sensor.id] || 1500, last: state.sensorLastPolled[sensor.id] || 0 }));
    if (bundled.size > 1) tasks.push({ type: 'bundle', interval: 120, last: state.lastFastPoll });
    const task = tasks.reduce((best, candidate) => {
      const score = (now - candidate.last) / candidate.interval;
      const bestScore = best ? (now - best.last) / best.interval : -Infinity;
      return score > bestScore ? candidate : best;
    }, null);
    if (!task) { state.pollTimer = setTimeout(poll, 250); return; }
    try {
      let changed = false;
      if (task.type === 'bundle') {
        const sensors = [...bundled].map(sensorById);
        state.lastFastPoll = now;
        const response = await sendCommand(`01${sensors.map((sensor) => sensor.pid).join('')}`);
        sensors.forEach((sensor) => { changed = applySensorValue(sensor, readSensorResponse(sensor, response)) || changed; });
      } else {
        const { sensor } = task;
        state.sensorLastPolled[sensor.id] = now;
        const response = await sendCommand(sensor.command || `01${sensor.pid}`);
        changed = applySensorValue(sensor, readSensorResponse(sensor, response));
      }
      if (changed) {
        updateLiveValues();
        pushHistory();
      }
    } catch { /* Keep polling; inexpensive adapters occasionally skip a frame. */ }
    state.pollTimer = setTimeout(poll, 5);
  };
  poll();
}

function resetDisconnectedState(showDisconnectedToast = false) {
  clearTimeout(state.pollTimer);
  if (state.pendingCommand) {
    clearTimeout(state.pendingCommand.timer);
    state.pendingCommand.reject(new Error('Adapter disconnected.'));
    state.pendingCommand = null;
  }
  state.server = null; state.writeCharacteristic = null; state.notifyCharacteristic = null;
  state.device = null;
  state.mode = 'idle';
  state.values = { ...emptyValues };
  state.sensorUpdatedAt = {};
  state.history = {};
  state.codes = [];
  state.codeScanComplete = false;
  resetAiResult();
  resetVehicleIdentity();
  state.tripMiles = 0;
  state.speedSamples = [];
  state.sensorLastPolled = {};
  state.fastBundleIds = [];
  state.lastFastPoll = 0;
  state.fastTimingConfigured = false;
  state.sampleTimestamps = [];
  SENSOR_DEFS.forEach((sensor) => { sensor.available = null; });
  $('#adapterName').textContent = 'Not connected';
  setConnectionUI('Not connected', false);
  clearInterval(demoTimer);
  renderSensorRows(); renderSignalOptions(); renderCodes(); updateLiveValues(); drawChart();
  if (showDisconnectedToast) showToast('Adapter disconnected.');
}

function handleDisconnect() {
  resetDisconnectedState(true);
}

function disconnectDevice() {
  if (state.device?.gatt?.connected) state.device.gatt.disconnect();
  else $('#connectDialog').showModal();
}

function parseDtcResponse(response, replyMode, status) {
  const codes = [];
  responseBytes(response).forEach((bytes) => {
    const start = bytes.indexOf(replyMode);
    if (start < 0) return;
    for (let i = start + 1; i + 1 < bytes.length; i += 2) {
      const first = bytes[i], second = bytes[i + 1];
      if (first === 0 && second === 0) break;
      const family = ['P', 'C', 'B', 'U'][first >> 6];
      const code = `${family}${(first >> 4) & 3}${(first & 15).toString(16).toUpperCase()}${second.toString(16).toUpperCase().padStart(2, '0')}`;
      codes.push(enrichCode(code, status));
    }
  });
  return codes;
}

async function scanCodes() {
  const button = $('#scanCodes');
  if (state.suspendPolling) { showToast('Wait for the current OBD request to finish.'); return; }
  if (state.mode !== 'vehicle') {
    renderCodes();
    showToast(state.mode === 'demo' ? 'Connect a vehicle to replace the optional demo codes.' : 'Connect an OBD adapter before scanning.');
    return;
  }
  button.disabled = true;
  button.lastChild.textContent = 'Scanning…';
  state.suspendPolling = true;
  try {
    while (state.pendingCommand) await sleep(40);
    await dtcCatalogReady;
    const stored = await sendCommand('03', 4500);
    const pending = await sendCommand('07', 4500);
    state.codes = [...parseDtcResponse(stored, 0x43, 'Stored'), ...parseDtcResponse(pending, 0x47, 'Pending')];
    state.codeScanComplete = true;
    resetAiResult();
    renderCodes();
    showToast(state.codes.length ? `${state.codes.length} trouble code${state.codes.length === 1 ? '' : 's'} found.` : 'No trouble codes found.');
  } catch (error) { showToast(`Scan failed: ${error.message}`); }
  finally { state.suspendPolling = false; button.disabled = false; button.lastChild.textContent = 'Scan again'; }
}

async function clearCodes() {
  if (state.mode === 'idle') { showToast('Connect an OBD adapter before clearing codes.'); return; }
  if (state.suspendPolling) { showToast('Wait for the current OBD request to finish.'); return; }
  if (!confirm('Clear trouble codes and reset readiness monitors? Only continue after the underlying fault has been repaired.')) return;
  if (state.mode === 'vehicle') {
    state.suspendPolling = true;
    try { while (state.pendingCommand) await sleep(40); await sendCommand('04', 4500); }
    catch (error) { showToast(`Could not clear codes: ${error.message}`); return; }
    finally { state.suspendPolling = false; }
  }
  state.codes = [];
  state.codeScanComplete = false;
  resetAiResult();
  renderCodes();
  showToast(state.mode === 'vehicle' ? 'Clear command sent. Re-scan to confirm.' : 'Demo codes cleared.');
}

async function setDemoMode() {
  if (state.device?.gatt?.connected) state.device.gatt.disconnect();
  await dtcCatalogReady;
  state.mode = 'demo';
  state.values = { ...initialValues };
  state.sensorUpdatedAt = Object.fromEntries(Object.keys(initialValues).map((id) => [id, Date.now()]));
  state.codes = demoCodes.map(({ code, status }) => enrichCode(code, status));
  state.codeScanComplete = true;
  resetAiResult();
  resetVehicleIdentity();
  state.selected = ['rpm', 'speed', 'coolant'];
  state.tripMiles = 18.6;
  state.speedSamples = [48];
  SENSOR_DEFS.forEach((sensor) => { sensor.available = demoSupport[sensor.id]; });
  $('#adapterName').textContent = 'Not connected';
  setConnectionUI('Demo stream', false);
  $('#connectDialog').close();
  clearInterval(demoTimer);
  demoTimer = setInterval(tickDemo, 750);
  renderSensorRows(); renderSignalOptions(); renderCodes(); updateLiveValues();
  showToast('Demo telemetry is active.');
}

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const report = (error) => console.warn('WebMCP registration failed', error);
  const tools = [
    {
      name: 'navigate_to_obd_section', title: 'Open OBD section', description: 'Open the dashboard, sensors, visualize, or diagnose section in the visible app.',
      inputSchema: { type: 'object', properties: { section: { type: 'string', enum: ['dashboard', 'sensors', 'visualize', 'diagnose'] } }, required: ['section'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) { if (!input || !['dashboard', 'sensors', 'visualize', 'diagnose'].includes(input.section)) throw new Error('Invalid section'); navigate(input.section); return { section: input.section }; }
    },
    {
      name: 'configure_chart_signals', title: 'Configure live chart', description: 'Choose one to four available sensor IDs to display in the live comparison chart.',
      inputSchema: { type: 'object', properties: { sensorIds: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } } }, required: ['sensorIds'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || !Array.isArray(input.sensorIds) || input.sensorIds.length < 1 || input.sensorIds.length > 4) throw new Error('Choose one to four sensor IDs.');
        const unique = [...new Set(input.sensorIds)];
        if (unique.some((id) => !sensorById(id)?.available)) throw new Error('Every sensor must be available.');
        state.selected = unique; renderSignalOptions(); navigate('visualize'); drawChart();
        return { sensorIds: state.selected };
      }
    },
    {
      name: 'read_current_telemetry', title: 'Read current telemetry', description: 'Read the latest visible values for available vehicle sensors.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() { return { source: state.mode, values: Object.fromEntries(SENSOR_DEFS.filter((sensor) => sensor.available).map((sensor) => [sensor.id, { value: state.values[sensor.id], unit: sensor.unit }])) }; }
    }
  ];
  tools.forEach((tool) => { try { Promise.resolve(context.registerTool(tool)).catch(report); } catch (error) { report(error); } });
}

$$('.nav-item').forEach((item) => item.addEventListener('click', () => navigate(item.dataset.view)));
$('#mobileMenu').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
$('#connectButton').addEventListener('click', disconnectDevice);
$('#dashboardConnect').addEventListener('click', disconnectDevice);
$('#pairDevice').addEventListener('click', () => connectBluetooth(false));
$('#showAllDevices').addEventListener('click', () => connectBluetooth(true));
$('#useDemo').addEventListener('click', setDemoMode);
$('#sensorSearch').addEventListener('input', (event) => { state.sensorSearch = event.target.value; renderSensorRows(); });
$$('.segmented button').forEach((button) => button.addEventListener('click', () => {
  $$('.segmented button').forEach((item) => item.classList.toggle('is-selected', item === button));
  state.sensorFilter = button.dataset.filter; renderSensorRows();
}));
$('#chartSearch').addEventListener('input', (event) => { state.chartSearch = event.target.value; renderSignalOptions(); });
$('#pauseChart').addEventListener('click', () => {
  state.paused = !state.paused;
  $('#pauseChart').lastChild.textContent = state.paused ? 'Resume' : 'Pause';
  $('#pauseChart .icon').className = `icon icon-player-${state.paused ? 'play' : 'pause'}`;
  $('.stream-state').classList.toggle('paused', state.paused);
  $('#streamText').textContent = state.paused ? 'PAUSED' : 'STREAMING';
});
$('#resetChart').addEventListener('click', () => { state.history = {}; pushHistory(); showToast('Chart history reset.'); });
$('#scanCodes').addEventListener('click', scanCodes);
['#vehicleYear', '#vehicleMake', '#vehicleModel'].forEach((selector) => $(selector).addEventListener('input', () => { resetAiResult(); updateConnectionLabel(); }));
$('#analyzeAi').addEventListener('click', analyzeWithAi);
$('#clearCodes').addEventListener('click', clearCodes);
window.addEventListener('resize', drawChart);
window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'dashboard', false));

renderTicks();
renderSensorRows();
renderSignalOptions();
renderCodes();
updateLiveValues();
renderVehicleIdentity();
setConnectionUI('Not connected', false);
function updateClock() {
  $('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
}
updateClock();
setInterval(updateClock, 1000);
setInterval(renderSafety, 2000);
navigate(['dashboard', 'sensors', 'visualize', 'diagnose'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard', false);
registerWebMcpTools();
