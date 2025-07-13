<script lang="ts">

import type {
	MetricCard as MetricCardType,
	AnalyticsResponse,
	MetricsStreamEvent,
	ServiceType,
	// Legacy types for backward compatibility
	AnyMetric,
	MetricsSummary,
} from "$lib/types";
import { metricsApi } from "$lib/services/metrics-api";
import { onMount } from "svelte";
import { browser } from "$app/environment";

// Dynamic imports for browser-only chart components (to avoid SSR issues with LayerChart)
let _chartComponents = $state<{
	ModelUsageChart?: any;
}>({});

console.log("Dashboard loading - LayerChart implementation with Svelte 5");

// Modern Svelte 5 reactive state using new Analytics API
let analyticsData = $state<AnalyticsResponse | null>(null);
let _isLoading = $state(true);
let eventSource = $state<EventSource | null>(null);
let notifications = $state<
	Array<{ id: string; message: string; timestamp: Date }>
>([]);
let notificationCount = $state(0);

// Filter states for enhanced dashboard views
const selectedServiceType = $state<string | null>(null);
const selectedModel = $state<string | null>(null);
const selectedTimeRange = $state<number>(24); // Hours

// Legacy state for backward compatibility during transition
let metricsData = $state<AnyMetric[]>([]);
let _summaryData = $state<MetricsSummary | null>(null);
let _summariesHistory = $state<
	Array<{ timestamp: string; summary: MetricsSummary }>
>([]);

// Derived metrics for cards using new Analytics API
const _dashboardMetrics = $derived<MetricCardType[]>([
	{
		id: "total-requests",
		label: "Total Requests",
		value: analyticsData?.summary?.total_requests?.toString() ?? "0",
		icon: "requests",
		iconColor: "blue",
		change: "+0%", // TODO: Calculate change from previous period
		changeColor: "green",
	},
	{
		id: "success-rate",
		label: "Success Rate",
		value: analyticsData?.summary
			? `${((analyticsData.summary.successful_requests / analyticsData.summary.total_requests) * 100).toFixed(1)}%`
			: "0%",
		icon: "success",
		iconColor: "green",
		change: "+0%", // TODO: Calculate change
		changeColor: "green",
	},
	{
		id: "avg-response-time",
		label: "Avg Response Time",
		value: analyticsData?.summary?.avg_response_time
			? `${analyticsData.summary.avg_response_time.toFixed(0)}s`
			: "0s",
		icon: "time",
		iconColor: "yellow",
		change: "+0%", // TODO: Calculate change
		changeColor: "green",
	},
	{
		id: "total-cost",
		label: "Total Cost",
		value: analyticsData?.summary?.total_cost_usd
			? `$${analyticsData.summary.total_cost_usd.toFixed(4)}`
			: "$0.00",
		icon: "cost",
		iconColor: "green",
		change: "+0%", // TODO: Calculate change
		changeColor: "green",
	},
]);

// Derived data for charts using new Analytics API
const _serviceBreakdownData = $derived.by(() => {
	console.log(
		"🔄 Processing serviceBreakdownData, analyticsData:",
		analyticsData,
	);
	if (!analyticsData?.service_breakdown) {
		console.log("❌ No service_breakdown data available");
		return [];
	}

	console.log("📊 Raw service_breakdown:", analyticsData.service_breakdown);
	const total = analyticsData.service_breakdown.reduce(
		(sum: number, service: any) => sum + service.request_count,
		0,
	);

	const result = analyticsData.service_breakdown.map((service: any) => ({
		...service,
		percentage: total > 0 ? (service.request_count / total) * 100 : 0,
	}));

	console.log("✅ Processed serviceBreakdownData:", result);
	return result;
});

const _modelUsageData = $derived.by(() => {
	console.log("🔄 Processing modelUsageData, analyticsData:", analyticsData);
	if (!analyticsData?.model_stats) {
		console.log("❌ No model_stats data available");
		return [];
	}

	console.log("📊 Raw model_stats:", analyticsData.model_stats);
	const total = analyticsData.model_stats.reduce(
		(sum: number, model: any) => sum + model.request_count,
		0,
	);

	const result = analyticsData.model_stats.map((model: any) => ({
		...model,
		percentage: total > 0 ? (model.request_count / total) * 100 : 0,
	}));

	console.log("✅ Processed modelUsageData:", result);
	return result;
});

