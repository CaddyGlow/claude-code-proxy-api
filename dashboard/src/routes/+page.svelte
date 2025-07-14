<script lang="ts">
import type {
	MetricCard as MetricCardType,
	AnalyticsResponse,
	MetricsStreamEvent,
	ServiceType,
} from "$lib/types/metrics";
import { metricsApi } from "$lib/services/metrics-api";
import { onMount } from "svelte";
import { browser } from "$app/environment";
import MetricCard from "$lib/components/MetricCard.svelte";

// Dynamic imports for browser-only chart components (to avoid SSR issues with LayerChart)
let chartComponents = $state<{
	ModelUsageChart?: any;
}>({});

// Modern Svelte 5 reactive state using new Analytics API
let analyticsData = $state<AnalyticsResponse | null>(null);
let isLoading = $state(true);
let eventSource = $state<EventSource | null>(null);
let notifications = $state<
	Array<{ id: string; message: string; timestamp: Date }>
>([]);
let notificationCount = $state(0);

// Flash effect state for live updates
let isFlashing = $state(false);

// Filter states for enhanced dashboard views
let selectedServiceType = $state<string | null>(null);
let selectedModel = $state<string | null>(null);
let selectedTimeRange = $state<number>(24); // Hours

// Derived metrics for cards using new Analytics API
const dashboardMetrics = $derived<MetricCardType[]>([
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
const serviceBreakdownData = $derived.by(() => {
	if (!analyticsData?.service_breakdown) {
		return [];
	}

	const total = analyticsData.service_breakdown.reduce(
		(sum: number, service: any) => sum + service.request_count,
		0,
	);

	return analyticsData.service_breakdown.map((service: any) => ({
		...service,
		percentage: total > 0 ? (service.request_count / total) * 100 : 0,
	}));
});

const modelUsageData = $derived.by(() => {
	if (!analyticsData?.model_stats) {
		return [];
	}

	const total = analyticsData.model_stats.reduce(
		(sum: number, model: any) => sum + model.request_count,
		0,
	);

	return analyticsData.model_stats.map((model: any) => ({
		...model,
		percentage: total > 0 ? (model.request_count / total) * 100 : 0,
	}));
});

const timeSeriesData = $derived.by(() => {
	if (!analyticsData?.hourly_data) {
		return [];
	}

	return analyticsData.hourly_data.map((item: any) => ({
		timestamp: item.hour,
		value: item.request_count,
		label: `${item.request_count} requests`,
	}));
});

// Load initial data using new Analytics API
async function loadDashboardData() {
	try {
		isLoading = true;

		// Load analytics data with current filters
		const params = {
			hours: selectedTimeRange,
			...(selectedServiceType && {
				service_type: selectedServiceType as ServiceType,
			}),
			...(selectedModel && { model: selectedModel }),
		};

		analyticsData = await metricsApi.getAnalytics(params);
	} catch (error) {
		if (import.meta.env.DEV) {
			console.error("❌ Failed to load analytics data:", error);
		}
	} finally {
		isLoading = false;
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
	} catch (error) {
		if (import.meta.env.DEV) {
			console.error("Failed to reload analytics data:", error);
		}
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
		// Audio notification not available
	}
}

// Flash effect function for live updates
function triggerFlashEffect() {
	isFlashing = true;
	setTimeout(() => {
		isFlashing = false;
	}, 1000); // Flash for 1 second
}

// Add notification function
function addNotification(message: string) {
	const notification = {
		id: Date.now().toString(),
		message,
		timestamp: new Date(),
	};

	notifications = [notification, ...notifications.slice(0, 4)]; // Keep last 5
	notificationCount++;

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

		// Add event listener for when the connection opens
		eventSource.onopen = () => {
			if (import.meta.env.DEV) {
				console.log("🔗 SSE connection opened");
			}
			addNotification("🔗 Connected to live stream");
		};

		// Handle new SSE event format
		eventSource.onmessage = (event) => {
			try {
				const streamEvent: MetricsStreamEvent = JSON.parse(event.data);

				switch (streamEvent.type) {
					case "connection":
						addNotification(`🔗 ${streamEvent.message}`);
						break;

					case "analytics_update":
						analyticsData = streamEvent.data;
						triggerFlashEffect(); // Trigger flash animation
						addNotification("📊 New data available");
						break;

					case "heartbeat":
						// Update connection status without notification
						break;

					case "error":
						addNotification(`❌ ${streamEvent.message}`);
						break;

					case "disconnect":
						addNotification(`🔌 ${streamEvent.message}`);
						break;

					default:
						if (import.meta.env.DEV) {
							console.log("Unknown SSE event type:", streamEvent);
						}
				}
			} catch (error) {
				if (import.meta.env.DEV) {
					console.error("❌ Failed to parse stream event:", error);
				}
			}
		};

		eventSource.onerror = (error) => {
			if (import.meta.env.DEV) {
				console.error("SSE connection error:", error);
			}
			addNotification("❌ Connection error");
		};
	} catch (error) {
		if (import.meta.env.DEV) {
			console.error("Failed to setup SSE:", error);
		}
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
			if (import.meta.env.DEV) {
				console.error("Failed to load chart components:", error);
			}
		}
	}
}

// Modern Svelte 5 lifecycle using onMount
onMount(() => {
	loadChartComponents();
	loadDashboardData();
	setupSSE();

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
							onchange={() => _reloadAnalytics()}
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
								onchange={() => _reloadAnalytics()}
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
								onchange={() => _reloadAnalytics()}
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
					<MetricCard {metric} {isFlashing} />
				{/each}
			</div>

			<!-- Service Breakdown Chart -->
			{#if serviceBreakdownData.length > 0}
				{#await import("$lib/components/SimpleServiceBreakdown.svelte") then { default: SimpleServiceBreakdown }}
					<div class="mb-8">
						<SimpleServiceBreakdown data={serviceBreakdownData} {isFlashing} />
					</div>
				{/await}
			{/if}

			<!-- Model Usage Chart -->
			<div class="flex justify-center mb-8">
				<div class="w-full max-w-4xl">
					{#if chartComponents.ModelUsageChart}
						{@const Component = chartComponents.ModelUsageChart}
						<Component modelData={modelUsageData} {isFlashing} />
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
						<SimpleTimeSeriesChart data={timeSeriesData} {isFlashing} />
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

		{/if}
	</main>
</div>
