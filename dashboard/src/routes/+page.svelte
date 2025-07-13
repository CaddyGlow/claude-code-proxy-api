<script lang="ts">
import { MetricCard } from "$lib/components";
import type {
	MetricCard as MetricCardType,
	AnyMetric,
	MetricsSummary,
} from "$lib/types";
import { onMount } from "svelte";
import { browser } from "$app/environment";

// Dynamic imports for browser-only chart components (to avoid SSR issues with LayerCake)
let chartComponents = $state<{
	ModelUsageChart?: any;
}>({});

console.log("Dashboard loading - LayerChart implementation with Svelte 5");

// Modern Svelte 5 reactive state
let metricsData = $state<AnyMetric[]>([]);
let summaryData = $state<MetricsSummary | null>(null);
let summariesHistory = $state<
	Array<{ timestamp: string; summary: MetricsSummary }>
>([]);
let isLoading = $state(true);
let eventSource = $state<EventSource | null>(null);
let notifications = $state<Array<{ id: string; message: string; timestamp: Date }>>([]);
let notificationCount = $state(0);

// Derived metrics for cards using $derived
const dashboardMetrics = $derived<MetricCardType[]>([
	{
		id: "total-requests",
		label: "Total Requests",
		value: summaryData?.requests?.total?.toString() ?? "0",
		icon: "requests",
		iconColor: "blue",
		change: "+0%", // TODO: Calculate change
		changeColor: "green",
	},
	{
		id: "success-rate",
		label: "Success Rate",
		value: summaryData?.requests?.success_rate
			? `${(summaryData.requests.success_rate * 100).toFixed(1)}%`
			: "0%",
		icon: "success",
		iconColor: "green",
		change: "+0%", // TODO: Calculate change
		changeColor: "green",
	},
	{
		id: "avg-response-time",
		label: "Avg Response Time",
		value: summaryData?.performance?.avg_response_time_ms
			? `${summaryData.performance.avg_response_time_ms.toFixed(0)}ms`
			: "0ms",
		icon: "clock",
		iconColor: "yellow",
		change: "+0%", // TODO: Calculate change
		changeColor: "green",
	},
	{
		id: "total-cost",
		label: "Total Cost",
		value: summaryData?.costs?.total
			? `$${summaryData.costs.total.toFixed(4)}`
			: "$0.00",
		icon: "dollar",
		iconColor: "green",
		change: "+0%", // TODO: Calculate change
		changeColor: "green",
	},
]);

// Filter metrics by type using $derived
const requestMetrics = $derived.by(() => {
	const filtered = metricsData.filter(
		(m) =>
			m.metric_type === "request" &&
			// Filter out browser/system requests, focus on actual API calls
			!m.path?.includes(".well-known") &&
			!m.path?.includes("favicon") &&
			m.path !== "/" &&
			m.status_code !== 404,
	);

	console.log("requestMetrics - total metrics:", metricsData.length);
	console.log("requestMetrics - filtered request metrics:", filtered.length);
	console.log("requestMetrics - sample filtered metric:", filtered[0]);

	return filtered;
});