const _timeSeriesData = $derived.by(() => {
	console.log("🔄 Processing timeSeriesData, analyticsData:", analyticsData);
	if (!analyticsData?.hourly_data) {
		console.log("❌ No hourly_data available");
		return [];
	}

	console.log("📊 Raw hourly_data:", analyticsData.hourly_data);
	const result = analyticsData.hourly_data.map((item: any) => ({
		timestamp: item.hour,
		value: item.request_count,
		label: `${item.request_count} requests`,
	}));

	console.log("✅ Processed timeSeriesData:", result);
	return result;
});

// Filter metrics by type using $derived
const _requestMetrics = $derived.by(() => {
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
		timeGroups.get(key)?.push(metric);
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

// Load initial data using new Analytics API
async function loadDashboardData() {
	try {
		_isLoading = true;
		console.log("🚀 Loading analytics data for dashboard...");

		// Test basic connectivity first
		console.log("🔍 Testing API connectivity...");
		try {
			const testResponse = await fetch("/metrics/status");
			console.log(
				"🔍 Status endpoint response:",
				testResponse.status,
				testResponse.statusText,
			);
			if (testResponse.ok) {
				const statusData = await testResponse.json();
				console.log("✅ Status data:", statusData);
			}
		} catch (testError) {
			console.error("❌ Status endpoint failed:", testError);
		}

		// Load analytics data with current filters
		const params = {
			hours: selectedTimeRange,
			...(selectedServiceType && {
				service_type: selectedServiceType as ServiceType,
			}),
			...(selectedModel && { model: selectedModel }),
		};

		console.log("📊 Requesting analytics with params:", params);

		analyticsData = await metricsApi.getAnalytics(params);
		console.log("📊 Analytics data loaded:", analyticsData);
		console.log("📊 Analytics data keys:", Object.keys(analyticsData || {}));
		console.log("📊 Service breakdown:", analyticsData?.service_breakdown);
		console.log("📊 Model stats:", analyticsData?.model_stats);
		console.log("📊 Hourly data:", analyticsData?.hourly_data);

		// Also load legacy data for backward compatibility during transition
		try {
			const summaryResponse = await fetch("/metrics/summary");
			if (summaryResponse.ok) {
				_summaryData = await summaryResponse.json();
			}

			const metricsResponse = await fetch("/metrics/data?limit=100");
			if (metricsResponse.ok) {
				const data = await metricsResponse.json();
				metricsData = data.data || [];
			}

			// Create historical summaries from metrics data if available
			if (metricsData && metricsData.length > 0) {
				_summariesHistory = createHistoricalSummaries(metricsData);
			}
		} catch (legacyError) {
			console.warn("Failed to load legacy data:", legacyError);
		}
	} catch (error) {
		console.error("❌ Failed to load analytics data:", error);
		console.error("❌ Error details:", {
			message: error.message,
			status: error.status,
			stack: error.stack,
		});

		// Try to fall back to legacy API
		try {
			console.log("Falling back to legacy API...");
			const summaryResponse = await fetch("/metrics/summary");
			if (summaryResponse.ok) {
				_summaryData = await summaryResponse.json();
			}
		} catch (fallbackError) {
			console.error("Legacy API fallback also failed:", fallbackError);
		}
	} finally {
		_isLoading = false;
	}
}

// Function to reload data when filters change
async function _reloadAnalytics() {
	try {
		const params = {
			hours: selectedTimeRange,
			...(selectedServiceType && {
				service_type: selectedServiceType as ServiceType,
			}),
			...(selectedModel && { model: selectedModel }),
		};

		analyticsData = await metricsApi.getAnalytics(params);
		console.log("Analytics data reloaded with filters:", params, analyticsData);
	} catch (error) {
		console.error("Failed to reload analytics data:", error);
	}
}

// Audio notification function
function playNotificationSound() {
	try {
		// Create a simple beep sound using Web Audio API
		const audioContext = new (
			window.AudioContext || (window as any).webkitAudioContext
		)();
		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();

		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);

		oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
		oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

		gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
		gainNode.gain.exponentialRampToValueAtTime(
			0.01,
			audioContext.currentTime + 0.2,
		);

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
		timestamp: new Date(),
	};

	notifications = [notification, ...notifications.slice(0, 4)]; // Keep last 5
	notificationCount++;

	console.log("Notifications array:", notifications);
	console.log("Notification count:", notificationCount);

	// Play sound
	playNotificationSound();

	// Auto-remove after 5 seconds
	setTimeout(() => {
		notifications = notifications.filter((n) => n.id !== notification.id);
	}, 5000);
}

// Setup SSE for real-time updates using new stream format
function setupSSE() {
	try {
		eventSource = metricsApi.createSSEConnection();
		console.log("Setting up modern SSE event listeners...");

		// Add event listener for when the connection opens
		eventSource.onopen = () => {
			console.log("🔗 SSE connection opened");
			addNotification("🔗 Connected to live stream");
		};

		// Handle new SSE event format
		eventSource.onmessage = (event) => {
			console.log("📨 SSE message received:", event);

			try {
				const streamEvent: MetricsStreamEvent = JSON.parse(event.data);
				console.log("📈 Parsed stream event:", streamEvent);

				switch (streamEvent.type) {
					case "connection":
						console.log("🔗 Connection event:", streamEvent.message);
						addNotification(`🔗 ${streamEvent.message}`);
						break;

					case "analytics_update":
						console.log("📊 Analytics update received");
						analyticsData = streamEvent.data;
						addNotification("📊 New data available");
						break;

					case "heartbeat":
						console.log("💓 Heartbeat:", streamEvent.stats);
						// Update connection status without notification
						break;

					case "error":
						console.error("❌ Stream error:", streamEvent.message);
						addNotification(`❌ ${streamEvent.message}`);
						break;

					case "disconnect":
						console.log("🔌 Disconnect:", streamEvent.message);
						addNotification(`🔌 ${streamEvent.message}`);
						break;

					default:
						console.log("Unknown event type:", streamEvent);
				}
			} catch (error) {
				console.error("❌ Failed to parse stream event:", error);
				console.log("Raw data:", event.data);

				// Try to handle as legacy metric data for backward compatibility
				try {
					const data = JSON.parse(event.data);
					if (data.metric_type) {
						console.log("📊 Processing legacy metric:", data.metric_type);
						metricsData = [...metricsData.slice(-99), data];
						addNotification(`📈 ${data.metric_type} event`);
					}
				} catch (_legacyError) {
					console.log("Not parseable JSON data:", event.data);
				}
			}
		};

		eventSource.onerror = (error) => {
			console.error("SSE connection error:", error);
			addNotification("❌ Connection error");
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

			_chartComponents = {
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
					<!-- Filter Controls -->
					<div class="flex items-center space-x-2">
						<select
							bind:value={selectedTimeRange}
							onchange={() => reloadAnalytics()}
							class="text-sm border border-gray-300 rounded px-2 py-1"
						>
							<option value={1}>Last Hour</option>
							<option value={6}>Last 6 Hours</option>
							<option value={24}>Last 24 Hours</option>
							<option value={168}>Last 7 Days</option>
						</select>

						{#if analyticsData?.service_breakdown && analyticsData.service_breakdown.length > 0}
							<select
								bind:value={selectedServiceType}
								onchange={() => reloadAnalytics()}
								class="text-sm border border-gray-300 rounded px-2 py-1"
							>
								<option value={null}>All Services</option>
								{#each analyticsData.service_breakdown as service}
									<option value={service.service_type}>{service.service_type}</option>
								{/each}
							</select>
						{/if}

						{#if analyticsData?.model_stats && analyticsData.model_stats.length > 0}
							<select
								bind:value={selectedModel}
								onchange={() => reloadAnalytics()}
								class="text-sm border border-gray-300 rounded px-2 py-1"
							>
								<option value={null}>All Models</option>
								{#each analyticsData.model_stats as model}
									<option value={model.model}>{model.model}</option>
								{/each}
							</select>
						{/if}
					</div>

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

			<!-- Service Breakdown Chart -->
			{#if serviceBreakdownData.length > 0}
				{#await import("$lib/components/SimpleServiceBreakdown.svelte") then { default: SimpleServiceBreakdown }}
					<div class="mb-8">
						<SimpleServiceBreakdown data={serviceBreakdownData} />
					</div>
				{/await}
			{/if}

			<!-- Model Usage Chart -->
			<div class="flex justify-center mb-8">
				<div class="w-full max-w-4xl">
					{#if chartComponents.ModelUsageChart}
						{@const Component = chartComponents.ModelUsageChart}
						<Component summary={summaryData} modelData={modelUsageData} />
					{:else}
						<div class="bg-white rounded-lg shadow p-6">
							<h3 class="text-lg font-semibold text-gray-900 mb-4">Model Usage</h3>
							{#if modelUsageData.length > 0}
								<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									{#each modelUsageData as model}
										<div class="border rounded-lg p-4">
											<div class="flex items-center justify-between mb-2">
												<h4 class="font-medium text-gray-900">{model.model}</h4>
												<span class="text-sm text-gray-500">{model.percentage.toFixed(1)}%</span>
											</div>
											<div class="space-y-1 text-sm text-gray-600">
												<div class="flex justify-between">
													<span>Requests:</span>
													<span class="font-medium">{model.request_count}</span>
												</div>
												<div class="flex justify-between">
													<span>Avg Response:</span>
													<span class="font-medium">{model.avg_response_time.toFixed(2)}s</span>
												</div>
												<div class="flex justify-between">
													<span>Total Cost:</span>
													<span class="font-medium">${model.total_cost.toFixed(4)}</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="h-64 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
									<p class="text-gray-500">Loading chart...</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Time Series Chart -->
			{#if timeSeriesData.length > 0}
				{#await import("$lib/components/SimpleTimeSeriesChart.svelte") then { default: SimpleTimeSeriesChart }}
					<div class="mb-8">
						<SimpleTimeSeriesChart data={timeSeriesData} />
					</div>
				{/await}
			{/if}

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
							<strong>Analytics Data:</strong> {analyticsData ? 'Loaded' : 'None'}
						</div>
						<div>
							<strong>Raw Service Breakdown:</strong> {analyticsData?.service_breakdown?.length || 0} items
						</div>
						<div>
							<strong>Processed Service Types:</strong> {serviceBreakdownData.length} types
						</div>
						<div>
							<strong>Raw Model Stats:</strong> {analyticsData?.model_stats?.length || 0} items
						</div>
						<div>
							<strong>Processed Models:</strong> {modelUsageData.length} models
						</div>
						<div>
							<strong>Raw Hourly Data:</strong> {analyticsData?.hourly_data?.length || 0} items
						</div>
						<div>
							<strong>Processed Time Series Points:</strong> {timeSeriesData.length} points
						</div>
						<div>
							<strong>Selected Time Range:</strong> {selectedTimeRange}h
						</div>
						<div>
							<strong>Selected Service:</strong> {selectedServiceType || 'All'}
						</div>
						<div>
							<strong>Selected Model:</strong> {selectedModel || 'All'}
						</div>
						<div>
							<strong>SSE:</strong> {eventSource ? 'Connected' : 'Disconnected'}
						</div>
						<div>
							<strong>Legacy Metrics:</strong> {metricsData.length} items
						</div>
						<div>
							<strong>Legacy Request Metrics:</strong> {requestMetrics.length} items
						</div>
					</div>
					{#if analyticsData}
						<div class="mt-2 pt-2 border-t border-gray-300">
							<strong>Query Time:</strong> {analyticsData.query_time.toFixed(3)}s
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</main>
</div>
