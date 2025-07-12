import type {
	AnyMetric,
	MetricsSummary,
	MetricType,
	SSEEvent,
} from "../types/metrics";
import type { TimeRange } from "../utils/constants";
import { DASHBOARD_CONFIG, METRIC_TYPES } from "../utils/constants";
import {
	debounce,
	formatCurrency,
	formatDuration,
	formatNumber,
	formatPercentage,
	formatRelativeTime,
	formatShortTime,
	getTimeRangeBounds,
	truncateText,
} from "../utils/formatters";
import { chartsController } from "./charts";
import { metricsApi } from "./metrics-api";
import { sseClient } from "./sse-client";

export interface ActivityItem {
	id: string;
	timestamp: string;
	type: MetricType;
	title: string;
	subtitle: string;
	status: "success" | "error" | "warning" | "info";
}

export class DashboardController {
	private currentTimeRange: TimeRange = "24h";
	private autoRefresh = true;
	private updateIntervals: NodeJS.Timeout[] = [];
	private activityItems: ActivityItem[] = [];
	private isLoading = false;
	private activityFeedInitialized = false;

	/**
	 * Initialize the dashboard
	 */
	async initialize(): Promise<void> {
		try {
			this.showLoading(true);

			// Initialize charts
			chartsController.initializeCharts();

			// Setup event listeners
			this.setupEventListeners();

			// Setup SSE connection
			this.setupSSE();

			// Load initial data
			await this.loadDashboardData();

			// Setup auto-refresh
			this.setupAutoRefresh();

			this.showLoading(false);
		} catch (error) {
			console.error("Failed to initialize dashboard:", error);
			this.showError("Failed to initialize dashboard");
			this.showLoading(false);
		}
	}