// Create historical summaries from raw metrics data
function createHistoricalSummaries(
	metrics: AnyMetric[],
): Array<{ timestamp: string; summary: MetricsSummary }> {
	console.log(
		"createHistoricalSummaries called with:",
		metrics.length,
		"metrics",
	);
	// Group metrics by time intervals (e.g., every 5 minutes)
	const timeGroups = new Map<string, AnyMetric[]>();

	metrics.forEach((metric) => {
		const date = new Date(metric.timestamp);
		// Round to nearest 5 minutes for grouping
		date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
		const key = date.toISOString();

		if (!timeGroups.has(key)) {
			timeGroups.set(key, []);
		}
		timeGroups.get(key)!.push(metric);
	});

	// Convert groups to summary objects
	const summaries: Array<{ timestamp: string; summary: MetricsSummary }> = [];

	for (const [timestamp, groupMetrics] of timeGroups) {
		const responseMetrics = groupMetrics.filter(
			(m) => m.metric_type === "response",
		);
		const requestMetrics = groupMetrics.filter(
			(m) => m.metric_type === "request",
		);
		const costMetrics = groupMetrics.filter((m) => m.metric_type === "cost");

		// Calculate aggregated values
		const totalRequests = requestMetrics.length;
		const successfulRequests = responseMetrics.filter(
			(m) => m.status_code >= 200 && m.status_code < 400,
		).length;
		const failedRequests = totalRequests - successfulRequests;

		const responseTimes = responseMetrics
			.map((m) => m.response_time_ms)
			.filter((t) => t != null);
		const avgResponseTime =
			responseTimes.length > 0
				? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
				: 0;

		responseTimes.sort((a, b) => a - b);
		const p95Index = Math.floor(responseTimes.length * 0.95);
		const p99Index = Math.floor(responseTimes.length * 0.99);

		const totalCost = costMetrics.reduce(
			(sum, m) => sum + (m.total_cost || 0),
			0,
		);

		const summary: MetricsSummary = {
			time_period: {
				start_time: timestamp,
				end_time: new Date(
					new Date(timestamp).getTime() + 5 * 60 * 1000,
				).toISOString(),
				duration_hours: 1 / 12, // 5 minutes
			},
			requests: {
				total: totalRequests,
				successful: successfulRequests,
				failed: failedRequests,
				error_rate: totalRequests > 0 ? failedRequests / totalRequests : 0,
				success_rate:
					totalRequests > 0 ? successfulRequests / totalRequests : 0,
			},
			performance: {
				avg_response_time_ms: avgResponseTime,
				p95_response_time_ms: responseTimes[p95Index] || avgResponseTime,
				p99_response_time_ms: responseTimes[p99Index] || avgResponseTime,
			},
			tokens: {
				total_input: costMetrics.reduce(
					(sum, m) => sum + (m.input_tokens || 0),
					0,
				),
				total_output: costMetrics.reduce(
					(sum, m) => sum + (m.output_tokens || 0),
					0,
				),
				total: costMetrics.reduce(
					(sum, m) => sum + (m.input_tokens || 0) + (m.output_tokens || 0),
					0,
				),
				avg_input_per_request: 0,
				avg_output_per_request: 0,
			},
			costs: {
				total: totalCost,
				avg_per_request: totalRequests > 0 ? totalCost / totalRequests : 0,
				currency: "USD",
			},
			usage: {
				unique_users: 0,
				peak_requests_per_minute: 0,
				requests_per_hour: totalRequests * 12, // Convert 5-min window to hourly rate
			},
			models: {},
			errors: {},
		};

		summaries.push({ timestamp, summary });
	}

	// Sort by timestamp and return last 20 entries
	const result = summaries
		.sort(
			(a, b) =>
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		)
		.slice(-20);

	console.log(
		"createHistoricalSummaries returning:",
		result.length,
		"summaries",
	);
	console.log("Sample summary:", result[0]);
	console.log("Sample summary performance:", result[0]?.summary?.performance);
	return result;
}

// Load initial data
async function loadDashboardData() {
	try {
		isLoading = true;

		// Load summary data
		const summaryResponse = await fetch("/metrics/summary");
		if (summaryResponse.ok) {
			summaryData = await summaryResponse.json();
		}

		// Load recent metrics
		const metricsResponse = await fetch("/metrics/data?limit=100");
		if (metricsResponse.ok) {
			const data = await metricsResponse.json();
			metricsData = data.data || [];
		}

		// Create historical summaries from metrics data
		if (metricsData && metricsData.length > 0) {
			console.log(
				"Creating historical summaries from metrics:",
				metricsData.length,
				"metrics",
			);
			summariesHistory = createHistoricalSummaries(metricsData);
			console.log(
				"Generated summaries history:",
				summariesHistory.length,
				"summaries",
			);
		} else if (summaryData) {
			// Fallback to current summary if no historical data
			console.log("Using fallback current summary");
			summariesHistory = [
				{
					timestamp: new Date().toISOString(),
					summary: summaryData,
				},
			];
		}
	} catch (error) {
		console.error("Failed to load dashboard data:", error);
	} finally {
		isLoading = false;
	}
}

