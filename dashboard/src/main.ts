import "./styles/main.css";
import { dashboardController } from "./components/dashboard";

/**
 * Main entry point for the metrics dashboard
 */
async function initializeDashboard(): Promise<void> {
	try {
		console.log("Initializing Claude Code Proxy Metrics Dashboard...");

		// Wait for DOM to be fully loaded
		if (document.readyState === "loading") {
			await new Promise((resolve) => {
				document.addEventListener("DOMContentLoaded", resolve);
			});
		}

		// Initialize the dashboard
		await dashboardController.initialize();

		console.log("Dashboard initialized successfully");
	} catch (error) {
		console.error("Failed to initialize dashboard:", error);

		// Show error in the UI
		const loadingOverlay = document.getElementById("loading-overlay");
		if (loadingOverlay) {
			loadingOverlay.innerHTML = `
        <div class="bg-white rounded-lg p-6 flex flex-col items-center space-y-4">
          <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="text-center">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Dashboard Error</h3>
            <p class="text-gray-600">Failed to initialize the metrics dashboard.</p>
            <p class="text-sm text-gray-500 mt-2">${error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
          <button
            onclick="window.location.reload()"
            class="px-4 py-2 bg-claude-600 text-white rounded-lg hover:bg-claude-700 transition-colors"
          >
            Retry
          </button>
        </div>
      `;
		}
	}
}

/**
 * Handle page visibility changes to pause/resume updates
 */
function handleVisibilityChange(): void {
	if (document.hidden) {
		// Page is hidden, could pause updates
		console.log("Dashboard paused (page hidden)");
	} else {
		// Page is visible, resume updates
		console.log("Dashboard resumed (page visible)");
	}
}

/**
 * Handle page unload to cleanup resources
 */
function handlePageUnload(): void {
	console.log("Cleaning up dashboard resources...");
	dashboardController.destroy();
}

/**
 * Setup global event listeners
 */
function setupGlobalListeners(): void {
	// Handle visibility changes
	document.addEventListener("visibilitychange", handleVisibilityChange);

	// Handle page unload
	window.addEventListener("beforeunload", handlePageUnload);

	// Handle errors globally
	window.addEventListener("error", (event) => {
		console.error("Global error:", event.error);
	});

	// Handle unhandled promise rejections
	window.addEventListener("unhandledrejection", (event) => {
		console.error("Unhandled promise rejection:", event.reason);
	});
}

/**
 * Initialize the application
 */
async function main(): Promise<void> {
	setupGlobalListeners();
	await initializeDashboard();
}

// Start the application
main().catch((error) => {
	console.error("Critical error starting dashboard:", error);
});

// Export for debugging purposes
if (typeof window !== "undefined") {
	(window as any).dashboardController = dashboardController;
}
