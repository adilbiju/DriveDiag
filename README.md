# DriveDiag

DriveDiag is a browser-based vehicle diagnostics tool that connects directly to compatible BLE OBD-II adapters using Web Bluetooth. It provides real-time vehicle telemetry, sensor visualization, diagnostic trouble code scanning, and local vehicle health alerts. An optional AI-assisted diagnostic feature uses trouble codes, sensor data, and vehicle information to suggest possible causes and next troubleshooting steps.

Checkout a non-AI version of DriveDiag [here](https://adilbiju.github.io/DriveDiag/).


## What it does

- **Dashboard:** speed, RPM, engine load, coolant temperature, fuel level, adapter supply voltage, and locally evaluated vehicle alerts.
- **Sensors:** discover supported OBD-II PIDs, inspect available readings, and filter or search the sensor list.
- **Visualize:** chart up to four available signals, with pause and reset controls.
- **Diagnose:** scan stored and pending diagnostic trouble codes (DTCs).
- **Vehicle identity:** read the VIN from a responding vehicle and use NHTSA vPIC to display its make and model beside the clock when available.
<!-- AI_ONLY_START -->
- **AI analysis:** optionally send a diagnostic snapshot to Gemini for possible causes and next checks.
<!-- AI_ONLY_END -->
- **DTC catalog:** show local titles and short descriptions for 9,533 standardized generic P, B, C, and U codes.

## Requirements

- Node.js 18 or newer. There are no npm dependencies or build step.
- A browser with [Web Bluetooth support](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API), such as a compatible version of Chrome or Edge.
- A BLE OBD-II adapter. An adapter name appearing in the device picker does **not** guarantee compatibility. Bluetooth Classic-only adapters cannot connect through Web Bluetooth.
- A vehicle with an OBD-II port and its ignition on for live readings.

## Run locally

From the project directory:

```sh
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173)\
Press `Ctrl+C` in the terminal to stop the server.\
To choose another port, run `PORT=4174 npm start` and open that port instead.

In the app, select **Connect OBD**, choose your adapter, and allow the browser's Bluetooth request. The default picker filters for common OBD adapter names; use **Adapter not listed? Show all devices** if yours is hidden. Select **Continue with demo data** if you want to test out the interface with synthetic data.

<!-- AI_ONLY_START -->
## Optional AI analysis

The dashboard, sensor readings, charts, DTC scan, and local alerts work without an AI key. To enable **Analyze snapshot**, set `GEMINI_API_KEY` in the server process environment before starting DriveDiag. You can optionally set `GEMINI_MODEL`; the code defaults to `gemini-3.5-flash-lite`. Restart the server after changing either variable.

```sh
GEMINI_API_KEY={Enter-key} npm start
```

AI analysis is user-initiated after a code scan. It can be wrong and has not been given a vehicle service manual. Verify any procedure or specification against service information for your vehicle.
<!-- AI_ONLY_END -->

## Data handling

- Live OBD readings and charts are kept in browser's local memory.
- After the vehicle responds, the browser reads its VIN and requests year, make, and model from the **NHTSA vPIC API**.
<!-- AI_ONLY_START -->
- The VIN is not included in the Gemini snapshot.
- Clicking **Analyze snapshot** sends DTCs, recent available sensor values, and year/make/model to the local server and then to the **Gemini API**.
<!-- AI_ONLY_END -->
- Generic DTC titles and descriptions are loaded locally from `public/data/dtc-codes.json`. The catalog is derived from the [CC0-licensed OBDex dataset](https://github.com/foerbsnavi/obdex). No code lookup request is sent to an external service.

## Safety and limitations

DriveDiag is a diagnostic aid, not a substitute for the vehicle's warnings, a service manual, or a qualified mechanic. The local coolant, oil-temperature, misfire-code, and fuel-trim alerts use generic screening rules. A stored code may be historical, and missing or stale readings cannot be assessed. Do not operate the app while driving.

## Troubleshooting

- **No adapter appears:** check that Bluetooth is enabled, use a Web Bluetooth-capable browser, and try **Show all devices**.
- **Adapter connects but readings stay empty:** turn the ignition on and confirm the adapter supports BLE. Close other apps that may already be using it, then reconnect.
- **VIN cannot be decoded:** vehicle data can still be viewed; the connection label falls back to the adapter name.
<!-- AI_ONLY_START -->
- **AI analysis fails:** check that `GEMINI_API_KEY` is set for the running server, that `GEMINI_MODEL` is available to that key, and that the provider's quota has not been reached.
<!-- AI_ONLY_END -->

## Branch synchronization

`non-ai-version` is generated from `main` by `.github/workflows/sync-non-ai.yml`. Shared browser and server files are copied as-is. The generator omits `public/ai.js`, `public/ai.css`, and `server-ai.js`, removes blocks enclosed by `AI_ONLY_START` / `AI_ONLY_END` comments from HTML and Markdown files, and deploys the generated `public/` directory to the GitHub Pages site.


## Project layout

```text
public/             Browser UI, Bluetooth/OBD logic, safety rules, VIN parser, and assets
public/data/        Local generic DTC title and description catalog
server.js           Local HTTP server and NHTSA lookup
package.json        Node.js requirement and start script
```

<!-- AI_ONLY_START -->
The AI feature is isolated in `public/ai.js`, `public/ai.css`, and `server-ai.js`.
<!-- AI_ONLY_END -->
