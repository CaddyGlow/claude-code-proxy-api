<script lang="ts">
import { onMount } from "svelte";
import { browser } from "$app/environment";
import { metricsApi } from "$lib/services/metrics-api";
import type {
  AnalyticsResponse,
  MetricCard as MetricCardType,
  MetricsStreamEvent,
} from "$lib/types/metrics";

// Dynamic imports for browser-only chart components (to avoid SSR issues with LayerChart)
let _chartComponents = $state<{
  ModelUsageChart?: typeof import("$lib/components/charts/ModelUsageChart.svelte").default;
}>({});

// Modern Svelte 5 reactive state using new Analytics API
let analyticsData = $state<AnalyticsResponse | null>(null);
let _isLoading = $state(true);
let eventSource = $state<EventSource | null>(null);
let notifications = $state<Array<{ id: string; message: string; timestamp: Date }>>([]);
let _notificationCount = $state(0);

// SSE event counters
let _totalSSEEvents = $state(0);
let _requestStartCount = $state(0);
let _requestCompleteCount = $state(0);
let _analyticsUpdateCount = $state(0);

// Flash effect state for live updates
let _isFlashing = $state(false);

// Counter animation states
let _isCounterFlashing = $state(false);

// Filter states for enhanced dashboard views
const selectedServiceType = $state<string | null>(null);
const selectedModel = $state<string | null>(null);
const selectedTimeRange = $state<number>(24); // Hours
const selectedStatusCode = $state<number | null>(null);
const selectedStreaming = $state<boolean | null>(null);
const _showAdvancedFilters = $state<boolean>(false);

// Derived metrics for cards using new Analytics API
const _dashboardMetrics = $derived<MetricCardType[]>([
  {
    id: "total-requests",
    label: "Total Requests",
    value: analyticsData?.summary?.total_requests?.toString() ?? "0",
    icon: "requests",
    iconColor: "blue",
    change:
      analyticsData?.summary?.total_successful_requests &&
      analyticsData?.summary?.total_requests
        ? `${analyticsData.summary.total_successful_requests}/${analyticsData.summary.total_requests}`
        : "0/0",
    changeColor: "gray",
  },
  {
    id: "success-rate",
    label: "Success Rate",
    value: analyticsData?.request_analytics?.success_rate
      ? `${analyticsData.request_analytics.success_rate.toFixed(1)}%`
      : "0%",
    icon: "success",
    iconColor:
      analyticsData?.request_analytics?.success_rate &&
      analyticsData.request_analytics.success_rate >= 95
        ? "green"
        : "yellow",
    change: analyticsData?.request_analytics?.error_requests
      ? `${analyticsData.request_analytics.error_requests} errors`
      : "0 errors",
    changeColor:
      analyticsData?.request_analytics?.error_requests &&
      analyticsData.request_analytics.error_requests > 0
        ? "red"
        : "green",
  },
  {
    id: "avg-duration",
    label: "Avg Duration",
    value: analyticsData?.summary?.avg_duration_ms
      ? `${analyticsData.summary.avg_duration_ms.toFixed(0)}ms`
      : "0ms",
    icon: "time",
    iconColor: "yellow",
    change: analyticsData?.summary?.avg_duration_ms
      ? analyticsData.summary.avg_duration_ms < 1000
        ? "Fast"
        : "Slow"
      : "N/A",
    changeColor:
      analyticsData?.summary?.avg_duration_ms &&
      analyticsData.summary.avg_duration_ms < 1000
        ? "green"
        : "yellow",
  },
  {
    id: "total-cost",
    label: "Total Cost",
    value: analyticsData?.summary?.total_cost_usd
      ? `$${analyticsData.summary.total_cost_usd.toFixed(4)}`
      : "$0.0000",
    icon: "cost",
    iconColor: "green",
    change: analyticsData?.token_analytics?.total_tokens
      ? `${analyticsData.token_analytics.total_tokens.toLocaleString()} tokens`
      : "0 tokens",
    changeColor: "blue",
  },
]);

// Derived data for charts using new Analytics API
const _serviceBreakdownData = $derived.by(() => {
  if (!analyticsData?.service_type_breakdown) {
    return [];
  }

  // Convert the nested object structure to an array
  const services = Object.entries(analyticsData.service_type_breakdown).map(
    ([service_type, data]: [
      string,
      NonNullable<typeof analyticsData.service_type_breakdown>[string],
    ]) => ({
      service_type,
      request_count: data.request_count,
      avg_duration_ms: data.avg_duration_ms,
      total_cost_usd: data.total_cost_usd,
      total_tokens_input: data.total_tokens_input,
      total_tokens_output: data.total_tokens_output,
    })
  );

  const total = services.reduce(
    (sum: number, service: { request_count: number }) => sum + service.request_count,
    0
  );

  return services.map((service: (typeof services)[number]) => ({
    ...service,
    percentage: total > 0 ? (service.request_count / total) * 100 : 0,
  }));
});

