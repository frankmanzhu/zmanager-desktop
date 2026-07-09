import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";

import { AppShell } from "./ui/react/AppShell";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("missing app root");
}

createRoot(app).render(
  createElement(StrictMode, null, createElement(AppShell)),
);