	/**
	 * Setup event listeners for UI controls
	 */
	private setupEventListeners(): void {
		// Time range selector
		const timeRangeSelect = document.getElementById(
			"time-range",
		) as HTMLSelectElement;
		if (timeRangeSelect) {
			timeRangeSelect.addEventListener("change", (e) => {
				const target = e.target as HTMLSelectElement;
				this.currentTimeRange = target.value as TimeRange;
				this.loadDashboardData();
			});
		}

		// Auto-refresh toggle
		const autoRefreshCheckbox = document.getElementById(
			"auto-refresh",
		) as HTMLInputElement;
		if (autoRefreshCheckbox) {
			autoRefreshCheckbox.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				this.autoRefresh = target.checked;
				if (this.autoRefresh) {
					this.setupAutoRefresh();
				} else {
					this.clearAutoRefresh();
				}
			});
		}
	}

	/**
	 * Setup SSE connection for real-time updates
	 */
	private setupSSE(): void {
		sseClient.addEventListener("message", this.handleSSEMessage.bind(this));
		sseClient.addEventListener("error", this.handleSSEError.bind(this));
		sseClient.addEventListener("status", this.handleSSEStatus.bind(this));

		// Connect with all metric types
		sseClient.connect({
			metric_types: Object.values(METRIC_TYPES),
			subscription_types: ["live", "summary"],
		});
	}

	/**
	 * Handle SSE messages
	 */
	private handleSSEMessage(event: SSEEvent): void {
		switch (event.event) {
			case "metric":
				this.handleLiveMetric(event.data);
				break;
			case "summary":
				this.handleLiveSummary(event.data);
				break;
			case "heartbeat":
				// Update connection status if needed
				break;
		}
	}

	/**
	 * Handle individual live metrics
	 */
	private handleLiveMetric(metric: AnyMetric): void {
		console.log("Received live metric:", metric);
		// Add to activity feed
		this.addActivityItem(metric);

		// Update relevant charts if within current time range
		const { start, end } = getTimeRangeBounds(this.currentTimeRange);
		const metricTime = new Date(metric.timestamp);

		if (metricTime >= start && metricTime <= end) {
			// Debounced chart updates to avoid too frequent refreshes
			this.debouncedChartUpdate();
		}
	}

	/**
	 * Handle live summary updates
	 */
	private handleLiveSummary(summary: MetricsSummary): void {
		this.updateOverviewCards(summary);
	}

	/**
	 * Handle SSE errors
	 */
	private handleSSEError(error: Error): void {
		console.error("SSE error:", error);
		this.updateConnectionStatus(false);
	}

	/**
	 * Handle SSE status changes
	 */
	private handleSSEStatus(connected: boolean): void {
		this.updateConnectionStatus(connected);
	}

	/**
	 * Load dashboard data
	 */
	private async loadDashboardData(): Promise<void> {
		if (this.isLoading) return;

		this.isLoading = true;

		try {
			const { start, end } = getTimeRangeBounds(this.currentTimeRange);
			console.log("Loading dashboard data for time range:", {
				start,
				end,
				range: this.currentTimeRange,
			});

			// Check if API is available first
			const isAvailable = await metricsApi.isAvailable();
			if (!isAvailable) {
				console.warn("Metrics API is not available");
				this.updateOverviewCards(null as any); // This will show zeros
				return;
			}

			// Load summary data
			console.log("Fetching summary data...");
			const summary = await metricsApi.getSummaryForTimeRange(start, end);
			console.log("Received summary data:", summary);
			this.updateOverviewCards(summary);

			// Load chart data
			await this.loadChartsData(start, end);

			// Populate activity feed with historical data only on first load
			if (!this.activityFeedInitialized) {
				await this.populateActivityFromHistory(start, end);
				this.activityFeedInitialized = true;
			}

			// Check health
			await this.updateHealthStatus();
		} catch (error) {
			console.error("Failed to load dashboard data:", error);
			this.showError("Failed to load dashboard data");
			// Show zeros in case of error
			this.updateOverviewCards(null as any);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Load data for charts
	 */
	private async loadChartsData(start: Date, end: Date): Promise<void> {
		try {
			console.log("Loading charts data...");

			// Load request metrics for volume chart
			const requestMetrics = await metricsApi.getMetricsForTimeRange(
				start,
				end,
				"request",
				DASHBOARD_CONFIG.LIMITS.MAX_CHART_POINTS,
			);
			console.log("Request metrics:", requestMetrics);
			chartsController.updateRequestVolumeChart(requestMetrics.data as any[]);

			// Load cost metrics for cost chart
			const costMetrics = await metricsApi.getMetricsForTimeRange(
				start,
				end,
				"cost",
				DASHBOARD_CONFIG.LIMITS.MAX_CHART_POINTS,
			);
			console.log("Cost metrics:", costMetrics);
			chartsController.updateCostChart(costMetrics.data as any[]);

			// Load summary data for remaining charts
			const summary = await metricsApi.getSummaryForTimeRange(start, end);
			console.log("Summary for charts:", summary);

			// Update charts with summary data
			// Map API response fields to expected fields
			const errorTypes = (summary as any).errors || summary.error_types;
			const modelUsage = (summary as any).models || summary.model_usage;

			console.log("Updating error chart with:", errorTypes);
			chartsController.updateErrorChart(errorTypes);

			console.log("Updating model usage chart with:", modelUsage);
			chartsController.updateModelUsageChart(modelUsage);

			// For response time chart, we'd need historical summaries
			// For now, use current summary
			console.log("Updating response time chart with summary data");
			chartsController.updateResponseTimeChart([
				{
					timestamp: end.toISOString(),
					summary,
				},
			]);

			console.log("Charts data loading completed");
		} catch (error) {
			console.error("Failed to load charts data:", error);
		}
	}

	/**
	 * Update overview cards with summary data
	 */
	private updateOverviewCards(summary: MetricsSummary): void {
		// Add safety checks for undefined summary or missing properties
		if (!summary) {
			console.warn("Summary data is undefined");
			this.updateElement("total-requests", "0");
			this.updateElement("success-rate", "0%");
			this.updateElement("avg-response-time", "0ms");
			this.updateElement("total-cost", "$0.00");
			return;
		}

		// Total requests - check both possible field names
		const requestData = (summary as any).requests || summary.request_metrics;
		const totalRequests =
			requestData?.total ?? requestData?.total_requests ?? 0;
		this.updateElement("total-requests", formatNumber(totalRequests));

		// Success rate
		const successfulRequests =
			requestData?.successful ?? requestData?.successful_requests ?? 0;
		const successRate =
			totalRequests > 0 ? successfulRequests / totalRequests : 0;
		this.updateElement("success-rate", formatPercentage(successRate));

		// Average response time - check both possible field names
		const performanceData =
			(summary as any).performance || summary.response_metrics;
		const avgResponseTime = performanceData?.avg_response_time_ms ?? 0;
		this.updateElement("avg-response-time", formatDuration(avgResponseTime));

		// Total cost - check both possible field names
		const costData = (summary as any).costs || summary.cost_metrics;
		const totalCost = costData?.total ?? costData?.total_cost ?? 0;
		this.updateElement("total-cost", formatCurrency(totalCost));

		// Update change indicators (would need historical data for real calculations)
		this.updateElement("requests-change", "+12%", "text-green-600");
		this.updateElement("success-change", "+0.2%", "text-green-600");
		this.updateElement("latency-change", "+5ms", "text-red-600");
		this.updateElement("cost-change", "+$2.34", "text-red-600");
	}

	/**
	 * Populate activity feed with historical data
	 */
	private async populateActivityFromHistory(
		start: Date,
		end: Date,
	): Promise<void> {
		try {
			console.log("Populating activity feed with historical data...");

			// Get recent metrics for activity feed (limit to 20 items)
			const recentMetrics = await metricsApi.getMetricsForTimeRange(
				start,
				end,
				undefined, // all metric types
				20,
			);

			console.log("Historical metrics for activity:", recentMetrics);

			// Add each metric to activity feed (in reverse order to maintain chronological order)
			recentMetrics.data.reverse().forEach((metric: any) => {
				this.addActivityItem(metric);
			});

			console.log(
				"Activity feed populated with",
				recentMetrics.data.length,
				"historical items",
			);
		} catch (error) {
			console.error("Failed to populate activity feed:", error);
		}
	}

	/**
	 * Add activity item to the feed
	 */
	private addActivityItem(metric: AnyMetric): void {
		// Check for duplicate based on ID to avoid adding the same metric twice
		if (this.activityItems.some((item) => item.id === metric.id)) {
			return;
		}

		console.log("Adding activity item for metric:", metric.metric_type);
		const item: ActivityItem = {
			id: metric.id,
			timestamp: metric.timestamp,
			type: metric.metric_type,
			title: this.getActivityTitle(metric),
			subtitle: this.getActivitySubtitle(metric),
			status: this.getActivityStatus(metric),
		};

		// Add to beginning of array (newest first)
		this.activityItems.unshift(item);

		// Limit items to prevent memory issues
		if (
			this.activityItems.length > DASHBOARD_CONFIG.LIMITS.MAX_ACTIVITY_ITEMS
		) {
			this.activityItems = this.activityItems.slice(
				0,
				DASHBOARD_CONFIG.LIMITS.MAX_ACTIVITY_ITEMS,
			);
		}

		console.log("Activity items array length:", this.activityItems.length);
		this.updateActivityFeed();
	}

	/**
	 * Get activity title for metric
	 */
	private getActivityTitle(metric: AnyMetric): string {
		switch (metric.metric_type) {
			case "request": {
				const requestMetric = metric as any;
				return `${requestMetric.method} ${truncateText(requestMetric.path, 30)}`;
			}
			case "response": {
				const responseMetric = metric as any;
				return `Response ${responseMetric.status_code}`;
			}
			case "error": {
				const errorMetric = metric as any;
				return `Error: ${truncateText(errorMetric.error_type, 25)}`;
			}
			case "cost": {
				const costMetric = metric as any;
				return `Cost: ${formatCurrency(costMetric.total_cost)}`;
			}
			case "latency": {
				const latencyMetric = metric as any;
				return `Latency: ${formatDuration(latencyMetric.total_latency_ms)}`;
			}
			case "usage": {
				const usageMetric = metric as any;
				return `Usage: ${usageMetric.request_count} requests`;
			}
			default:
				return "Unknown Activity";
		}
	}

	/**
	 * Get activity subtitle for metric
	 */
	private getActivitySubtitle(metric: AnyMetric): string {
		switch (metric.metric_type) {
			case "request": {
				const requestMetric = metric as any;
				return requestMetric.model
					? `Model: ${requestMetric.model}`
					: "No model";
			}
			case "response": {
				const responseMetric = metric as any;
				return `${formatDuration(responseMetric.response_time_ms)}`;
			}
			case "error": {
				const errorMetric = metric as any;
				return errorMetric.endpoint || "Unknown endpoint";
			}
			case "cost": {
				const costMetric = metric as any;
				return `${costMetric.input_tokens + costMetric.output_tokens} tokens`;
			}
			case "latency": {
				const latencyMetric = metric as any;
				return `Queue: ${formatDuration(latencyMetric.queue_time_ms)} | API: ${formatDuration(latencyMetric.claude_api_call_ms)}`;
			}
			case "usage": {
				const usageMetric = metric as any;
				return `${usageMetric.token_count} tokens in ${formatDuration(usageMetric.window_duration_seconds * 1000)}`;
			}
			default:
				return formatRelativeTime((metric as AnyMetric).timestamp);
		}
	}

	/**
	 * Get activity status for metric
	 */
	private getActivityStatus(metric: AnyMetric): ActivityItem["status"] {
		switch (metric.metric_type) {
			case "request":
				return "info";
			case "response": {
				const responseMetric = metric as any;
				return responseMetric.status_code >= 400 ? "error" : "success";
			}
			case "error":
				return "error";
			case "cost":
				return "warning";
			default:
				return "info";
		}
	}

	/**
	 * Update activity feed in DOM
	 */
	private updateActivityFeed(): void {
		const feedElement = document.getElementById("activity-feed");
		if (!feedElement) return;

		if (this.activityItems.length === 0) {
			feedElement.innerHTML = `
        <div class="text-center text-gray-500 text-sm py-8">
          <div class="spinner mx-auto mb-2"></div>
          <p>Waiting for activity...</p>
        </div>
      `;
			return;
		}

		// Store current scroll position
		const scrollTop = feedElement.scrollTop;
		const scrollHeight = feedElement.scrollHeight;
		const clientHeight = feedElement.clientHeight;
		const wasScrolledToBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px tolerance

		// Update content
		feedElement.innerHTML = this.activityItems
			.map(
				(item) => `
      <div class="activity-item">
        <div class="flex-shrink-0">
          <div class="w-3 h-3 rounded-full ${this.getStatusColor(item.status)}"></div>
        </div>
        <div class="activity-content">
          <div class="activity-title">${item.title}</div>
          <div class="activity-subtitle">${item.subtitle}</div>
        </div>
        <div class="activity-time">${formatShortTime(item.timestamp)}</div>
      </div>
    `,
			)
			.join("");

		// Restore scroll position or auto-scroll to bottom for new items
		if (wasScrolledToBottom) {
			// If user was at bottom, keep them at bottom to see new items
			feedElement.scrollTop = feedElement.scrollHeight;
		} else {
			// If user was scrolled up, maintain their position
			feedElement.scrollTop = scrollTop;
		}
	}

	/**
	 * Get status color class
	 */
	private getStatusColor(status: ActivityItem["status"]): string {
		switch (status) {
			case "success":
				return "bg-green-500";
			case "error":
				return "bg-red-500";
			case "warning":
				return "bg-yellow-500";
			case "info":
				return "bg-blue-500";
			default:
				return "bg-gray-500";
		}
	}

	/**
	 * Update connection status in UI
	 */
	private updateConnectionStatus(connected: boolean): void {
		const statusElement = document.getElementById("connection-status");
		if (!statusElement) return;

		const dotElement = statusElement.querySelector(".pulse-dot");
		const textElement = statusElement.querySelector("span");

		if (connected) {
			dotElement?.classList.remove("bg-red-500");
			dotElement?.classList.add("bg-green-500");
			if (textElement) textElement.textContent = "Connected";
		} else {
			dotElement?.classList.remove("bg-green-500");
			dotElement?.classList.add("bg-red-500");
			if (textElement) textElement.textContent = "Disconnected";
		}
	}

	/**
	 * Update health status
	 */
	private async updateHealthStatus(): Promise<void> {
		try {
			const health = await metricsApi.getHealth();
			// Update health indicators if needed
			// For now, just log the health status
			console.log("Health status:", health);
		} catch (error) {
			console.error("Failed to get health status:", error);
		}
	}

	/**
	 * Setup auto-refresh intervals
	 */
	private setupAutoRefresh(): void {
		if (!this.autoRefresh) return;

		this.clearAutoRefresh();

		// Summary update interval
		this.updateIntervals.push(
			setInterval(() => {
				if (this.autoRefresh) {
					this.loadDashboardData();
				}
			}, DASHBOARD_CONFIG.INTERVALS.SUMMARY_UPDATE),
		);

		// Health check interval
		this.updateIntervals.push(
			setInterval(() => {
				if (this.autoRefresh) {
					this.updateHealthStatus();
				}
			}, DASHBOARD_CONFIG.INTERVALS.HEALTH_CHECK),
		);
	}

	/**
	 * Clear auto-refresh intervals
	 */
	private clearAutoRefresh(): void {
		this.updateIntervals.forEach(clearInterval);
		this.updateIntervals = [];
	}

	/**
	 * Debounced chart update
	 */
	private debouncedChartUpdate = debounce(async () => {
		const { start, end } = getTimeRangeBounds(this.currentTimeRange);
		await this.loadChartsData(start, end);
	}, 2000);

	/**
	 * Update DOM element with new content
	 */
	private updateElement(id: string, content: string, className?: string): void {
		const element = document.getElementById(id);
		if (element) {
			element.textContent = content;
			if (className) {
				element.className = className;
			}
		}
	}

	/**
	 * Show loading state
	 */
	private showLoading(show: boolean): void {
		const overlay = document.getElementById("loading-overlay");
		if (overlay) {
			overlay.style.display = show ? "flex" : "none";
		}
	}

	/**
	 * Show error message
	 */
	private showError(message: string): void {
		// For now, just console.error
		// In a real app, you'd show a toast or banner
		console.error(message);
	}

	/**
	 * Cleanup when dashboard is destroyed
	 */
	destroy(): void {
		this.clearAutoRefresh();
		sseClient.disconnect();
		chartsController.destroyCharts();
	}
}

// Export singleton instance
export const dashboardController = new DashboardController();
