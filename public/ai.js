(() => {
  const app = window.DriveDiagApp;
  if (!app) throw new Error('DriveDiag core must load before the AI module.');

  const $ = (selector) => document.querySelector(selector);
  const { state, sensors } = app;
  let pending = false;
  let analysisRevision = 0;

  function manualVehicleReady() {
    const year = Number($('#vehicleYear').value);
    return state.vehicleIdentityState === 'fallback'
      && Number.isInteger(year) && year >= 1980 && year <= 2100
      && $('#vehicleMake').value.trim() && $('#vehicleModel').value.trim();
  }

  function updateAvailability() {
    const manualReady = manualVehicleReady();
    const identityReady = state.mode === 'demo' || state.vehicleIdentityState === 'identified' || manualReady;
    const ready = state.mode !== 'idle' && state.codeScanComplete && identityReady;
    $('#analyzeAi').disabled = !ready || pending;
    $('#aiSnapshotHint').textContent = pending ? 'Analyzing…' : state.mode === 'idle' ? 'Connect an OBD adapter first.' : !state.codeScanComplete ? 'Scan codes before analyzing.' : state.vehicleIdentityState === 'loading' || state.vehicleIdentityState === 'waiting' ? 'Identifying the vehicle…' : state.vehicleIdentityState === 'fallback' && !manualReady ? 'Enter year, make and model first.' : state.mode === 'demo' ? 'Demo data will be sent.' : 'Ready to send a snapshot.';
  }

  function resetResult() {
    analysisRevision += 1;
    $('#aiResult').hidden = true;
    $('#aiResult').classList.remove('error');
    $('#aiResultHeading').textContent = 'Suggested next steps';
    $('#aiResultCaution').hidden = false;
    $('#aiResultText').textContent = '';
    updateAvailability();
  }

  function syncVehicleFields() {
    const fields = [
      ['#vehicleYear', state.vehicle.year || ''],
      ['#vehicleMake', state.vehicle.make || ''],
      ['#vehicleModel', state.vehicle.model || '']
    ];
    fields.forEach(([selector, value]) => {
      const input = $(selector);
      if (document.activeElement !== input) input.value = value;
    });
  }

  function renderVehicleIdentity() {
    syncVehicleFields();
    const status = state.vehicleIdentityState;
    const { year, make, model } = state.vehicle;
    const labels = {
      idle: ['Not connected', 'Connect an OBD adapter to identify the vehicle automatically.'],
      waiting: ['Waiting for vehicle', 'Turn the ignition on so the adapter can read the vehicle.'],
      loading: ['Identifying vehicle…', 'Reading the VIN from OBD and decoding year, make and model.'],
      identified: [`${year || ''} ${make} ${model}`.trim(), 'Auto-identified'],
      fallback: ['Vehicle details needed', state.vehicleIdentityMessage || 'Automatic VIN identification was unavailable. Enter year, make and model below.'],
      demo: ['Demo vehicle', 'Synthetic data; no vehicle is connected.']
    };
    const label = labels[status] || labels.idle;
    $('#vehicleIdentityTitle').textContent = label[0];
    $('#vehicleIdentityNote').textContent = label[1];
    $('#manualVehicleFields').hidden = status !== 'fallback';
    updateAvailability();
  }

  function updateManualVehicle() {
    const year = $('#vehicleYear').value.trim();
    state.vehicle = {
      year: /^\d{4}$/.test(year) ? Number(year) : null,
      make: $('#vehicleMake').value.trim().slice(0, 40),
      model: $('#vehicleModel').value.trim().slice(0, 60)
    };
    app.refreshConnectionLabel();
    resetResult();
  }

  async function analyze() {
    if (state.mode === 'idle' || !state.codeScanComplete || pending || $('#analyzeAi').disabled) return;
    const year = $('#vehicleYear').value.trim();
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1980 || Number(year) > 2100)) {
      app.showToast('Enter a valid four-digit model year or leave it blank.');
      return;
    }
    const now = Date.now();
    const currentSensors = sensors
      .filter((sensor) => sensor.available && Number.isFinite(state.values[sensor.id]) && now - (state.sensorUpdatedAt[sensor.id] || 0) <= 30000)
      .map((sensor) => ({ id: sensor.id, name: sensor.name, value: Number(state.values[sensor.id].toFixed(2)), unit: sensor.unit }));
    const snapshot = {
      source: state.mode,
      sampledAt: new Date(now).toISOString(),
      vehicle: { year: year ? Number(year) : null, make: $('#vehicleMake').value.trim().slice(0, 40), model: $('#vehicleModel').value.trim().slice(0, 60) },
      codes: state.codes.map(({ code, status }) => ({ code, status })),
      sensors: currentSensors
    };
    pending = true;
    resetResult();
    const revision = analysisRevision;
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Analysis failed (${response.status}).`);
      if (revision !== analysisRevision) return;
      $('#aiResultText').textContent = data.analysis;
      $('#aiResult').hidden = false;
    } catch (error) {
      if (revision === analysisRevision) {
        $('#aiResultHeading').textContent = 'Analysis unavailable';
        $('#aiResultText').textContent = error instanceof SyntaxError ? 'AI needs the localhost app server. Start it with npm start.' : error.message;
        $('#aiResultCaution').hidden = true;
        $('#aiResult').classList.add('error');
        $('#aiResult').hidden = false;
      }
    } finally {
      pending = false;
      updateAvailability();
    }
  }

  ['#vehicleYear', '#vehicleMake', '#vehicleModel'].forEach((selector) => $(selector).addEventListener('input', updateManualVehicle));
  $('#analyzeAi').addEventListener('click', analyze);
  window.addEventListener('drivediag:change', () => {
    resetResult();
    renderVehicleIdentity();
  });

  resetResult();
  renderVehicleIdentity();
})();