// Audio notification function
function playNotificationSound() {
	try {
		// Create a simple beep sound using Web Audio API
		const audioContext = new (window.AudioContext || window.webkitAudioContext)();
		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();

		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);

		oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
		oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

		gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
		gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

		oscillator.start(audioContext.currentTime);
		oscillator.stop(audioContext.currentTime + 0.2);
	} catch (error) {
		console.log("Audio notification not available:", error);
	}
}

// Add notification function
function addNotification(message: string) {
	console.log("Adding notification:", message);

	const notification = {
		id: Date.now().toString(),
		message,
		timestamp: new Date()
	};

	notifications = [notification, ...notifications.slice(0, 4)]; // Keep last 5
	notificationCount++;

	console.log("Notifications array:", notifications);
	console.log("Notification count:", notificationCount);

	// Play sound
	playNotificationSound();

	// Auto-remove after 5 seconds
	setTimeout(() => {
		notifications = notifications.filter(n => n.id !== notification.id);
	}, 5000);
}

// Setup SSE for real-time updates
function setupSSE() {
	try {
		eventSource = new EventSource("/metrics/stream");

		console.log("Setting up SSE event listeners...");

		// Add event listener for when the connection opens
		eventSource.onopen = () => {
			console.log("🔗 SSE connection opened");
			addNotification("🔗 Connected to live stream");
		};

		// Function to handle metric events
		const handleMetricEvent = (event) => {
			console.log("📊 Metric event received:", event);
			console.log("Event data:", event.data);

			try {
				const data = JSON.parse(event.data);
				console.log("📈 Parsed metric data:", data);

				const metric = data;
				metricsData = [...metricsData.slice(-99), metric]; // Keep last 100

				console.log("🔔 Adding notification for metric type:", metric.metric_type);

				// Add notification for new metric
				if (metric.metric_type === "request") {
					addNotification(`📨 ${metric.method} ${metric.path}`);
				} else if (metric.metric_type === "response") {
					const status = metric.status_code >= 400 ? "❌" : "✅";
					addNotification(`${status} ${metric.status_code} (${metric.response_time_ms?.toFixed(0)}ms)`);
				} else if (metric.metric_type === "cost") {
					addNotification(`💰 $${metric.total_cost?.toFixed(4)}`);
				} else {
					// Catch any other metric types
					addNotification(`📈 ${metric.metric_type} event`);
				}
			} catch (error) {
				console.error("❌ Failed to parse metric event:", error);
				console.log("Raw data that failed to parse:", event.data);
			}
		};

		// Listen for named 'metric' events
		eventSource.addEventListener('metric', handleMetricEvent);

		// Listen for named 'connected' events
		eventSource.addEventListener('connected', (event) => {
			console.log("🔗 Connected event received:", event);
			try {
				const data = JSON.parse(event.data);
				console.log("🔗 Connection data:", data);
				addNotification("🔗 Stream ready!");
			} catch (error) {
				console.error("❌ Failed to parse connected event:", error);
			}
		});

		// Fallback for default message events (should catch anything not specifically named)
		eventSource.onmessage = (event) => {
			console.log("📨 Default message event received:", event);
			console.log("Event type:", event.type);
			console.log("Event data:", event.data);

			// Try to handle as metric data anyway
			try {
				const data = JSON.parse(event.data);
				if (data.metric_type) {
					console.log("📊 Processing metric from default message:", data.metric_type);
					handleMetricEvent(event);
				}
			} catch (error) {
				console.log("Not JSON data:", event.data);
			}
		};

		eventSource.onerror = (error) => {
			console.error("SSE connection error:", error);
		};
	} catch (error) {
		console.error("Failed to setup SSE:", error);
	}
}

