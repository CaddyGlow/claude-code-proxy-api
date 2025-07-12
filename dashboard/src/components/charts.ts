import {
	ArcElement,
	BarController,
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	DoughnutController,
	Filler,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	TimeScale,
	Title,
	Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import type { ChartConfiguration } from "chart.js";
import type {
	AnyMetric,
	CostMetric,
	MetricsSummary,
	RequestMetric,
} from "../types/metrics";
import { DASHBOARD_CONFIG } from "../utils/constants";
import {
	formatCurrency,
	formatDuration,
	formatNumber,
	getChartColor,
} from "../utils/formatters";

// Register Chart.js components
ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	Title,
	Tooltip,
	Legend,
	TimeScale,
	Filler,
	LineController,
	BarController,
	DoughnutController,
);

export interface ChartManager {
	requestVolumeChart: ChartJS | null;
	responseTimeChart: ChartJS | null;
	errorChart: ChartJS | null;
	modelUsageChart: ChartJS | null;
	costChart: ChartJS | null;
}

export class ChartsController {
	private charts: ChartManager = {
		requestVolumeChart: null,
		responseTimeChart: null,
		errorChart: null,
		modelUsageChart: null,
		costChart: null,
	};

	/**
	 * Initialize all charts
	 */
	initializeCharts(): void {
		console.log("Initializing charts...");
		this.initRequestVolumeChart();
		this.initResponseTimeChart();
		this.initErrorChart();
		this.initModelUsageChart();
		this.initCostChart();
		console.log("Charts initialized:", this.charts);
	}

	/**
	 * Initialize request volume chart
	 */
	private initRequestVolumeChart(): void {
		const canvas = document.getElementById(
			"request-volume-chart",
		) as HTMLCanvasElement;
		if (!canvas) {
			console.warn("Request volume chart canvas not found");
			return;
		}
		console.log("Initializing request volume chart");

		const config: ChartConfiguration = {
			type: "line",
			data: {
				labels: [],
				datasets: [
					{
						label: "Requests",
						data: [],
						borderColor: DASHBOARD_CONFIG.COLORS.primary,
						backgroundColor: DASHBOARD_CONFIG.COLORS.primary + "20",
						fill: true,
						tension: 0.4,
					},
				],
			},
			options: {
				...DASHBOARD_CONFIG.CHART_DEFAULTS,
				plugins: {
					...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins,
					tooltip: {
						...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins.tooltip,
						callbacks: {
							label: (context) => `Requests: ${formatNumber(context.parsed.y)}`,
						},
					},
				},
				scales: {
					x: {
						type: "time",
						time: {
							displayFormats: {
								hour: "HH:mm",
								day: "MMM dd",
							},
						},
						...DASHBOARD_CONFIG.CHART_DEFAULTS.scales.x,
					},
					y: {
						...DASHBOARD_CONFIG.CHART_DEFAULTS.scales.y,
						beginAtZero: true,
						ticks: {
							callback: (value) => formatNumber(Number(value)),
						},
					},
				},
			},
		};

		this.charts.requestVolumeChart = new ChartJS(canvas, config);
	}

	/**
	 * Initialize response time chart
	 */
	private initResponseTimeChart(): void {
		const canvas = document.getElementById(
			"response-time-chart",
		) as HTMLCanvasElement;
		if (!canvas) return;

		const config: ChartConfiguration = {
			type: "line",
			data: {
				labels: [],
				datasets: [
					{
						label: "Average",
						data: [],
						borderColor: DASHBOARD_CONFIG.COLORS.secondary,
						backgroundColor: "transparent",
						tension: 0.4,
					},
					{
						label: "P95",
						data: [],
						borderColor: DASHBOARD_CONFIG.COLORS.warning,
						backgroundColor: "transparent",
						tension: 0.4,
					},
					{
						label: "P99",
						data: [],
						borderColor: DASHBOARD_CONFIG.COLORS.danger,
						backgroundColor: "transparent",
						tension: 0.4,
					},
				],
			},
			options: {
				...DASHBOARD_CONFIG.CHART_DEFAULTS,
				plugins: {
					...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins,
					tooltip: {
						...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins.tooltip,
						callbacks: {
							label: (context) =>
								`${context.dataset.label}: ${formatDuration(context.parsed.y)}`,
						},
					},
				},
				scales: {
					x: {
						type: "time",
						...DASHBOARD_CONFIG.CHART_DEFAULTS.scales.x,
					},
					y: {
						...DASHBOARD_CONFIG.CHART_DEFAULTS.scales.y,
						beginAtZero: true,
						ticks: {
							callback: (value) => formatDuration(Number(value)),
						},
					},
				},
			},
		};

		this.charts.responseTimeChart = new ChartJS(canvas, config);
	}

