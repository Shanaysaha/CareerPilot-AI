import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite serves the React app and compiles Tailwind styles during development and builds.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "0.0.0.0", port: 5173 },
});
