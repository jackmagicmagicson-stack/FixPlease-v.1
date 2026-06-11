import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { EmployeeStatusProvider } from "./components/EmployeeStatusProvider";
import { InterfacePrefsProvider } from "./components/InterfacePrefsProvider";
import { LiquidGlassProvider } from "./components/LiquidGlassProvider";
import { applyInterfacePrefs, loadInterfacePrefs } from "./interfacePrefs";
import { warmUpNotificationSound } from "./notify";
import "./employee-ux.css";
import "./styles.css";

applyInterfacePrefs(loadInterfacePrefs());

function unlockNotificationSound() {
  warmUpNotificationSound();
  window.removeEventListener("pointerdown", unlockNotificationSound);
}

window.addEventListener("pointerdown", unlockNotificationSound, { once: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <InterfacePrefsProvider>
      <EmployeeStatusProvider>
        <LiquidGlassProvider>
          <App />
        </LiquidGlassProvider>
      </EmployeeStatusProvider>
    </InterfacePrefsProvider>
  </React.StrictMode>,
);
