import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import "./styles.css";

// Start the application and share sign-in state across all screens.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider><App/></AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

// Save the app shell for quicker repeat visits when the browser supports it.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
