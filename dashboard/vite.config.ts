import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
	plugins: [tailwindcss(), sveltekit()],

	// Dev-specific configuration
	...(mode === "development" && {
		server: {
			port: 5173,
			proxy: {
				"/metrics/summary": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
				},
				"/metrics/data": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
				},
				"/metrics/stream": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
				},
			},
		},
	}),

	// Production build configuration
	build: {
		rollupOptions: {
			output: {
				// Single file build for production
				inlineDynamicImports: true,
				manualChunks: undefined,
			},
		},
		cssCodeSplit: false,
		assetsInlineLimit: 100000000, // Inline all assets
	},
}));
