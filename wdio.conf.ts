import { resolve } from "node:path";

const appBinaryPath = process.env.ZMANAGER_GUI_APP_PATH ?? resolve(
  "src-tauri",
  "target",
  "debug",
  process.platform === "win32" ? "zmanager-desktop.exe" : "zmanager-desktop",
);

export const config: WebdriverIO.Config = {
  runner: "local",
  // The embedded Tauri service owns one native window. Import all native specs
  // through one worker so window-size/maximize tests cannot race each other.
  specs: ["./e2e/tauri/all.spec.ts"],
  maxInstances: 1,
  maxInstancesPerCapability: 1,
  services: [["@wdio/tauri-service", {
    appBinaryPath,
    driverProvider: "embedded",
    embeddedPort: 4445,
  }]],
  capabilities: [{
    browserName: "tauri",
    "wdio:maxInstances": 1,
    "tauri:options": {
      application: appBinaryPath,
    },
  }],
  framework: "jasmine",
  reporters: ["spec"],
  jasmineOpts: {
    defaultTimeoutInterval: 60_000,
  },
  waitforTimeout: 10_000,
  connectionRetryTimeout: 90_000,
  connectionRetryCount: 2,
  logLevel: "info",
};
