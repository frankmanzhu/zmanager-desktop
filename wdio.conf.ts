import { resolve } from "node:path";

const appBinaryPath = process.env.ZMANAGER_GUI_APP_PATH ?? resolve(
  "src-tauri",
  "target",
  "debug",
  process.platform === "win32" ? "zmanager-desktop.exe" : "zmanager-desktop",
);

export const config: WebdriverIO.Config = {
  runner: "local",
  specs: ["./e2e/tauri/**/*.spec.ts"],
  maxInstances: 1,
  services: [["@wdio/tauri-service", {
    appBinaryPath,
    driverProvider: "embedded",
    embeddedPort: 4445,
  }]],
  capabilities: [{
    browserName: "tauri",
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