	/**
	 * Initialize error distribution chart
	 */
	private initErrorChart(): void {
		const canvas = document.getElementById("error-chart") as HTMLCanvasElement;
		if (!canvas) return;

		const config: ChartConfiguration = {
			type: "doughnut",
			data: {
				labels: [],
				datasets: [
					{
						data: [],
						backgroundColor: [],
						borderWidth: 0,
					},
				],
			},
			options: {
				...DASHBOARD_CONFIG.CHART_DEFAULTS,
				plugins: {
					...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins,
					tooltip: {
						...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins.tooltip,
						callbacks: {
							label: (context) => {
								const total = context.dataset.data.reduce(
									(sum: number, value) => sum + Number(value),
									0,
								);
								const percentage = (
									(Number(context.parsed) / total) *
									100
								).toFixed(1);
								return `${context.label}: ${formatNumber(Number(context.parsed))} (${percentage}%)`;
							},
						},
					},
				},
			},
		};

		this.charts.errorChart = new ChartJS(canvas, config);
	}

	/**
	 * Initialize model usage chart
	 */
	private initModelUsageChart(): void {
		const canvas = document.getElementById(
			"model-usage-chart",
		) as HTMLCanvasElement;
		if (!canvas) return;

		const config: ChartConfiguration = {
			type: "bar",
			data: {
				labels: [],
				datasets: [
					{
						label: "Requests",
						data: [],
						backgroundColor: [],
						borderRadius: 6,
						borderSkipped: false,
					},
				],
			},
			options: {
				...DASHBOARD_CONFIG.CHART_DEFAULTS,
				indexAxis: "y" as const,
				plugins: {
					...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins,
					tooltip: {
						...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins.tooltip,
						callbacks: {
							label: (context) => `Requests: ${formatNumber(context.parsed.x)}`,
						},
					},
				},
				scales: {
					x: {
						...DASHBOARD_CONFIG.CHART_DEFAULTS.scales.y,
						beginAtZero: true,
						ticks: {
							callback: (value) => formatNumber(Number(value)),
						},
					},
					y: {
						...DASHBOARD_CONFIG.CHART_DEFAULTS.scales.x,
					},
				},
			},
		};

		this.charts.modelUsageChart = new ChartJS(canvas, config);
	}

	/**
	 * Initialize cost analytics chart
	 */
	private initCostChart(): void {
		const canvas = document.getElementById("cost-chart") as HTMLCanvasElement;
		if (!canvas) return;

		const config: ChartConfiguration = {
			type: "line",
			data: {
				labels: [],
				datasets: [
					{
						label: "Cost",
						data: [],
						borderColor: DASHBOARD_CONFIG.COLORS.info,
						backgroundColor: DASHBOARD_CONFIG.COLORS.info + "20",
						fill: true,
						tension: 0.4,
					},
				],
			},
			options: {
				...DASHBOARD_CONFIG.CHART_DEFAULTS,
				plugins: {
					...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins,
					tooltip: {
						...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins.tooltip,
						callbacks: {
							label: (context) => `Cost: ${formatCurrency(context.parsed.y)}`,
						},
					},
				},
				scales: {
					x: {
						type: "time",
						...DASHBOARD_CONFIG.CHART_DEFAULTS.scales.x,
					},
					y: {
						...DASHBOARD_CONFIG.CHART_DEFAULTS.scales.y,
						beginAtZero: true,
						ticks: {
							callback: (value) => formatCurrency(Number(value)),
						},
					},
				},
			},
		};

		this.charts.costChart = new ChartJS(canvas, config);
	}

	/**
	 * Update request volume chart with metrics data
	 */
	updateRequestVolumeChart(metrics: RequestMetric[]): void {
		if (!this.charts.requestVolumeChart) return;

		// Group metrics by time interval
		const timeGroups = this.groupMetricsByTime(metrics, "hour");
		const labels = Object.keys(timeGroups).sort();
		const data = labels.map((label) => timeGroups[label]?.length ?? 0);

		this.charts.requestVolumeChart.data.labels = labels;
		this.charts.requestVolumeChart.data.datasets[0]!.data = data;
		this.charts.requestVolumeChart.update();
	}