// Cleanup function
function cleanup() {
	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}
}

// Load chart components dynamically (browser-only)
async function loadChartComponents() {
	if (browser) {
		try {
			const modules = await Promise.all([
				import("$lib/components/charts/ModelUsageChart.svelte"),
			]);

			chartComponents = {
				ModelUsageChart: modules[0].default,
			};
		} catch (error) {
			console.error("Failed to load chart components:", error);
		}
	}
}

// Modern Svelte 5 lifecycle using onMount
onMount(() => {
	loadChartComponents();
	loadDashboardData();
	setupSSE();

	// Test notification after 2 seconds
	setTimeout(() => {
		addNotification("🔧 Test notification - notifications are working!");
	}, 2000);

	// Return cleanup function
	return cleanup;
});
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="bg-white shadow-sm border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center h-16">
				<div class="flex items-center space-x-3">
					<div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
						<svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
							<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
					</div>
					<div>
						<h1 class="text-xl font-bold text-gray-900">Claude Code Proxy</h1>
						<p class="text-sm text-gray-500">Real-time Metrics Dashboard</p>
					</div>
				</div>
				<div class="flex items-center space-x-4">
					<div class="flex items-center space-x-1">
						<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						<span class="text-sm text-gray-500">Live</span>
					</div>
					{#if notificationCount > 0}
						<div class="flex items-center space-x-1 text-sm text-blue-600">
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path d="M10 2C5.03 2 1 6.03 1 11c0 1.33.29 2.59.8 3.73L1 19l4.27-.8C6.41 18.71 7.67 19 9 19h1c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/>
							</svg>
							<span>{notificationCount} events</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<div class="flex items-center space-x-2">
					<div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
					<span class="text-gray-600">Loading dashboard...</span>
				</div>
			</div>
		{:else}
			<!-- Metric Cards -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				{#each dashboardMetrics as metric (metric.id)}
					<MetricCard {metric} />
				{/each}
			</div>

			<!-- Model Usage Chart -->
			<div class="flex justify-center mb-8">
				<div class="w-full max-w-4xl">
					{#if chartComponents.ModelUsageChart}
						{@const Component = chartComponents.ModelUsageChart}
						<Component summary={summaryData} />
					{:else}
						<div class="bg-white rounded-lg shadow p-6">
							<h3 class="text-lg font-semibold text-gray-900 mb-4">Model Usage</h3>
							<div class="h-64 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
								<p class="text-gray-500">Loading chart...</p>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Live Notifications -->
			{#if notifications.length > 0}
				<div class="fixed top-4 right-4 z-50 space-y-2">
					{#each notifications as notification (notification.id)}
						<div class="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg max-w-sm animate-in slide-in-from-right duration-300">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<p class="text-sm font-medium">{notification.message}</p>
									<p class="text-xs text-blue-200 mt-1">
										{notification.timestamp.toLocaleTimeString()}
									</p>
								</div>
								<button
									onclick={() => notifications = notifications.filter(n => n.id !== notification.id)}
									class="ml-2 text-blue-200 hover:text-white transition-colors"
								>
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Debug Info (Development) -->
			{#if import.meta.env.DEV}
				<div class="bg-gray-100 rounded-lg p-4 text-xs">
					<h4 class="font-semibold text-gray-700 mb-2">Debug Info:</h4>
					<div class="grid grid-cols-2 gap-4 text-gray-600">
						<div>
							<strong>Metrics:</strong> {metricsData.length} items
						</div>
						<div>
							<strong>Request Metrics:</strong> {requestMetrics.length} items
						</div>
						<div>
							<strong>Summaries:</strong> {summariesHistory.length} items
						</div>
						<div>
							<strong>SSE:</strong> {eventSource ? 'Connected' : 'Disconnected'}
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</main>
</div>
