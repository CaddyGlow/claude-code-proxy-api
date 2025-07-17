import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
	plugins: [tailwindcss(), sveltekit()],

	// Dev-specific configuration
	...(mode === "development" && {
		server: {
			port: 5173,
			proxy: {
				// New Analytics API endpoints
				"/metrics/analytics": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
				},
				"/metrics/health": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
				},
				"/metrics/status": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
				},
				"/metrics/query": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
				},
				"/metrics/stream": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
				},
				"/metrics/entries": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
				},
			},
		},
	}),
}));
