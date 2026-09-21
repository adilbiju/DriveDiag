# DriveDiag

DriveDiag is a local web app for viewing OBD-II telemetry from a compatible Bluetooth Low Energy (BLE) adapter. It shows live readings, charts selected sensors, and reads trouble codes.

## What it does

- **Dashboard:** speed, RPM, engine load, coolant temperature, fuel level, adapter supply voltage, and locally evaluated vehicle alerts.
- **Sensors:** discover supported OBD-II PIDs, inspect available readings, and filter or search the sensor list.
- **Visualize:** chart up to four available signals, with pause and reset controls.
- **Diagnose:** scan stored and pending diagnostic trouble codes (DTCs).
- **Vehicle identity:** read the VIN from a responding vehicle and use NHTSA vPIC to display its make and model beside the clock when available.

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

## Data handling

- Live OBD readings and charts are kept in browser's local memory.
- After the vehicle responds, the browser reads its VIN and sends it to the local server, which requests year, make, and model from the **NHTSA vPIC API**. The VIN is not stored by this project.

## Safety and limitations

DriveDiag is a diagnostic aid, not a substitute for the vehicle's warnings, a service manual, or a qualified mechanic. The local coolant, oil-temperature, misfire-code, and fuel-trim alerts use generic screening rules. A stored code may be historical, and missing or stale readings cannot be assessed. Do not operate the app while driving.



## Troubleshooting

- **No adapter appears:** check that Bluetooth is enabled, use a Web Bluetooth-capable browser, and try **Show all devices**.
- **Adapter connects but readings stay empty:** turn the ignition on and confirm the adapter supports BLE. Close other apps that may already be using it, then reconnect.
- **VIN cannot be decoded:** vehicle readings still work; the connection label falls back to the adapter name.

## Project layout

```text
public/             Browser UI, Bluetooth/OBD logic, safety rules, VIN parser, and assets
server.js           Local HTTP server and NHTSA lookup
package.json        Node.js requirement and start script
```
