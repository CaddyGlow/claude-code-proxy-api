import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["src/setupTests.ts"],
		include: ["src/**/*.{test,spec}.{js,ts}"],
		exclude: ["node_modules", "build", "e2e/**/*"],
		fakeTimers: {
			toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"coverage/**",
				"build/**",
				"node_modules/**",
				"e2e/**",
				"**/*.d.ts",
				"**/stories/**",
				"src/setupTests.ts",
				"src/test-utils/**",
				"**/*.config.*",
				"**/index.ts",
			],
			thresholds: {
				statements: 80,
				branches: 80,
				functions: 80,
				lines: 80,
			},
		},
	},
	define: {
		// Make sure we're in browser environment
		"process.env.NODE_ENV": '"test"',
	},
	resolve: {
		alias: {
			$lib: new URL("./src/lib", import.meta.url).pathname,
		},
	},
});
