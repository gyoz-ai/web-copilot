import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

// Load self-hosted fonts via runtime URL (avoids Vite @fs path issues in dev)
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = browser.runtime.getURL("/fonts/fonts.css");
document.head.appendChild(fontLink);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