const _modelUsageData = $derived.by(() => {
  // Since the backend doesn't currently provide model-level stats,
  // we'll show a message indicating this feature is not yet available
  return [];
});

const _timeSeriesData = $derived.by(() => {
  if (!analyticsData?.hourly_data) {
    return [];
  }

  return analyticsData.hourly_data.map(
    (item: NonNullable<typeof analyticsData.hourly_data>[number]) => ({
      timestamp: item.hour,
      value: item.request_count,
      label: `${item.request_count} requests`,
    })
  );
});

// Load initial data using new Analytics API
async function loadDashboardData() {
  try {
    _isLoading = true;

    // Load analytics data with current filters
    const params = {
      hours: selectedTimeRange,
      ...(selectedServiceType && {
        service_type: selectedServiceType,
      }),
      ...(selectedModel && { model: selectedModel }),
      ...(selectedStatusCode && { status_code: selectedStatusCode }),
      ...(selectedStreaming !== null && { streaming: selectedStreaming }),
    };

    analyticsData = await metricsApi.getAnalytics(params);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("Failed to load analytics data:", error);
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
        service_type: selectedServiceType,
      }),
      ...(selectedModel && { model: selectedModel }),
      ...(selectedStatusCode && { status_code: selectedStatusCode }),
      ...(selectedStreaming !== null && { streaming: selectedStreaming }),
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
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
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
  } catch (_error) {
    // Audio notification not available
  }
}

// Flash effect function for live updates
function _triggerFlashEffect() {
  if (import.meta.env.DEV) {
    console.log("Triggering flash effect");
  }
  _isFlashing = true;
  setTimeout(() => {
    _isFlashing = false;
    if (import.meta.env.DEV) {
      console.log("Flash effect ended");
    }
  }, 1500); // Flash for 1.5 seconds for better visibility
}

// Counter flash effect for SSE events
function _triggerCounterFlash() {
  _isCounterFlashing = true;
  setTimeout(() => {
    _isCounterFlashing = false;
  }, 300); // Quick flash for counter updates
}