	/**
	 * Update response time chart with summary data
	 */
	updateResponseTimeChart(
		summaries: Array<{ timestamp: string; summary: MetricsSummary }>,
	): void {
		if (!this.charts.responseTimeChart) return;

		// Handle case where summaries is empty or undefined
		if (!summaries || summaries.length === 0) {
			this.charts.responseTimeChart.data.labels = [];
			this.charts.responseTimeChart.data.datasets[0]!.data = [];
			this.charts.responseTimeChart.data.datasets[1]!.data = [];
			this.charts.responseTimeChart.data.datasets[2]!.data = [];
			this.charts.responseTimeChart.update();
			return;
		}

		const labels = summaries.map((s) => s.timestamp);
		const avgData = summaries.map(
			(s) =>
				s.summary?.performance?.avg_response_time_ms ??
				s.summary?.response_metrics?.avg_response_time_ms ??
				0,
		);
		const p95Data = summaries.map(
			(s) =>
				s.summary?.performance?.p95_response_time_ms ??
				s.summary?.response_metrics?.p95_response_time_ms ??
				0,
		);
		const p99Data = summaries.map(
			(s) =>
				s.summary?.performance?.p99_response_time_ms ??
				s.summary?.response_metrics?.p99_response_time_ms ??
				0,
		);

		this.charts.responseTimeChart.data.labels = labels;
		this.charts.responseTimeChart.data.datasets[0]!.data = avgData;
		this.charts.responseTimeChart.data.datasets[1]!.data = p95Data;
		this.charts.responseTimeChart.data.datasets[2]!.data = p99Data;
		this.charts.responseTimeChart.update();
	}

	/**
	 * Update error chart with error metrics
	 */
	updateErrorChart(
		errorTypes: Record<string, number> | undefined | null,
	): void {
		if (!this.charts.errorChart) return;

		// Handle case where errorTypes is undefined or null
		if (!errorTypes || typeof errorTypes !== "object") {
			this.charts.errorChart.data.labels = [];
			this.charts.errorChart.data.datasets[0]!.data = [];
			(this.charts.errorChart.data.datasets[0] as any).backgroundColor = [];
			this.charts.errorChart.update();
			return;
		}

		const entries = Object.entries(errorTypes);
		const labels = entries.map(([type]) => type);
		const data = entries.map(([, count]) => count);
		const colors = labels.map((_, index) => getChartColor(index));

		this.charts.errorChart.data.labels = labels;
		this.charts.errorChart.data.datasets[0]!.data = data;
		(this.charts.errorChart.data.datasets[0] as any).backgroundColor = colors;
		this.charts.errorChart.update();
	}

	/**
	 * Update model usage chart
	 */
	updateModelUsageChart(
		modelUsage: Record<string, number> | undefined | null,
	): void {
		if (!this.charts.modelUsageChart) return;

		// Handle case where modelUsage is undefined or null
		if (!modelUsage || typeof modelUsage !== "object") {
			this.charts.modelUsageChart.data.labels = [];
			this.charts.modelUsageChart.data.datasets[0]!.data = [];
			(this.charts.modelUsageChart.data.datasets[0] as any).backgroundColor =
				[];
			this.charts.modelUsageChart.update();
			return;
		}

		const entries = Object.entries(modelUsage);
		const labels = entries.map(([model]) => model);
		const data = entries.map(([, count]) => count);
		const colors = labels.map((_, index) => getChartColor(index));

		this.charts.modelUsageChart.data.labels = labels;
		this.charts.modelUsageChart.data.datasets[0]!.data = data;
		(this.charts.modelUsageChart.data.datasets[0] as any).backgroundColor =
			colors;
		this.charts.modelUsageChart.update();
	}

	/**
	 * Update cost chart with cost metrics
	 */
	updateCostChart(costMetrics: CostMetric[]): void {
		if (!this.charts.costChart) return;

		// Group by time and sum costs
		const timeGroups = this.groupMetricsByTime(costMetrics, "hour");
		const labels = Object.keys(timeGroups).sort();
		const data = labels.map((label) => {
			return (
				timeGroups[label]?.reduce(
					(sum, metric) => sum + metric.total_cost,
					0,
				) ?? 0
			);
		});

		this.charts.costChart.data.labels = labels;
		this.charts.costChart.data.datasets[0]!.data = data;
		this.charts.costChart.update();
	}

	/**
	 * Group metrics by time interval
	 */
	private groupMetricsByTime<T extends AnyMetric>(
		metrics: T[],
		interval: "minute" | "hour" | "day",
	): Record<string, T[]> {
		const groups: Record<string, T[]> = {};

		metrics.forEach((metric) => {
			const date = new Date(metric.timestamp);
			let key: string;

			switch (interval) {
				case "minute":
					key = date.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
					break;
				case "hour":
					key = date.toISOString().substring(0, 13); // YYYY-MM-DDTHH
					break;
				case "day":
					key = date.toISOString().substring(0, 10); // YYYY-MM-DD
					break;
			}

			if (!groups[key]) {
				groups[key] = [];
			}
			groups[key]!.push(metric);
		});

		return groups;
	}

	/**
	 * Destroy all charts
	 */
	destroyCharts(): void {
		Object.values(this.charts).forEach((chart) => {
			if (chart) {
				chart.destroy();
			}
		});

		// Reset chart references
		Object.keys(this.charts).forEach((key) => {
			(this.charts as any)[key] = null;
		});
	}

	/**
	 * Get chart instance by name
	 */
	getChart(name: keyof ChartManager): ChartJS | null {
		return this.charts[name];
	}
}

// Export singleton instance
export const chartsController = new ChartsController();
