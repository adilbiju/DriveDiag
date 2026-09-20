(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DriveDiagSafety = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FRESH_MS = 12000;
  const misfireCode = /^P03(?:0[0-9]|1[0-2])$/i;

  function evaluate({ mode, values, updatedAt, codes, now = Date.now() }) {
    if (mode === 'idle') return [];
    const alerts = [];
    const fresh = (id) => Number.isFinite(values[id]) && Number.isFinite(updatedAt[id]) && now - updatedAt[id] <= FRESH_MS;
    const coolant = fresh('coolant') ? values.coolant : NaN;
    const oil = fresh('oil') ? values.oil : NaN;
    const rpm = fresh('rpm') ? values.rpm : NaN;

    if ((codes || []).some((item) => misfireCode.test(item.code))) {
      alerts.push({ id: 'misfire', level: 'stop', title: 'Misfire code detected', detail: 'Pull over safely and have the vehicle checked. A stored code may be historical; the scan alone cannot confirm an active misfire.' });
    }
    if (coolant >= 250) {
      alerts.push({ id: 'coolant-critical', level: 'stop', title: 'Coolant temperature is very high', detail: `Coolant is ${Math.round(coolant)}°F. Pull over safely and follow your vehicle manual’s overheating instructions.` });
    } else if (coolant >= 235) {
      alerts.push({ id: 'coolant-high', level: 'warn', title: 'Coolant temperature is elevated', detail: `Coolant is ${Math.round(coolant)}°F. Watch the vehicle’s temperature gauge and consult its manual.` });
    }
    if (oil >= 300) {
      alerts.push({ id: 'oil-critical', level: 'stop', title: 'Oil temperature is very high', detail: `Oil is ${Math.round(oil)}°F. Pull over safely and check the vehicle’s service information before continuing.` });
    } else if (oil >= 275) {
      alerts.push({ id: 'oil-high', level: 'warn', title: 'Oil temperature is elevated', detail: `Oil is ${Math.round(oil)}°F. Check the vehicle-specific operating range.` });
    }
    // Fuel trims vary by vehicle and operating state; only assess a warm, running engine.
    if (coolant >= 160 && rpm >= 600 && fresh('shortFuel') && fresh('longFuel')) {
      const combined = values.shortFuel + values.longFuel;
      if (Math.abs(combined) >= 20) {
        alerts.push({ id: 'fuel-trim', level: 'warn', title: 'Fuel correction is outside the screening range', detail: `Bank 1 short + long fuel trim is ${combined.toFixed(1)}%. Check for intake leaks, fuel delivery, and sensor faults.` });
      }
    }
    return alerts.sort((a, b) => Number(b.level === 'stop') - Number(a.level === 'stop'));
  }

  return { evaluate };
});