// Format numbers for display (e.g., 1234 -> 1.2K)
function _formatCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}K`;
  if (count < 1000000) return `${Math.floor(count / 1000)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

// Add notification function
function addNotification(message: string) {
  const notification = {
    id: Date.now().toString(),
    message,
    timestamp: new Date(),
  };

  notifications = [notification, ...notifications.slice(0, 4)]; // Keep last 5
  _notificationCount++;

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
        console.log("SSE connection opened");
      }
      addNotification("Connected to live stream");
    };

    // Handle new SSE event format
    eventSource.onmessage = (event) => {
      try {
        const streamEvent: MetricsStreamEvent = JSON.parse(event.data);

        // Increment total SSE events counter
        _totalSSEEvents++;

        // Trigger counter flash animation
        _triggerCounterFlash();

        switch (streamEvent.type) {
          case "connection":
            addNotification(`Connected: ${streamEvent.message}`);
            break;

          case "analytics_update":
            // Increment analytics update counter
            _analyticsUpdateCount++;

            // Replace data with new analytics snapshot
            if (streamEvent.data) {
              analyticsData = streamEvent.data;

              // Trigger visual flash effect for metric cards
              _triggerFlashEffect();

              // Create detailed notification with analytics info
              const data = streamEvent.data;
              const notificationDetails = [];

              // Add summary info
              if (data.summary) {
                notificationDetails.push(`${data.summary.total_requests} requests`);

                // Add success rate info
                if (data.request_analytics?.success_rate) {
                  notificationDetails.push(
                    `${data.request_analytics.success_rate.toFixed(1)}% success`
                  );
                }

                // Add token info
                if (data.token_analytics?.total_tokens > 0) {
                  notificationDetails.push(
                    `${data.token_analytics.total_tokens.toLocaleString()} tokens`
                  );
                }

                // Add cost info
                if (data.summary.total_cost_usd > 0) {
                  notificationDetails.push(
                    `$${data.summary.total_cost_usd.toFixed(4)}`
                  );
                }
              }

              // Add service type info
              if (
                data.service_type_breakdown &&
                Object.keys(data.service_type_breakdown).length > 0
              ) {
                const activeServices = Object.entries(data.service_type_breakdown)
                  .filter(
                    ([_, serviceData]: [
                      string,
                      NonNullable<typeof data.service_type_breakdown>[string],
                    ]) => serviceData.request_count > 0
                  )
                  .map(
                    ([service_type, _]: [
                      string,
                      NonNullable<typeof data.service_type_breakdown>[string],
                    ]) => service_type.replace("_service", "")
                  )
                  .join(", ");
                if (activeServices) {
                  notificationDetails.push(`Services: ${activeServices}`);
                }
              }

              const detailedMessage =
                notificationDetails.length > 0
                  ? `Update: ${notificationDetails.join(" | ")}`
                  : "New data available";

              addNotification(detailedMessage);
            }
            break;

          case "new_request":
            // Show new request notification with detailed info
            if (streamEvent.data) {
              const requestData = streamEvent.data;
              const details = [];

              if (requestData.model) {
                details.push(`Model: ${requestData.model}`);
              }
              if (requestData.service_type) {
                details.push(
                  `Service: ${requestData.service_type.replace("_service", "")}`
                );
              }
              if (requestData.tokens_input || requestData.tokens_output) {
                const totalTokens =
                  (requestData.tokens_input || 0) + (requestData.tokens_output || 0);
                details.push(`${totalTokens} tokens`);
              }
              if (requestData.cost_usd > 0) {
                details.push(`$${requestData.cost_usd.toFixed(4)}`);
              }

              const message =
                details.length > 0
                  ? `New Request: ${details.join(" | ")}`
                  : "New request completed";

              addNotification(message);
            }
            break;

          case "request_start":
            // Increment request start counter
            _requestStartCount++;

            // Show request start notification
            if (streamEvent.data) {
              const requestData = streamEvent.data;
              const details = [];

              if (requestData.method && requestData.path) {
                details.push(`${requestData.method} ${requestData.path}`);
              }
              if (requestData.client_ip) {
                details.push(`from ${requestData.client_ip}`);
              }

              const message =
                details.length > 0
                  ? `Request Started: ${details.join(" ")}`
                  : "Request started";

              addNotification(message);
            }
            break;

          case "request_complete":
            // Increment request complete counter
            _requestCompleteCount++;

            // Show request completion notification with detailed info
            if (streamEvent.data) {
              const requestData = streamEvent.data;
              const details = [];

              // Add status code
              if (requestData.status_code) {
                const statusText =
                  requestData.status_code >= 200 && requestData.status_code < 300
                    ? "✓"
                    : "✗";
                details.push(`${statusText} ${requestData.status_code}`);
              }

              // Add duration
              if (requestData.duration_ms) {
                const duration =
                  requestData.duration_ms < 1000
                    ? `${Math.round(requestData.duration_ms)}ms`
                    : `${(requestData.duration_ms / 1000).toFixed(2)}s`;
                details.push(duration);
              }

              // Add model
              if (requestData.model) {
                details.push(`Model: ${requestData.model}`);
              }

              // Add service type
              if (requestData.service_type) {
                details.push(
                  `Service: ${requestData.service_type.replace("_service", "")}`
                );
              }

              // Add tokens
              if (requestData.tokens_input || requestData.tokens_output) {
                const totalTokens =
                  (requestData.tokens_input || 0) + (requestData.tokens_output || 0);
                details.push(`${totalTokens} tokens`);
              }

              // Add cost
              if (requestData.cost_usd > 0) {
                details.push(`$${requestData.cost_usd.toFixed(4)}`);
              }

              const message =
                details.length > 0
                  ? `Request Complete: ${details.join(" | ")}`
                  : "Request completed";

              addNotification(message);
            }
            break;

          case "heartbeat":
            // Update connection status without notification
            break;

          case "error":
            addNotification(`Error: ${streamEvent.message}`);
            break;

          case "disconnect":
            addNotification(`Disconnected: ${streamEvent.message}`);
            break;

          default:
            if (import.meta.env.DEV) {
              console.log("Unknown SSE event type:", streamEvent);
            }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to parse stream event:", error);
        }
      }
    };

    eventSource.onerror = (error) => {
      if (import.meta.env.DEV) {
        console.error("SSE connection error:", error);
      }
      addNotification("Connection error");
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

      _chartComponents = {
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
						<div class="flex items-center space-x-2">
							<h1 class="text-xl font-bold text-gray-900">Claude Code Proxy</h1>
							<span class="text-xs px-2 py-1 rounded-full {isDevelopmentVersion() ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
								{formatVersionForDisplay(true)}
							</span>
						</div>
						<p class="text-sm text-gray-500">Real-time Metrics Dashboard</p>
					</div>
				</div>
				<div class="flex items-center space-x-4">
					<!-- Navigation Links -->
					<div class="flex items-center space-x-2">
						<a
							href="/metrics/dashboard/entries"
							class="px-3 py-1 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
						>
							Database Entries
						</a>
					</div>

					<!-- Filter Controls -->
					<div class="flex items-center space-x-2">
						<select
							value={selectedTimeRange}
							onchange={(e) => {
								selectedTimeRange = Number(e.currentTarget.value);
								_reloadAnalytics();
							}}
							class="text-sm border border-gray-300 rounded px-2 py-1"
						>
							<option value={1}>Last Hour</option>
							<option value={6}>Last 6 Hours</option>
							<option value={24}>Last 24 Hours</option>
							<option value={168}>Last 7 Days</option>
						</select>

						<button
							onclick={() => { showAdvancedFilters = !showAdvancedFilters; }}
							class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors {showAdvancedFilters ? 'bg-blue-100 text-blue-800' : ''}"
						>
							Advanced Filters
						</button>
					</div>

					<!-- Advanced Filters -->
					{#if showAdvancedFilters}
						<div class="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded">
							<!-- Status Code Filter -->
							<div class="flex items-center space-x-1">
								<label class="text-xs font-medium text-gray-600">Status:</label>
								<select
									value={selectedStatusCode || ""}
									onchange={(e) => {
										selectedStatusCode = e.currentTarget.value ? Number(e.currentTarget.value) : null;
										_reloadAnalytics();
									}}
									class="text-xs border border-gray-300 rounded px-1 py-0.5"
								>
									<option value="">All</option>
									<option value={200}>200 OK</option>
									<option value={400}>400 Bad Request</option>
									<option value={401}>401 Unauthorized</option>
									<option value={403}>403 Forbidden</option>
									<option value={404}>404 Not Found</option>
									<option value={500}>500 Server Error</option>
									<option value={502}>502 Bad Gateway</option>
									<option value={503}>503 Service Unavailable</option>
								</select>
							</div>

							<!-- Streaming Filter -->
							<div class="flex items-center space-x-1">
								<label class="text-xs font-medium text-gray-600">Streaming:</label>
								<select
									value={selectedStreaming === null ? "" : selectedStreaming ? "true" : "false"}
									onchange={(e) => {
										const val = e.currentTarget.value;
										selectedStreaming = val === "" ? null : val === "true";
										_reloadAnalytics();
									}}
									class="text-xs border border-gray-300 rounded px-1 py-0.5"
								>
									<option value="">All</option>
									<option value="true">Streaming</option>
									<option value="false">Non-streaming</option>
								</select>
							</div>

							<!-- Clear Advanced Filters -->
							<button
								onclick={() => {
									selectedStatusCode = null;
									selectedStreaming = null;
									_reloadAnalytics();
								}}
								class="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded transition-colors"
							>
								Clear
							</button>
						</div>
					{/if}

					<!-- Service Type Filter (moved to separate line) -->
					<div class="flex items-center space-x-4">
						<!-- Service Type Filter -->
						<div class="flex items-center space-x-2">
							<label class="text-sm font-medium text-gray-700">Service:</label>
							<input
								type="text"
								value={selectedServiceType || ""}
								onchange={(e) => {
									selectedServiceType = e.currentTarget.value.trim() || null;
									_reloadAnalytics();
								}}
								placeholder="e.g., anthropic_service,openai_service or !access_log"
								class="text-sm border border-gray-300 rounded px-2 py-1 w-64"
								title="Filter by service type. Use comma-separated values for multiple services, or prefix with ! to exclude (e.g., !access_log)"
							/>
						</div>

						<!-- Quick Service Filter Buttons -->
						{#if analyticsData?.service_type_breakdown && Object.keys(analyticsData.service_type_breakdown).length > 0}
							<div class="flex items-center space-x-1">
								<button
									onclick={() => { selectedServiceType = null; _reloadAnalytics(); }}
									class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors {selectedServiceType === null ? 'bg-blue-100 text-blue-800' : ''}"
								>
									All
								</button>
								{#each Object.keys(analyticsData.service_type_breakdown) as service_type}
									<button
										onclick={() => { selectedServiceType = service_type; _reloadAnalytics(); }}
										class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors {selectedServiceType === service_type ? 'bg-blue-100 text-blue-800' : ''}"
									>
										{service_type.replace('_service', '')}
									</button>
								{/each}
							</div>
						{/if}

						<!-- Model Filter -->
						<div class="flex items-center space-x-2">
							<label class="text-sm font-medium text-gray-700">Model:</label>
							<input
								type="text"
								value={selectedModel || ""}
								onchange={(e) => {
									selectedModel = e.currentTarget.value.trim() || null;
									_reloadAnalytics();
								}}
								placeholder="e.g., claude-3-5-sonnet-20241022"
								class="text-sm border border-gray-300 rounded px-2 py-1 w-48"
								title="Filter by model name"
							/>
							{#if selectedModel}
								<button
									onclick={() => { selectedModel = null; _reloadAnalytics(); }}
									class="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded transition-colors"
								>
									Clear
								</button>
							{/if}
						</div>
					</div>

					<!-- Live Activity Panel -->
					<div class="flex items-center space-x-3">
						<!-- Live Status Indicator -->
						<div class="flex items-center space-x-1">
							<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
							<span class="text-sm text-gray-500">Live</span>
						</div>

						<!-- SSE Event Counters -->
						<div class="flex items-center space-x-2 text-xs">
							<!-- Total Events -->
							<div class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full transition-all duration-300 {_isCounterFlashing ? 'scale-110 bg-blue-200' : ''}">
								<span class="font-medium">{_formatCount(_totalSSEEvents)}</span>
								<span class="opacity-75">events</span>
							</div>

							<!-- Request Flow -->
							{#if _requestStartCount > 0 || _requestCompleteCount > 0}
								<div class="flex items-center space-x-1">
									<div class="bg-orange-100 text-orange-800 px-2 py-1 rounded-full transition-all duration-300 {_isCounterFlashing ? 'scale-110 bg-orange-200' : ''}">
										<span class="font-medium">{_formatCount(_requestStartCount)}</span>
										<span class="opacity-75">started</span>
									</div>
									<div class="bg-green-100 text-green-800 px-2 py-1 rounded-full transition-all duration-300 {_isCounterFlashing ? 'scale-110 bg-green-200' : ''}">
										<span class="font-medium">{_formatCount(_requestCompleteCount)}</span>
										<span class="opacity-75">done</span>
									</div>
								</div>
							{/if}

							<!-- Analytics Updates -->
							{#if _analyticsUpdateCount > 0}
								<div class="bg-purple-100 text-purple-800 px-2 py-1 rounded-full transition-all duration-300 {_isCounterFlashing ? 'scale-110 bg-purple-200' : ''}">
									<span class="font-medium">{_formatCount(_analyticsUpdateCount)}</span>
									<span class="opacity-75">updates</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{#if _isLoading}
			<div class="flex items-center justify-center py-12">
				<div class="flex items-center space-x-2">
					<div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
					<span class="text-gray-600">Loading dashboard...</span>
				</div>
			</div>
		{:else}
			<!-- Metric Cards -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				{#each _dashboardMetrics as metric (metric.id)}
					<MetricCard {metric} isFlashing={_isFlashing} />
				{/each}
			</div>

			<!-- Service Breakdown Chart -->
			{#if _serviceBreakdownData.length > 0}
				{#await import("$lib/components/SimpleServiceBreakdown.svelte") then { default: SimpleServiceBreakdown }}
					<div class="mb-8">
						<SimpleServiceBreakdown data={_serviceBreakdownData} />
					</div>
				{/await}
			{/if}

			<!-- Model Usage Chart -->
			<div class="flex justify-center mb-8">
				<div class="w-full max-w-4xl">
					{#if _chartComponents.ModelUsageChart}
						{@const Component = _chartComponents.ModelUsageChart}
						<Component modelData={_modelUsageData} />
					{:else}
						<div class="bg-white rounded-lg shadow p-6">
							<h3 class="text-lg font-semibold text-gray-900 mb-4">Model Usage</h3>
							<div class="h-64 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
								<div class="text-center">
									<p class="text-gray-500 mb-2">Model-level statistics not available</p>
									<p class="text-sm text-gray-400">The backend analytics API doesn't currently provide model breakdowns</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Time Series Chart -->
			{#if _timeSeriesData.length > 0}
				{#await import("$lib/components/SimpleTimeSeriesChart.svelte") then { default: SimpleTimeSeriesChart }}
					<div class="mb-8">
						<SimpleTimeSeriesChart data={_timeSeriesData} />
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
									aria-label="Close notification"
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
