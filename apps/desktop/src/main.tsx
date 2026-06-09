import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LiquidGlassProvider } from "./components/LiquidGlassProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LiquidGlassProvider>
      <App />
    </LiquidGlassProvider>
  </React.StrictMode>,
);
