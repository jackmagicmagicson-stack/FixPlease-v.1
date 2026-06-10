import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LiquidGlassProvider } from "./components/LiquidGlassProvider";
import { warmUpNotificationSound } from "./notify";
import "./styles.css";

function unlockNotificationSound() {
  warmUpNotificationSound();
  window.removeEventListener("pointerdown", unlockNotificationSound);
}

window.addEventListener("pointerdown", unlockNotificationSound, { once: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LiquidGlassProvider>
      <App />
    </LiquidGlassProvider>
  </React.StrictMode>,
);
