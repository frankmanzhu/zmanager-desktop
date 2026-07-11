import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";

import "./styles.tailwind.css";

import { AppShell } from "./ui/react/AppShell";
import { DisposableTaskRuntimeApp } from "./runtime/DisposableTaskRuntimeApp";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("missing app root");
}

const disposableTaskSurface = new URLSearchParams(globalThis.location?.search ?? "")
  .get("surface") === "disposable-task";

createRoot(app).render(createElement(
  StrictMode,
  null,
  disposableTaskSurface
    ? createElement(DisposableTaskRuntimeApp)
    : createElement(AppShell),
));
