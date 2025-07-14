import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Configure adapter-static for SPA mode
		adapter: adapter({
			fallback: "index.html",
		}),
		// Set base path for deployment under /metrics/dashboard
		paths: {
			base: "/metrics/dashboard",
		},
	},
};

export default config;
