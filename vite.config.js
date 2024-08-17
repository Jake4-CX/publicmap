import { defineConfig } from "vite";

export default defineConfig({
    optimizeDeps: {
        exclude: ['brotli-wasm']
    },
    esbuild: { legalComments: 'none' },
});