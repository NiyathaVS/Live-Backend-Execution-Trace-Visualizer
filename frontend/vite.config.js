import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        port: process.env.VITE_PORT || 5173,
        host: process.env.VITE_HOST || "localhost",
        proxy: {
            "/traces": {
                target: process.env.VITE_API_URL || "http://localhost:8080",
                changeOrigin: true
            }
        }
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.js"]
    }
});
